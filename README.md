# Stock Indicator Dashboard

一个基于 TypeScript + React + Vite 的现代化美股指标仪表盘壳工程。目标是作为 Python 研究成果的展示前端，具备模块化图表管理能力、易于扩展与部署。

## 功能概览

- 🔌 **图表模块管理器**：通过 `chartRegistry` 注册懒加载模块，灵活增删图表。
- ♻️ **可配置刷新机制**：每个图表可以指定默认自动刷新周期，也支持手动刷新。
- 📊 **ECharts 可视化**：提供深色、玻璃拟态风格的仪表盘 UI，并支持复杂图形。
- 🧭 **文档化指引**：`docs/CHART_MODULE_GUIDE.md` 说明如何扩展新的图表模块。

## 快速开始

```bash
npm install
npm run dev
```

开发服务器默认运行在 `http://localhost:5173`，也可以部署至 Vercel 等平台。

## 数据获取与 CORS 代理

Yahoo Finance 官方接口默认不提供跨域头部，因此直接在浏览器环境访问会触发 CORS 拦截。项目的 `fetchDailyCloses` 做了多重容错：

1. **直接请求** `query1.finance.yahoo.com`。
2. **可选代理**：如果在运行环境中设置了 `VITE_YAHOO_FINANCE_PROXY`（例如指向自建的 Vercel Edge/Serverless 代理），则会优先使用该地址。
3. **公共只读代理**：自动回退到 `https://r.jina.ai/` 作为透明缓存，绕过跨域限制。

当前仍无法访问时，图表会自动切换到内置的离线样例数据，并在界面醒目提示。这样至少可以展示图表布局与交互，待代理准备就绪后即可恢复实时行情。

## 目录结构

```
├── src
│   ├── App.tsx                 # 仪表盘入口
│   ├── core/                   # chartRegistry、类型定义
│   ├── components/             # 卡片、网格等 UI 组件
│   ├── layout/                 # 页面布局
│   ├── modules/                # 图表模块注册与实现
│   │   └── sp500MaRatio/       # 首个 Python -> TS 的示例图表
│   ├── services/               # 数据获取服务（Yahoo Finance）
│   └── styles/                 # 全局样式
├── docs/                       # 扩展开发文档
└── index.html                  # Vite 入口页面
```

## 首个示例图表

`sp500MaRatio` 模块将原始 Python 脚本转换为 TS + ECharts 实现，功能包括：

- 从 Yahoo Finance 拉取标普500自 1950 年以来的日线收盘价。
- 计算月线、周线以及对应的 100 周/月均线。
- 绘制 Close/MA100 比率，并叠加 1.7（月线）、1.3（周线）阈值参考线。
- 默认每 6 小时自动刷新，可手动刷新。

## 扩展说明

请参考 [docs/CHART_MODULE_GUIDE.md](docs/CHART_MODULE_GUIDE.md) 获取图表模块的开发流程。

欢迎在此基础上接入更多由 Python 生成的数据或策略，实现开发-部署闭环。
