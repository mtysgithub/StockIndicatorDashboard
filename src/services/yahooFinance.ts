interface YahooChartResponse {
  chart: {
    result: Array<{
      timestamp: number[];
      indicators: {
        quote: Array<{
          close: Array<number | null>;
        }>;
      };
    }>;
    error?: { description: string } | null;
  };
}

export interface CandlePoint {
  time: number;
  close: number;
}

const YAHOO_CHART_ENDPOINT = 'https://query1.finance.yahoo.com/v8/finance/chart/';
const JINA_PROXY_PREFIX = 'https://r.jina.ai/https://query1.finance.yahoo.com/v8/finance/chart/';

function assertResultPayload(payload: YahooChartResponse): asserts payload is YahooChartResponse {
  if (!payload.chart || !Array.isArray(payload.chart.result) || !payload.chart.result.length) {
    throw new Error('Empty Yahoo Finance response.');
  }
}

async function fetchChartPayload(url: string) {
  const response = await fetch(url, { mode: 'cors' });
  if (!response.ok) {
    throw new Error(`Yahoo Finance 请求失败：${response.status}`);
  }

  const text = await response.text();

  try {
    return JSON.parse(text) as YahooChartResponse;
  } catch (error) {
    throw new Error('Yahoo Finance 响应解析失败。');
  }
}

function buildCandidateUrls(path: string) {
  const urls = [`${YAHOO_CHART_ENDPOINT}${path}`];

  const proxy = import.meta.env.VITE_YAHOO_FINANCE_PROXY?.trim();
  if (proxy) {
    urls.push(`${proxy.replace(/\/$/, '')}/${path}`);
  }

  urls.push(`${JINA_PROXY_PREFIX}${path}`);
  return urls;
}

export async function fetchDailyCloses(
  symbol: string,
  start: Date,
  end: Date = new Date(),
): Promise<CandlePoint[]> {
  const period1 = Math.floor(start.getTime() / 1000);
  const period2 = Math.floor(end.getTime() / 1000);
  const path = `${encodeURIComponent(symbol)}?interval=1d&period1=${period1}&period2=${period2}`;
  const candidateUrls = buildCandidateUrls(path);

  let lastError: Error | null = null;
  for (const url of candidateUrls) {
    try {
      const payload = await fetchChartPayload(url);
      if (payload.chart.error) {
        throw new Error(payload.chart.error.description ?? 'Unknown Yahoo Finance error');
      }

      assertResultPayload(payload);

      const [result] = payload.chart.result;
      const { timestamp, indicators } = result;
      const closes = indicators.quote[0]?.close ?? [];

      const candles: CandlePoint[] = [];
      timestamp.forEach((time, index) => {
        const close = closes[index];
        if (close == null) {
          return;
        }
        candles.push({
          time: time * 1000,
          close,
        });
      });

      return candles;
    } catch (error) {
      lastError = error as Error;
      continue;
    }
  }

  throw lastError ?? new Error('无法请求 Yahoo Finance 数据');
}
