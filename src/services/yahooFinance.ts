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

function assertResultPayload(payload: YahooChartResponse): asserts payload is YahooChartResponse {
  if (!payload.chart || !Array.isArray(payload.chart.result) || !payload.chart.result.length) {
    throw new Error('Empty Yahoo Finance response.');
  }
}

export async function fetchDailyCloses(
  symbol: string,
  start: Date,
  end: Date = new Date(),
): Promise<CandlePoint[]> {
  const period1 = Math.floor(start.getTime() / 1000);
  const period2 = Math.floor(end.getTime() / 1000);
  const url = new URL(encodeURIComponent(symbol), YAHOO_CHART_ENDPOINT);
  url.searchParams.set('interval', '1d');
  url.searchParams.set('period1', `${period1}`);
  url.searchParams.set('period2', `${period2}`);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Yahoo Finance 请求失败：${response.status}`);
  }

  const payload = (await response.json()) as YahooChartResponse;
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
}
