# Stock Indicator Dashboard

一个基于 TypeScript、React、Vite 和 Vercel Serverless Functions 的美股宏观风险仪表盘。

## 六项指标

1. **趋势调整巴菲特指标**：美国非金融企业股权市值 / GDP，并用 SPY 对季度数据进行当前值外推，再计算长期趋势残差 Z 分数。
2. **企业利润占 GDP**：全美企业税后利润 / GDP，观察利润池是否收缩。
3. **盈利扩散代理**：利润、工业生产、就业、实际零售、实际消费、新屋开工六项同比为正的比例。
4. **10 年期实际利率**：监测实际折现率水平及三个月变化。
5. **股票风险溢价代理**：企业利润收益率代理减去 10 年期国债收益率。
6. **等权重相对表现**：RSP / SPY 相对 200 日均线，识别市场上涨是否过度集中。

页面将估值压力与基本面恶化分开判定。基本面三项为企业利润、盈利扩散代理和等权重相对表现；当至少两项进入警告，或一项警告加两项关注时，页面显示“基本面恶化阈值已被触发”。

## 本地运行

```bash
npm install
npm run dev
```

Vite 开发服务器默认运行在 `http://localhost:5173`。本地开发时 `/api/macro-dashboard` 需要由兼容 Vercel Functions 的本地环境提供，推荐：

```bash
npm install -g vercel
vercel dev
```

## 部署到 Vercel

1. 在 Vercel 导入 `mtysgithub/StockIndicatorDashboard`。
2. Framework Preset 选择 **Vite**。
3. Build Command 使用 `npm run build`，Output Directory 使用 `dist`。
4. 无需 API Key。后端直接读取 FRED CSV 与 Yahoo Finance 公开行情接口。
5. 部署后刷新页面时会请求 `/api/macro-dashboard`。Vercel CDN 缓存六小时，并允许一天的 stale-while-revalidate。

已有的 `/api/yahoo-chart` 代理仍保留，供旧图表模块或后续扩展使用。

## 数据口径与限制

- FRED/BEA 季度数据存在发布滞后和修订；页面会显示各指标自己的数据截止日期。
- “盈利扩散代理”和“股票风险溢价代理”是无需商业数据订阅的透明替代口径，不等同于 FactSet 成分股盈利修正广度或分析师远期 ERP。
- 巴菲特指标当前值由最近季度总市值/GDP乘以 SPY 自季度末以来的价格变化估算。
- 本工具用于风险监测，不构成投资建议。

## 构建

```bash
npm run build
```
