# Stock Indicator Dashboard

一个基于 TypeScript、React、Vite 和 Vercel Serverless Functions 的可扩展美股指标系统。

## 两层增量架构

系统不再由单一页面直接占用入口，而是分成两层注册机制：

1. **指标集合注册表 `dashboardRegistry`**：管理宏观风险、技术指标、流动性、信用周期等独立页面集合。
2. **图表注册表 `chartRegistry`**：管理某个集合内部的单张懒加载图表及刷新周期。

当前注册了两个集合：

- **技术指标图表**：保留原有 S&P 500 与 100 周 / 100 月均线比率图表、ECharts 模块、自动刷新和手动刷新能力。
- **宏观与基本面风险**：六项估值、利润、利率与市场广度指标，以及组合警报。

页面使用 URL hash 保存当前集合，例如 `#technical-indicators` 和 `#macro-fundamentals`。新增集合不需要替换 `App.tsx`，只需新增集合组件并在 `src/dashboards/registerDashboards.ts` 注册。

详细扩展方式见 [`docs/DASHBOARD_COLLECTION_GUIDE.md`](docs/DASHBOARD_COLLECTION_GUIDE.md)。单图表扩展继续参考 [`docs/CHART_MODULE_GUIDE.md`](docs/CHART_MODULE_GUIDE.md)。

## 宏观集合的六项指标

1. **趋势调整巴菲特指标**：美国非金融企业股权市值 / GDP，并用 SPY 对季度数据进行当前值外推，再计算长期趋势残差 Z 分数。
2. **企业利润占 GDP**：全美企业税后利润 / GDP，观察利润池是否收缩。
3. **盈利扩散代理**：利润、工业生产、就业、实际零售、实际消费、新屋开工六项同比为正的比例。
4. **10 年期实际利率**：监测实际折现率水平及三个月变化。
5. **股票风险溢价代理**：企业利润收益率代理减去 10 年期国债收益率。
6. **等权重相对表现**：RSP / SPY 相对 200 日均线，识别市场上涨是否过度集中。

基本面三项为企业利润、盈利扩散代理和等权重相对表现；当至少两项进入警告，或一项警告加两项关注时，页面显示“基本面恶化阈值已被触发”。

## 本地运行

```bash
npm install
npm run dev
```

普通 Vite 开发服务器默认运行在 `http://localhost:5173`。需要调用 `/api/macro-dashboard` 时，推荐使用兼容 Vercel Functions 的本地环境：

```bash
npm install -g vercel
vercel dev
```

## 部署到 Vercel

1. 在 Vercel 导入 `mtysgithub/StockIndicatorDashboard`。
2. Framework Preset 选择 **Vite**。
3. Build Command 使用 `npm run build`，Output Directory 使用 `dist`。
4. 无需 API Key。后端读取 FRED CSV 与 Yahoo Finance 公开行情接口。
5. `/api/macro-dashboard` 使用六小时 CDN 缓存，并允许一天的 stale-while-revalidate。
6. `/api/yahoo-chart` 代理继续供原技术图表模块使用。

## 数据口径与限制

- FRED/BEA 季度数据存在发布滞后和修订；页面会显示各指标自己的数据截止日期。
- “盈利扩散代理”和“股票风险溢价代理”是无需商业数据订阅的透明替代口径，不等同于 FactSet 成分股盈利修正广度或分析师远期 ERP。
- 巴菲特指标当前值由最近季度总市值/GDP乘以 SPY 自季度末以来的价格变化估算。
- 本工具用于风险监测，不构成投资建议。

## 构建

```bash
npm run build
```
