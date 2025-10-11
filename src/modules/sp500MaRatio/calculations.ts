import type { CandlePoint } from '../../services/yahooFinance';

export interface ResampledPoint {
  time: number;
  value: number;
}

function toUtcDate(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function resampleMonthly(data: CandlePoint[]): ResampledPoint[] {
  const buckets = new Map<string, CandlePoint>();
  data.forEach((item) => {
    const date = new Date(item.time);
    const monthKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    const prev = buckets.get(monthKey);
    if (!prev || item.time > prev.time) {
      buckets.set(monthKey, item);
    }
  });
  return Array.from(buckets.values())
    .sort((a, b) => a.time - b.time)
    .map((item) => ({ time: item.time, value: item.close }));
}

function getFridayKey(date: Date) {
  const utc = toUtcDate(date);
  const day = utc.getUTCDay();
  const offset = 5 - day;
  utc.setUTCDate(utc.getUTCDate() + offset);
  return `${utc.getUTCFullYear()}-${String(utc.getUTCMonth() + 1).padStart(2, '0')}-${String(
    utc.getUTCDate(),
  ).padStart(2, '0')}`;
}

export function resampleWeekly(data: CandlePoint[]): ResampledPoint[] {
  const buckets = new Map<string, CandlePoint>();
  data.forEach((item) => {
    const date = new Date(item.time);
    const key = getFridayKey(date);
    const prev = buckets.get(key);
    if (!prev || item.time > prev.time) {
      buckets.set(key, item);
    }
  });
  return Array.from(buckets.values())
    .sort((a, b) => a.time - b.time)
    .map((item) => ({ time: item.time, value: item.close }));
}

export function movingAverage(points: ResampledPoint[], window: number): Array<number | null> {
  const values: Array<number | null> = [];
  let sum = 0;
  const queue: number[] = [];
  points.forEach((point) => {
    queue.push(point.value);
    sum += point.value;
    if (queue.length > window) {
      sum -= queue.shift() ?? 0;
    }
    if (queue.length === window) {
      values.push(sum / window);
    } else {
      values.push(null);
    }
  });
  return values;
}

export function buildRatioSeries(points: ResampledPoint[], ma: Array<number | null>): ResampledPoint[] {
  return points
    .map((point, index) => {
      const maValue = ma[index];
      if (!maValue) {
        return null;
      }
      return {
        time: point.time,
        value: point.value / maValue,
      };
    })
    .filter((value): value is ResampledPoint => Boolean(value));
}
