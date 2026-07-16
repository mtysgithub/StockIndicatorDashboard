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
};

const FRED_CSV = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=';
const YAHOO_CHART = 'https://query1.finance.yahoo.com/v8/finance/chart/';

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
  const slope = xs.reduce((sum, x, index) => sum + (x - xMean) * (values[index] - yMean), 0) / denominator;
  const intercept = yMean - slope * xMean;
  const residuals = values.map((value, index) => value - (intercept + slope * index));
  return { intercept, slope, residuals };
}

function quarterEnd(date: string): string {
  const [yearText, monthText] = date.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const quarter = Math.floor((month - 1) / 3) + 1;
  const endMonth = quarter * 3;
  const endDate = new Date(Date.UTC(year, endMonth, 0));
  return endDate.toISOString().slice(0, 10);
}

function onOrBefore(points: Point[], targetDate: string): Point | undefined {
  for (let index = points.length - 1; index >= 0; index -= 1) {
    if (points[index].date <= targetDate) return points[index];
  }
  return undefined;
}

async function fetchFred(seriesId: string): Promise<Point[]> {
  const response = await fetch(`${FRED_CSV}${encodeURIComponent(seriesId)}`, {
    headers: { 'User-Agent': 'StockIndicatorDashboard/1.0' },
  });
  if (!response.ok) throw new Error(`FRED ${seriesId} failed: ${response.status}`);

  const text = await response.text();
  return text
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .flatMap((line) => {
      const [date, rawValue] = line.split(',');
      const value = Number(rawValue);
      return date && Number.isFinite(value) ? [{ date, value }] : [];
    });
}

