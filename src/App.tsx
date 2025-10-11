import { useMemo } from 'react';
import { chartRegistry } from './core/chartRegistry';
import { DashboardLayout } from './layout/DashboardLayout';
import { ChartGrid } from './components/ChartGrid';

const App = () => {
  const charts = useMemo(() => chartRegistry.list(), []);

  return (
    <DashboardLayout chartsCount={charts.length}>
      <ChartGrid charts={charts} />
    </DashboardLayout>
  );
};

export default App;
