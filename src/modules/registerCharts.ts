import { chartRegistry } from '../core/chartRegistry';

chartRegistry.register({
  id: 'sp500-ma-ratio',
  title: 'S&P 500 与 MA100 比率监控',
  description: '1950 年以来的标普500收盘价与 100 周 / 100 月均线比值，含阈值提示。',
  tags: ['macro', 'indices', 'long-term'],
  defaultRefreshInterval: 1000 * 60 * 60 * 6,
  loader: () => import('./sp500MaRatio/Sp500MaRatioChart'),
});