async function fetchYahoo(symbol: string): Promise<Point[]> {
  const url = `${YAHOO_CHART}${encodeURIComponent(symbol)}?range=2y&interval=1d&events=div%2Csplits`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 StockIndicatorDashboard/1.0',
      Accept: 'application/json',
    },
  });
  if (!response.ok) throw new Error(`Yahoo ${symbol} failed: ${response.status}`);

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

  if (payload.chart?.error) throw new Error(payload.chart.error.description ?? `Yahoo ${symbol} error`);
  const result = payload.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const closes = result?.indicators?.adjclose?.[0]?.adjclose ?? result?.indicators?.quote?.[0]?.close ?? [];

  return timestamps.flatMap((timestamp, index) => {
    const value = closes[index];
    if (value === null || value === undefined || !Number.isFinite(value)) return [];
    return [{ date: new Date(timestamp * 1000).toISOString().slice(0, 10), value }];
  });
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

  try {
    const [
      marketCap,
      gdp,
      profits,
      realYield,
      nominalYield,
      industrialProduction,
      payrolls,
      realRetailSales,
      realConsumption,
      housingStarts,
      spy,
      rsp,
    ] = await Promise.all([
      fetchFred('NCBEILQ027S'),
      fetchFred('GDP'),
      fetchFred('CP'),
      fetchFred('DFII10'),
      fetchFred('DGS10'),
      fetchFred('INDPRO'),
      fetchFred('PAYEMS'),
      fetchFred('RRSFS'),
      fetchFred('PCEC96'),
      fetchFred('HOUST'),
      fetchYahoo('SPY'),
      fetchYahoo('RSP'),
    ]);

    const alignedMarket = alignByDate(marketCap, gdp)
      .filter((point) => point.date >= '1970-01-01')
      .map((point) => ({
        date: point.date,
        ratio: ((point.left / 1000) / point.right) * 100,
        marketCapBillions: point.left / 1000,
        gdpBillions: point.right,
      }));
    const latestMarket = alignedMarket.at(-1);
    if (!latestMarket) throw new Error('Unable to align market-cap and GDP series');

    const spyLatest = latest(spy);
    const spyQuarterEnd = onOrBefore(spy, quarterEnd(latestMarket.date));
    const nowcastFactor = spyQuarterEnd ? spyLatest.value / spyQuarterEnd.value : 1;
    const nowcastBuffett = latestMarket.ratio * nowcastFactor;
    const nowcastMarketCap = latestMarket.marketCapBillions * nowcastFactor;

    const logRatios = alignedMarket.map((point) => Math.log(point.ratio));
    const trend = linearRegression(logRatios);
    const currentTrendLog = trend.intercept + trend.slope * logRatios.length;
    const currentResidual = Math.log(nowcastBuffett) - currentTrendLog;
    const residualStd = standardDeviation(trend.residuals);
    const buffettZ = residualStd === 0 ? 0 : currentResidual / residualStd;
    const buffettPercentile = percentileRank(trend.residuals, currentResidual);
    const buffettStatus = statusByThreshold(buffettZ, 1.5, 2.5);

    const alignedProfits = alignByDate(profits, gdp).map((point) => ({
      date: point.date,
      share: (point.left / point.right) * 100,
      profit: point.left,
    }));
    const latestProfit = alignedProfits.at(-1);
    if (!latestProfit) throw new Error('Unable to align profit and GDP series');
    const profitYearAgo = alignedProfits.at(-5);
    const profitYoY = profitYearAgo ? changePercent(latestProfit.profit, profitYearAgo.profit) : 0;
    const recentProfitShares = alignedProfits.slice(-12).map((point) => point.share);
    const profitAverage = average(recentProfitShares);
    const profitStatus: Status = profitYoY <= -10 && latestProfit.share < profitAverage
      ? 'warning'
      : profitYoY <= -5 || latestProfit.share < profitAverage * 0.95
        ? 'watch'
        : 'healthy';

    const breadthSeries = [
      { name: '企业税后利润', points: profits, lag: 4 },
      { name: '工业生产', points: industrialProduction, lag: 12 },
      { name: '非农就业', points: payrolls, lag: 12 },
      { name: '实际零售销售', points: realRetailSales, lag: 12 },
      { name: '实际个人消费', points: realConsumption, lag: 12 },
      { name: '新屋开工', points: housingStarts, lag: 12 },
    ].map((series) => {
      const current = latest(series.points);
      const previous = lag(series.points, series.lag);
      const growth = previous ? changePercent(current.value, previous.value) : 0;
      return { name: series.name, growth, positive: growth > 0, updatedAt: current.date };
    });
    const breadth = (breadthSeries.filter((item) => item.positive).length / breadthSeries.length) * 100;
    const breadthStatus = statusByThreshold(breadth, 60, 40, false);

    const latestRealYield = latest(realYield);
    const realYieldThreeMonthsAgo = onOrBefore(realYield, new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10));
    const realYieldChange = latestRealYield.value - (realYieldThreeMonthsAgo?.value ?? latestRealYield.value);
    const realYieldStatus: Status = latestRealYield.value >= 2.5 || realYieldChange >= 0.75
      ? 'warning'
      : latestRealYield.value >= 2 || realYieldChange >= 0.4
        ? 'watch'
        : 'healthy';

    const latestNominalYield = latest(nominalYield);
    const earningsYield = (latestProfit.profit / nowcastMarketCap) * 100;
    const equityRiskPremium = earningsYield - latestNominalYield.value;
    const erpStatus = statusByThreshold(equityRiskPremium, 1.5, 0, false);

    const spyMap = new Map(spy.map((point) => [point.date, point.value]));
    const relativeSeries = rsp.flatMap((point) => {
      const spyValue = spyMap.get(point.date);
      return spyValue === undefined ? [] : [{ date: point.date, value: point.value / spyValue }];
    });
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

    const indicators: Indicator[] = [
      {
        id: 'buffett',
        title: '趋势调整巴菲特指标',
        value: buffettZ,
        displayValue: `${nowcastBuffett.toFixed(0)}% / ${buffettZ.toFixed(1)}σ`,
        status: buffettStatus,
        summary: `季度总市值/GDP，并用 SPY 从季度末外推到当前。历史趋势残差位于约 ${buffettPercentile.toFixed(0)} 分位。`,
        threshold: '关注 ≥ 1.5σ；警告 ≥ 2.5σ',
        updatedAt: spyLatest.date,
        source: 'Federal Reserve Z.1、BEA GDP、Yahoo Finance SPY',
        sourceUrl: 'https://fred.stlouisfed.org/series/NCBEILQ027S',
        details: [
          { label: '季度原始值', value: formatPercent(latestMarket.ratio, 1) },
          { label: 'SPY 外推系数', value: nowcastFactor.toFixed(3) },
          { label: '历史分位', value: `${buffettPercentile.toFixed(0)}%` },
        ],
      },
      {
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
      },
      {
        id: 'earnings-breadth',
        title: '盈利扩散代理',
        value: breadth,
        displayValue: formatPercent(breadth, 0),
        status: breadthStatus,
        summary: '免费实时数据无法稳定获得全部标普成分股盈利修正，因此使用六项利润/需求/就业序列同比为正的比例做代理。',
        threshold: '关注 ≤ 60%；警告 ≤ 40%',
        updatedAt: breadthSeries.map((item) => item.updatedAt).sort().at(0) ?? '',
        source: 'BEA、Federal Reserve、BLS、Census via FRED',
        sourceUrl: 'https://fred.stlouisfed.org/',
        details: breadthSeries.map((item) => ({ label: item.name, value: formatSigned(item.growth, 1) })),
      },
      {
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
          { label: '名义十年期', value: formatPercent(latestNominalYield.value, 2) },
        ],
      },
      {
        id: 'erp',
        title: '股票风险溢价代理',
        value: equityRiskPremium,
        displayValue: formatPercent(equityRiskPremium, 2),
        status: erpStatus,
        summary: '以全美企业税后利润/估算总市值作为盈利收益率，再减去十年期国债收益率；不是分析师远期 ERP。',
        threshold: '关注 ≤ 1.5%；警告 ≤ 0%',
        updatedAt: latestNominalYield.date,
        source: 'BEA、Federal Reserve、Yahoo Finance',
        sourceUrl: 'https://fred.stlouisfed.org/series/DGS10',
        details: [
          { label: '利润收益率代理', value: formatPercent(earningsYield, 2) },
          { label: '十年期国债', value: formatPercent(latestNominalYield.value, 2) },
        ],
      },
      {
        id: 'equal-weight',
        title: '等权重相对表现',
        value: relativeVsMa,
        displayValue: formatSigned(relativeVsMa, 1),
        status: equalWeightStatus,
        summary: 'RSP/SPY 比率相对 200 日均线。持续走弱意味着上涨集中在少数超大市值公司。',
        threshold: '关注：跌破 200 日均线；警告：低于均线 5% 且六个月仍下行',
        updatedAt: latestRelative.date,
        source: 'Yahoo Finance：RSP / SPY',
        sourceUrl: 'https://finance.yahoo.com/quote/RSP/',
        details: [
          { label: '六个月变化', value: formatSigned(relativeSixMonthChange, 1) },
          { label: '当前 RSP/SPY', value: latestRelative.value.toFixed(4) },
          { label: '200 日均值', value: relativeMa200.toFixed(4) },
        ],
      },
    ];

    const fundamentalIds = new Set(['profit-margin', 'earnings-breadth', 'equal-weight']);
    const fundamentalWarnings = indicators.filter((item) => fundamentalIds.has(item.id) && item.status === 'warning');
    const fundamentalWatches = indicators.filter((item) => fundamentalIds.has(item.id) && item.status === 'watch');
    const valuationWarnings = indicators.filter((item) => !fundamentalIds.has(item.id) && item.status === 'warning');

    const fundamentalAlertActive = fundamentalWarnings.length >= 2
      || (fundamentalWarnings.length >= 1 && fundamentalWatches.length >= 2);
    const overallLevel: 'stable' | 'fragile' | 'deteriorating' = fundamentalAlertActive
      ? 'deteriorating'
      : fundamentalWarnings.length + fundamentalWatches.length >= 2 || valuationWarnings.length >= 2
        ? 'fragile'
        : 'stable';

    response.status(200).json({
      generatedAt: new Date().toISOString(),
      overall: {
        level: overallLevel,
        fundamentalAlertActive,
        headline: fundamentalAlertActive
          ? '基本面恶化阈值已被触发'
          : overallLevel === 'fragile'
            ? '基本面尚未恶化，但市场脆弱性偏高'
            : '基本面未触发恶化警报',
        reasons: fundamentalAlertActive
          ? [...fundamentalWarnings, ...fundamentalWatches].map((item) => `${item.title}：${item.displayValue}`)
          : valuationWarnings.length
            ? valuationWarnings.map((item) => `${item.title}处于警告区间`)
            : ['利润、扩散与市场广度尚未同时跌破阈值'],
      },
      indicators,
      methodology: {
        fundamentalRule: '利润占 GDP、盈利扩散代理、等权重相对表现三项中：至少两项警告，或一项警告加两项关注，即触发基本面恶化。',
        caveat: '该页面用于监测风险状态，不构成投资建议。季度序列存在发布滞后和后续修订。',
      },
    });
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
      generatedAt: new Date().toISOString(),
    });
  }
}
