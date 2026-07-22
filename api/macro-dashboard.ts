type ApiRequest = {
  method?: string;
};

type ApiResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): ApiResponse;
  json(payload: unknown): void;
  end(): void;
};

type Point = { date: string; value: number };
type Status = 'healthy' | 'watch' | 'warning';

type Indicator = {
  id: string;
  title: string;
  value: number;
  displayValue: string;
  status: Status;
  summary: string;
  threshold: string;
  updatedAt: string;
  source: string;
  sourceUrl: string;
  details: Array<{ label: string; value: string }>;
  available: boolean;
};

type SeriesResult = {
  points: Point[];
  error?: string;
};

const FRED_CSV = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=';
const YAHOO_CHART_HOSTS = [
  'https://query1.finance.yahoo.com/v8/finance/chart/',
  'https://query2.finance.yahoo.com/v8/finance/chart/',
];

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[]): number {
  const mean = average(values);
  return Math.sqrt(average(values.map((value) => (value - mean) ** 2)));
}

function percentileRank(values: number[], current: number): number {
  if (!values.length) return 0;
  return (values.filter((value) => value <= current).length / values.length) * 100;
}

function formatPercent(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}

function formatSigned(value: number, digits = 1): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}%`;
}

function latest(points: Point[]): Point {
  const point = points.at(-1);
  if (!point) throw new Error('Series has no observations');
  return point;
}

function lag(points: Point[], periods: number): Point | undefined {
  return points.at(-(periods + 1));
}

function changePercent(current: number, previous: number): number {
  return ((current / previous) - 1) * 100;
}

function alignByDate(left: Point[], right: Point[]): Array<{ date: string; left: number; right: number }> {
  const rightMap = new Map(right.map((point) => [point.date, point.value]));
  return left.flatMap((point) => {
    const rightValue = rightMap.get(point.date);
    return rightValue === undefined ? [] : [{ date: point.date, left: point.value, right: rightValue }];
  });
}

function linearRegression(values: number[]): { intercept: number; slope: number; residuals: number[] } {
  const xs = values.map((_, index) => index);
  const xMean = average(xs);
  const yMean = average(values);
  const denominator = xs.reduce((sum, x) => sum + (x - xMean) ** 2, 0);
  const slope = denominator === 0
    ? 0
    : xs.reduce((sum, x, index) => sum + (x - xMean) * (values[index] - yMean), 0) / denominator;
  const intercept = yMean - slope * xMean;
  const residuals = values.map((value, index) => value - (intercept + slope * index));
  return { intercept, slope, residuals };
}

function quarterEnd(date: string): string {
  const [yearText, monthText] = date.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const quarter = Math.floor((month - 1) / 3) + 1;
  const endDate = new Date(Date.UTC(year, quarter * 3, 0));
  return endDate.toISOString().slice(0, 10);
}

function onOrBefore(points: Point[], targetDate: string): Point | undefined {
  for (let index = points.length - 1; index >= 0; index -= 1) {
    if (points[index].date <= targetDate) return points[index];
  }
  return undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function fetchWithRetry(
  url: string,
  label: string,
  init: RequestInit = {},
  attempts = 2,
  timeoutMs = 10_000,
): Promise<Response> {
  let lastError = 'unknown network error';

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      if (!response.ok) {
        lastError = `HTTP ${response.status}`;
      } else {
        return response;
      }
    } catch (error) {
      lastError = errorMessage(error);
    } finally {
      clearTimeout(timeout);
    }

    if (attempt < attempts) {
      await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
    }
  }

  throw new Error(`${label}: ${lastError}`);
}

async function fetchFred(seriesId: string): Promise<Point[]> {
  const response = await fetchWithRetry(
    `${FRED_CSV}${encodeURIComponent(seriesId)}`,
    `FRED ${seriesId}`,
    {
      headers: {
        Accept: 'text/csv,*/*;q=0.8',
        'User-Agent': 'StockIndicatorDashboard/1.1',
      },
    },
    3,
  );

  const text = await response.text();
  const points = text
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .flatMap((line) => {
      const [date, rawValue] = line.split(',');
      const value = Number(rawValue);
      return date && Number.isFinite(value) ? [{ date, value }] : [];
    });

  if (!points.length) throw new Error(`FRED ${seriesId}: no observations`);
  return points;
}

async function fetchYahooFromHost(symbol: string, host: string): Promise<Point[]> {
  const url = `${host}${encodeURIComponent(symbol)}?range=2y&interval=1d&events=div%2Csplits`;
  const response = await fetchWithRetry(
    url,
    `Yahoo ${symbol}`,
    {
      headers: {
        Accept: 'application/json,text/plain,*/*',
        'User-Agent': 'Mozilla/5.0 (compatible; StockIndicatorDashboard/1.1)',
      },
    },
    2,
  );

  const payload = await response.json() as {
    chart?: {
      error?: { description?: string } | null;
      result?: Array<{
        timestamp?: number[];
        indicators?: {
          adjclose?: Array<{ adjclose?: Array<number | null> }>;
          quote?: Array<{ close?: Array<number | null> }>;
        };
      }>;
    };
  };

  if (payload.chart?.error) throw new Error(payload.chart.error.description ?? `Yahoo ${symbol}: API error`);
  const result = payload.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const closes = result?.indicators?.adjclose?.[0]?.adjclose
    ?? result?.indicators?.quote?.[0]?.close
    ?? [];

  const points = timestamps.flatMap((timestamp, index) => {
    const value = closes[index];
    if (value === null || value === undefined || !Number.isFinite(value)) return [];
    return [{ date: new Date(timestamp * 1000).toISOString().slice(0, 10), value }];
  });

  if (!points.length) throw new Error(`Yahoo ${symbol}: no observations`);
  return points;
}

async function fetchStooq(symbol: string): Promise<Point[]> {
  const end = new Date();
  const start = new Date(end.getTime() - 760 * 86400000);
  const dateText = (date: Date) => date.toISOString().slice(0, 10).replaceAll('-', '');
  const stooqSymbol = `${symbol.toLowerCase()}.us`;
  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(stooqSymbol)}&d1=${dateText(start)}&d2=${dateText(end)}&i=d`;
  const response = await fetchWithRetry(url, `Stooq ${symbol}`, { headers: { Accept: 'text/csv,*/*' } }, 2);
  const lines = (await response.text()).trim().split(/\r?\n/);
  const header = lines[0]?.split(',') ?? [];
  const dateIndex = header.indexOf('Date');
  const closeIndex = header.indexOf('Close');

  if (dateIndex < 0 || closeIndex < 0) throw new Error(`Stooq ${symbol}: invalid CSV`);

  const points = lines.slice(1).flatMap((line) => {
    const columns = line.split(',');
    const date = columns[dateIndex];
    const value = Number(columns[closeIndex]);
    return date && Number.isFinite(value) ? [{ date, value }] : [];
  });

  if (!points.length) throw new Error(`Stooq ${symbol}: no observations`);
  return points;
}

