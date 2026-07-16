import { dashboardRegistry } from '../core/dashboardRegistry';

dashboardRegistry.register({
  id: 'technical-indicators',
  title: '技术指标图表',
  description: '原有的模块化图表集合，包括标普 500 与 100 周 / 100 月均线比率。',
  order: 10,
  tags: ['Chart Registry', 'ECharts', 'Yahoo Finance'],
  loader: () => import('./TechnicalIndicatorsDashboard'),
});

dashboardRegistry.register({
  id: 'macro-fundamentals',
  title: '宏观与基本面风险',
  description: '六项估值、利润、利率和市场广度指标，以及基本面恶化组合警报。',
  order: 20,
  tags: ['FRED', 'BEA', 'Risk Alert'],
  loader: async () => {
    const module = await import('../components/MacroRiskDashboard');
    return { default: module.MacroRiskDashboard };
  },
});
