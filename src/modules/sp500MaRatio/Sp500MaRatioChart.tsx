import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import type { ChartComponentProps } from '../../core/types';
import { fetchDailyCloses } from '../../services/yahooFinance';
import {
  buildRatioSeries,
  movingAverage,
  resampleMonthly,
  resampleWeekly,
  type ResampledPoint,
} from './calculations';
import styles from './Sp500MaRatioChart.module.css';

const START_DATE = new Date(Date.UTC(1950, 0, 1));

interface ChartState {
  monthly: ResampledPoint[];
  weekly: ResampledPoint[];
}

function toSeriesData(points: ResampledPoint[]) {
  return points.map((point) => [point.time, Number(point.value.toFixed(4))]);
}

function buildOption(state: ChartState) {
  return {
    textStyle: {
      fontFamily: 'Inter, sans-serif',
      color: '#dbeafe',
    },
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value: number) => value.toFixed(2),
    },
    legend: {
      data: ['月线比率', '周线比率'],
      top: 0,
      textStyle: {
        color: 'rgba(226,232,240,0.8)',
      },
    },
    grid: [
      { left: 60, right: 20, top: 60, height: '36%' },
      { left: 60, right: 20, top: '58%', height: '32%' },
    ],
    xAxis: [
      {
        type: 'time',
        gridIndex: 0,
        axisLabel: { color: 'rgba(148, 163, 184, 0.7)' },
      },
      {
        type: 'time',
        gridIndex: 1,
        axisLabel: { color: 'rgba(148, 163, 184, 0.7)' },
      },
    ],
    yAxis: [
      {
        type: 'value',
        gridIndex: 0,
        name: 'Close / MA100',
        nameTextStyle: { color: 'rgba(148, 163, 184, 0.8)', fontSize: 12 },
        splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.15)' } },
      },
      {
        type: 'value',
        gridIndex: 1,
        name: 'Close / MA100',
        nameTextStyle: { color: 'rgba(148, 163, 184, 0.8)', fontSize: 12 },
        splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.15)' } },
      },
    ],
    series: [
      {
        name: '月线比率',
        type: 'line',
        xAxisIndex: 0,
        yAxisIndex: 0,
        symbol: 'none',
        smooth: true,
        lineStyle: { width: 2, color: '#60a5fa' },
        data: toSeriesData(state.monthly),
        markLine: {
          silent: true,
          data: [
            { yAxis: 1.7, lineStyle: { color: '#f87171' }, label: { formatter: '警戒 1.7' } },
            { yAxis: 1.0, lineStyle: { color: 'rgba(148,163,184,0.7)', type: 'dashed' } },
          ],
        },
        areaStyle: {
          opacity: 0.08,
          color: '#60a5fa',
        },
      },
      {
        name: '周线比率',
        type: 'line',
        xAxisIndex: 1,
        yAxisIndex: 1,
        symbol: 'none',
        smooth: true,
        lineStyle: { width: 2, color: '#34d399' },
        data: toSeriesData(state.weekly),
        markLine: {
          silent: true,
          data: [
            { yAxis: 1.3, lineStyle: { color: '#f97316' }, label: { formatter: '警戒 1.3' } },
            { yAxis: 1.0, lineStyle: { color: 'rgba(148,163,184,0.7)', type: 'dashed' } },
          ],
        },
        areaStyle: {
          opacity: 0.08,
          color: '#34d399',
        },
      },
    ],
  };
}

const chartStyle = { height: 420 };

const Sp500MaRatioChart = ({ refreshIndex, context }: ChartComponentProps) => {
  const [state, setState] = useState<ChartState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rawData = await fetchDailyCloses('^GSPC', START_DATE);
      const monthly = resampleMonthly(rawData);
      const weekly = resampleWeekly(rawData);

      const monthlyMa = movingAverage(monthly, 100);
      const weeklyMa = movingAverage(weekly, 100);

      const monthlyRatio = buildRatioSeries(monthly, monthlyMa);
      const weeklyRatio = buildRatioSeries(weekly, weeklyMa);

      setState({ monthly: monthlyRatio, weekly: weeklyRatio });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshIndex]);

  const option = useMemo(() => (state ? buildOption(state) : undefined), [state]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.metaRow}>
        <div>
          <h3>S&P 500 收盘与 MA100 比率</h3>
          <p>使用 Yahoo Finance 日线数据重建周线与月线比值，观测极端扩张风险。</p>
        </div>
        <button onClick={context.requestRefresh} disabled={loading} className={styles.refreshButton}>
          {loading ? '刷新中…' : '立即刷新'}
        </button>
      </div>
      {error ? (
        <div className={styles.errorBox}>
          <strong>数据加载失败：</strong>
          <span>{error}</span>
        </div>
      ) : null}
      {option ? (
        <ReactECharts option={option} notMerge style={chartStyle} theme="dark" />
      ) : (
        <div className={styles.placeholder}>准备图表数据...</div>
      )}
      <p className={styles.caption}>
        阈值线来自原始 Python 脚本，默认每 6 小时自动刷新，可通过 chartRegistry 调整。
      </p>
    </div>
  );
};

export default Sp500MaRatioChart;