async function fetchMarket(symbol: string): Promise<Point[]> {
  const errors: string[] = [];

  for (const host of YAHOO_CHART_HOSTS) {
    try {
      return await fetchYahooFromHost(symbol, host);
    } catch (error) {
      errors.push(errorMessage(error));
    }
  }

  try {
    return await fetchStooq(symbol);
  } catch (error) {
    errors.push(errorMessage(error));
  }

  throw new Error(`${symbol} market data unavailable: ${errors.join(' | ')}`);
}

async function settle(loader: () => Promise<Point[]>): Promise<SeriesResult> {
  try {
    return { points: await loader() };
  } catch (error) {
    return { points: [], error: errorMessage(error) };
  }
}

function statusByThreshold(value: number, watch: number, warning: number, higherIsWorse = true): Status {
  if (higherIsWorse) {
    if (value >= warning) return 'warning';
    if (value >= watch) return 'watch';
  } else {
    if (value <= warning) return 'warning';
    if (value <= watch) return 'watch';
  }
  return 'healthy';
}

function unavailableIndicator(
  id: string,
  title: string,
  source: string,
  sourceUrl: string,
  failures: string[],
): Indicator {
  return {
    id,
    title,
    value: 0,
    displayValue: '暂不可用',
    status: 'watch',
    summary: '部分外部数据源暂时无法访问；其他指标仍会正常展示，本项恢复后会自动更新。',
    threshold: '数据恢复后重新评估',
    updatedAt: '',
    source,
    sourceUrl,
    details: failures.map((failure, index) => ({ label: `数据源错误 ${index + 1}`, value: failure })),
    available: false,
  };
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  response.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');

  if (request.method === 'OPTIONS') {
    response.status(200).end();
    return;
  }
  if (request.method && request.method !== 'GET') {
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const series = await Promise.all([
    settle(() => fetchFred('NCBEILQ027S')),
    settle(() => fetchFred('GDP')),
    settle(() => fetchFred('CP')),
    settle(() => fetchFred('DFII10')),
    settle(() => fetchFred('DGS10')),
    settle(() => fetchFred('INDPRO')),
    settle(() => fetchFred('PAYEMS')),
    settle(() => fetchFred('RRSFS')),
    settle(() => fetchFred('PCEC96')),
    settle(() => fetchFred('HOUST')),
    settle(() => fetchMarket('SPY')),
    settle(() => fetchMarket('RSP')),
  ]);

  const [
    marketCapResult,
    gdpResult,
    profitsResult,
    realYieldResult,
    nominalYieldResult,
    industrialProductionResult,
    payrollsResult,
    realRetailSalesResult,
    realConsumptionResult,
    housingStartsResult,
    spyResult,
    rspResult,
  ] = series;

  const marketCap = marketCapResult.points;
  const gdp = gdpResult.points;
  const profits = profitsResult.points;
  const realYield = realYieldResult.points;
  const nominalYield = nominalYieldResult.points;
  const industrialProduction = industrialProductionResult.points;
  const payrolls = payrollsResult.points;
  const realRetailSales = realRetailSalesResult.points;
  const realConsumption = realConsumptionResult.points;
  const housingStarts = housingStartsResult.points;
  const spy = spyResult.points;
  const rsp = rspResult.points;

  const diagnostics = [
    ['NCBEILQ027S', marketCapResult.error],
    ['GDP', gdpResult.error],
    ['CP', profitsResult.error],
    ['DFII10', realYieldResult.error],
    ['DGS10', nominalYieldResult.error],
    ['INDPRO', industrialProductionResult.error],
    ['PAYEMS', payrollsResult.error],
    ['RRSFS', realRetailSalesResult.error],
    ['PCEC96', realConsumptionResult.error],
    ['HOUST', housingStartsResult.error],
    ['SPY', spyResult.error],
    ['RSP', rspResult.error],
  ].flatMap(([name, error]) => error ? [{ source: name, error }] : []);

  const alignedMarket = marketCap.length && gdp.length
    ? alignByDate(marketCap, gdp)
      .filter((point) => point.date >= '1970-01-01')
      .map((point) => ({
        date: point.date,
        ratio: ((point.left / 1000) / point.right) * 100,
        marketCapBillions: point.left / 1000,
        gdpBillions: point.right,
      }))
    : [];
  const latestMarket = alignedMarket.at(-1);

  const spyLatest = spy.at(-1);
  const spyQuarterEnd = latestMarket && spy.length ? onOrBefore(spy, quarterEnd(latestMarket.date)) : undefined;
  const nowcastFactor = spyLatest && spyQuarterEnd ? spyLatest.value / spyQuarterEnd.value : 1;
  const nowcastBuffett = latestMarket ? latestMarket.ratio * nowcastFactor : undefined;
  const nowcastMarketCap = latestMarket ? latestMarket.marketCapBillions * nowcastFactor : undefined;

  const indicators: Indicator[] = [];

  if (latestMarket && nowcastBuffett !== undefined) {
    const logRatios = alignedMarket.map((point) => Math.log(point.ratio));
    const trend = linearRegression(logRatios);
    const currentTrendLog = trend.intercept + trend.slope * logRatios.length;
    const currentResidual = Math.log(nowcastBuffett) - currentTrendLog;
    const residualStd = standardDeviation(trend.residuals);
    const buffettZ = residualStd === 0 ? 0 : currentResidual / residualStd;
    const buffettPercentile = percentileRank(trend.residuals, currentResidual);
    indicators.push({
      id: 'buffett',
      title: '趋势调整巴菲特指标',
      value: buffettZ,
      displayValue: `${nowcastBuffett.toFixed(0)}% / ${buffettZ.toFixed(1)}σ`,
      status: statusByThreshold(buffettZ, 1.5, 2.5),
      summary: spyLatest
        ? `季度总市值/GDP，并用 SPY 从季度末外推到当前。历史趋势残差位于约 ${buffettPercentile.toFixed(0)} 分位。`
        : `季度总市值/GDP。市场行情源暂不可用，本次未做季度末至当前的价格外推；历史趋势残差位于约 ${buffettPercentile.toFixed(0)} 分位。`,
      threshold: '关注 ≥ 1.5σ；警告 ≥ 2.5σ',
      updatedAt: spyLatest?.date ?? latestMarket.date,
      source: spyLatest ? 'Federal Reserve Z.1、BEA GDP、Yahoo/Stooq SPY' : 'Federal Reserve Z.1、BEA GDP',
      sourceUrl: 'https://fred.stlouisfed.org/series/NCBEILQ027S',
      details: [
        { label: '季度原始值', value: formatPercent(latestMarket.ratio, 1) },
        { label: 'SPY 外推系数', value: spyLatest ? nowcastFactor.toFixed(3) : '未使用' },
        { label: '历史分位', value: `${buffettPercentile.toFixed(0)}%` },
      ],
      available: true,
    });
  } else {
    indicators.push(unavailableIndicator(
      'buffett',
      '趋势调整巴菲特指标',
      'Federal Reserve Z.1、BEA GDP',
      'https://fred.stlouisfed.org/series/NCBEILQ027S',
      [marketCapResult.error, gdpResult.error].filter((value): value is string => Boolean(value)),
    ));
  }

  const alignedProfits = profits.length && gdp.length
    ? alignByDate(profits, gdp).map((point) => ({
      date: point.date,
      share: (point.left / point.right) * 100,
      profit: point.left,
    }))
    : [];
  const latestProfit = alignedProfits.at(-1);

  if (latestProfit) {
    const profitYearAgo = alignedProfits.at(-5);
    const profitYoY = profitYearAgo ? changePercent(latestProfit.profit, profitYearAgo.profit) : 0;
    const profitAverage = average(alignedProfits.slice(-12).map((point) => point.share));
    const profitStatus: Status = profitYoY <= -10 && latestProfit.share < profitAverage
      ? 'warning'
      : profitYoY <= -5 || latestProfit.share < profitAverage * 0.95
        ? 'watch'
        : 'healthy';
    indicators.push({
      id: 'profit-margin',
      title: '企业利润占 GDP',
      value: latestProfit.share,
      displayValue: formatPercent(latestProfit.share, 1),
      status: profitStatus,
      summary: '用全美企业税后利润/GDP衡量利润池是否正在收缩，属于季度基本面指标。',
      threshold: '关注：利润同比 ≤ -5%；警告：≤ -10% 且低于三年均值',
      updatedAt: latestProfit.date,
      source: 'BEA via FRED：CP / GDP',
      sourceUrl: 'https://fred.stlouisfed.org/series/CP',
      details: [
        { label: '利润同比', value: formatSigned(profitYoY, 1) },
        { label: '三年均值', value: formatPercent(profitAverage, 1) },
        { label: '当前利润额', value: `$${latestProfit.profit.toFixed(0)}B` },
      ],
      available: true,
    });
  } else {
    indicators.push(unavailableIndicator(
      'profit-margin',
      '企业利润占 GDP',
      'BEA via FRED：CP / GDP',
      'https://fred.stlouisfed.org/series/CP',
      [profitsResult.error, gdpResult.error].filter((value): value is string => Boolean(value)),
    ));
  }

  const breadthInputs = [
    { name: '企业税后利润', result: profitsResult, lag: 4 },
    { name: '工业生产', result: industrialProductionResult, lag: 12 },
    { name: '非农就业', result: payrollsResult, lag: 12 },
    { name: '实际零售销售', result: realRetailSalesResult, lag: 12 },
    { name: '实际个人消费', result: realConsumptionResult, lag: 12 },
    { name: '新屋开工', result: housingStartsResult, lag: 12 },
  ];
  const breadthSeries = breadthInputs.flatMap((series) => {
    if (!series.result.points.length) return [];
    const current = latest(series.result.points);
    const previous = lag(series.result.points, series.lag);
    if (!previous) return [];
    const growth = changePercent(current.value, previous.value);
    return [{ name: series.name, growth, positive: growth > 0, updatedAt: current.date }];
  });

  if (breadthSeries.length >= 4) {
    const breadth = (breadthSeries.filter((item) => item.positive).length / breadthSeries.length) * 100;
    indicators.push({
      id: 'earnings-breadth',
      title: '盈利扩散代理',
      value: breadth,
      displayValue: formatPercent(breadth, 0),
      status: statusByThreshold(breadth, 60, 40, false),
      summary: `以 ${breadthSeries.length} 项可用的利润、需求和就业序列同比为正比例做代理；单个数据源失败不会拖垮整页。`,
      threshold: '关注 ≤ 60%；警告 ≤ 40%',
      updatedAt: breadthSeries.map((item) => item.updatedAt).sort().at(0) ?? '',
      source: 'BEA、Federal Reserve、BLS、Census via FRED',
      sourceUrl: 'https://fred.stlouisfed.org/',
      details: breadthSeries.map((item) => ({ label: item.name, value: formatSigned(item.growth, 1) })),
      available: true,
    });
  } else {
    indicators.push(unavailableIndicator(
      'earnings-breadth',
      '盈利扩散代理',
      'BEA、Federal Reserve、BLS、Census via FRED',
      'https://fred.stlouisfed.org/',
      breadthInputs.flatMap((input) => input.result.error ? [`${input.name}: ${input.result.error}`] : []),
    ));
  }

  const latestRealYield = realYield.at(-1);
  const latestNominalYield = nominalYield.at(-1);
  if (latestRealYield) {
    const realYieldThreeMonthsAgo = onOrBefore(realYield, new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10));
    const realYieldChange = latestRealYield.value - (realYieldThreeMonthsAgo?.value ?? latestRealYield.value);
    const realYieldStatus: Status = latestRealYield.value >= 2.5 || realYieldChange >= 0.75
      ? 'warning'
      : latestRealYield.value >= 2 || realYieldChange >= 0.4
        ? 'watch'
        : 'healthy';
    indicators.push({
      id: 'real-yield',
      title: '10 年期实际利率',
      value: latestRealYield.value,
      displayValue: formatPercent(latestRealYield.value, 2),
      status: realYieldStatus,
      summary: '实际无风险利率越高，对高久期股票估值和融资条件的压力越大。',
      threshold: '关注 ≥ 2.0% 或三个月 +40bp；警告 ≥ 2.5% 或 +75bp',
      updatedAt: latestRealYield.date,
      source: 'U.S. Treasury via FRED：DFII10',
      sourceUrl: 'https://fred.stlouisfed.org/series/DFII10',
      details: [
        { label: '三个月变化', value: `${realYieldChange >= 0 ? '+' : ''}${(realYieldChange * 100).toFixed(0)}bp` },
        { label: '名义十年期', value: latestNominalYield ? formatPercent(latestNominalYield.value, 2) : '暂不可用' },
      ],
      available: true,
    });
  } else {
    indicators.push(unavailableIndicator(
      'real-yield',
      '10 年期实际利率',
      'U.S. Treasury via FRED：DFII10',
      'https://fred.stlouisfed.org/series/DFII10',
      [realYieldResult.error].filter((value): value is string => Boolean(value)),
    ));
  }

  if (latestProfit && nowcastMarketCap && latestNominalYield) {
    const earningsYield = (latestProfit.profit / nowcastMarketCap) * 100;
    const equityRiskPremium = earningsYield - latestNominalYield.value;
    indicators.push({
      id: 'erp',
      title: '股票风险溢价代理',
      value: equityRiskPremium,
      displayValue: formatPercent(equityRiskPremium, 2),
      status: statusByThreshold(equityRiskPremium, 1.5, 0, false),
      summary: '以全美企业税后利润/估算总市值作为盈利收益率，再减去十年期国债收益率；不是分析师远期 ERP。',
      threshold: '关注 ≤ 1.5%；警告 ≤ 0%',
      updatedAt: latestNominalYield.date,
      source: spyLatest ? 'BEA、Federal Reserve、Yahoo/Stooq' : 'BEA、Federal Reserve（未做 SPY 外推）',
      sourceUrl: 'https://fred.stlouisfed.org/series/DGS10',
      details: [
        { label: '利润收益率代理', value: formatPercent(earningsYield, 2) },
        { label: '十年期国债', value: formatPercent(latestNominalYield.value, 2) },
      ],
      available: true,
    });
  } else {
    indicators.push(unavailableIndicator(
      'erp',
      '股票风险溢价代理',
      'BEA、Federal Reserve',
      'https://fred.stlouisfed.org/series/DGS10',
      [profitsResult.error, marketCapResult.error, nominalYieldResult.error].filter((value): value is string => Boolean(value)),
    ));
  }

  const spyMap = new Map(spy.map((point) => [point.date, point.value]));
  const relativeSeries = rsp.flatMap((point) => {
    const spyValue = spyMap.get(point.date);
    return spyValue === undefined ? [] : [{ date: point.date, value: point.value / spyValue }];
  });

  if (relativeSeries.length >= 200) {
    const latestRelative = latest(relativeSeries);
    const relativeMa200 = average(relativeSeries.slice(-200).map((point) => point.value));
    const relativeVsMa = ((latestRelative.value / relativeMa200) - 1) * 100;
    const relativeSixMonthsAgo = relativeSeries.at(-127);
    const relativeSixMonthChange = relativeSixMonthsAgo
      ? changePercent(latestRelative.value, relativeSixMonthsAgo.value)
      : 0;
    const equalWeightStatus: Status = relativeVsMa <= -5 && relativeSixMonthChange < 0
      ? 'warning'
      : relativeVsMa < 0 || relativeSixMonthChange < -3
        ? 'watch'
        : 'healthy';
    indicators.push({
      id: 'equal-weight',
      title: '等权重相对表现',
      value: relativeVsMa,
      displayValue: formatSigned(relativeVsMa, 1),
      status: equalWeightStatus,
      summary: 'RSP/SPY 比率相对 200 日均线。持续走弱意味着上涨集中在少数超大市值公司。',
      threshold: '关注：跌破 200 日均线；警告：低于均线 5% 且六个月仍下行',
      updatedAt: latestRelative.date,
      source: 'Yahoo Finance（失败时回退 Stooq）：RSP / SPY',
      sourceUrl: 'https://finance.yahoo.com/quote/RSP/',
      details: [
        { label: '六个月变化', value: formatSigned(relativeSixMonthChange, 1) },
        { label: '当前 RSP/SPY', value: latestRelative.value.toFixed(4) },
        { label: '200 日均值', value: relativeMa200.toFixed(4) },
      ],
      available: true,
    });
  } else {
    indicators.push(unavailableIndicator(
      'equal-weight',
      '等权重相对表现',
      'Yahoo Finance / Stooq：RSP / SPY',
      'https://finance.yahoo.com/quote/RSP/',
      [spyResult.error, rspResult.error, relativeSeries.length ? `可对齐交易日不足：${relativeSeries.length}` : undefined]
        .filter((value): value is string => Boolean(value)),
    ));
  }

  const fundamentalIds = new Set(['profit-margin', 'earnings-breadth', 'equal-weight']);
  const availableFundamentals = indicators.filter((item) => fundamentalIds.has(item.id) && item.available);
  const fundamentalWarnings = availableFundamentals.filter((item) => item.status === 'warning');
  const fundamentalWatches = availableFundamentals.filter((item) => item.status === 'watch');
  const valuationWarnings = indicators.filter((item) => !fundamentalIds.has(item.id) && item.available && item.status === 'warning');
  const unavailableCount = indicators.filter((item) => !item.available).length;

  const enoughFundamentalData = availableFundamentals.length >= 2;
  const fundamentalAlertActive = enoughFundamentalData && (
    fundamentalWarnings.length >= 2
    || (fundamentalWarnings.length >= 1 && fundamentalWatches.length >= 2)
  );
  const overallLevel: 'stable' | 'fragile' | 'deteriorating' = fundamentalAlertActive
    ? 'deteriorating'
    : unavailableCount > 0
      || fundamentalWarnings.length + fundamentalWatches.length >= 2
      || valuationWarnings.length >= 2
      ? 'fragile'
      : 'stable';

  const reasons = fundamentalAlertActive
    ? [...fundamentalWarnings, ...fundamentalWatches].map((item) => `${item.title}：${item.displayValue}`)
    : unavailableCount > 0
      ? [`${unavailableCount} 项指标的数据源暂不可用，其余指标已正常计算`]
      : valuationWarnings.length
        ? valuationWarnings.map((item) => `${item.title}处于警告区间`)
        : ['利润、扩散与市场广度尚未同时跌破阈值'];

  response.status(200).json({
    generatedAt: new Date().toISOString(),
    overall: {
      level: overallLevel,
      fundamentalAlertActive,
      headline: fundamentalAlertActive
        ? '基本面恶化阈值已被触发'
        : unavailableCount > 0
          ? '部分数据源暂不可用，页面已进入降级模式'
          : overallLevel === 'fragile'
            ? '基本面尚未恶化，但市场脆弱性偏高'
            : '基本面未触发恶化警报',
      reasons,
    },
    indicators,
    diagnostics,
    methodology: {
      fundamentalRule: '利润占 GDP、盈利扩散代理、等权重相对表现三项中：至少两项警告，或一项警告加两项关注，即触发基本面恶化。不可用指标不参与触发。',
      caveat: '该页面用于监测风险状态，不构成投资建议。季度序列存在发布滞后和后续修订；单一数据源故障时页面会局部降级而不是整体失败。',
    },
  });
}
