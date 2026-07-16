import { useMemo } from 'react';
import { DashboardShell } from './components/DashboardShell';
import { dashboardRegistry } from './core/dashboardRegistry';

const App = () => {
  const collections = useMemo(() => dashboardRegistry.list(), []);
  return <DashboardShell collections={collections} />;
};

export default App;
