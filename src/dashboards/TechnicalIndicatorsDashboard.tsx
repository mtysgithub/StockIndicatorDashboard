import { useMemo } from 'react';
import { ChartGrid } from '../components/ChartGrid';
import { chartRegistry } from '../core/chartRegistry';

export default function TechnicalIndicatorsDashboard() {
  const charts = useMemo(() => chartRegistry.list(), []);

  if (!charts.length) {
    return <p>当前没有注册技术指标图表。</p>;
  }

  return <ChartGrid charts={charts} />;
}
