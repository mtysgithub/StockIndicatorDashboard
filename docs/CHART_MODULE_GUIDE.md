# 图表模块开发指南

该指南帮助你基于现有的仪表盘框架快速添加新的指标图表模块。体系的目标是让前端可以灵活挂载由 Python 研究出的新策略或信号，并允许按需刷新。

## 核心概念

### ChartRegistry
`ChartRegistry` 负责集中登记所有可用图表。每个图表使用 `chartRegistry.register` 进行注册，提供：

- `id`: 全局唯一字符串，用于追踪模块。
- `title`: 图表标题。
- `description`: （可选）补充信息，出现在卡片顶部。
- `tags`: （可选）标签集合，帮助分类过滤。
- `defaultRefreshInterval`: （可选）默认刷新周期（毫秒）。设为 `undefined` 表示仅手动刷新。
- `loader`: 懒加载函数，返回图表组件。

### 图表组件
每个图表组件接受 `ChartComponentProps`：

```ts
interface ChartComponentProps {
  refreshIndex: number;          // 每次刷新会递增，可用于触发 useEffect 重新抓取数据
  context: {
    requestRefresh: () => void;  // 手动触发刷新（用于按钮等）
    refreshInterval: number | null | undefined; // 默认刷新周期
  };
}
```

组件内部负责数据抓取、转换和渲染。可以自由选择图表库，目前默认示例使用 `echarts-for-react`。

## 新增图表的步骤

1. 在 `src/modules/` 下新建目录并创建图表组件文件，例如 `MyCustomChart.tsx`。
2. 实现默认导出组件，按照上述 `ChartComponentProps` 约定处理刷新逻辑。
3. 在 `src/modules/registerCharts.ts` 中通过 `chartRegistry.register` 注册：

```ts
chartRegistry.register({
  id: 'my-custom-chart',
  title: '我的策略',
  description: '描述你的指标',
  tags: ['alpha', 'intraday'],
  defaultRefreshInterval: 1000 * 60 * 5,
  loader: () => import('./myCustom/MyCustomChart'),
});
```

4. 运行 `npm install` 安装依赖，然后使用 `npm run dev` 启动本地开发服务器。

## 数据对接建议

- **Python 研究复用**：可在 Python 中通过 API 或文件输出提供处理好的数据，前端可从接口获取并渲染。
- **直接调用 API**：也可在前端直接请求公开金融数据源（如 Yahoo Finance API、Polygon 等），注意跨域和频率限制。
- **跨域处理**：如果目标数据源缺乏 CORS 头，可参考 `src/services/yahooFinance.ts` 的实现，配置 `VITE_YAHOO_FINANCE_PROXY` 指向自建代理，或准备降级用的离线样例数据，保证前端 UI 在无网或限流场景下依旧可展示。
- **刷新策略**：
  - 使用 `defaultRefreshInterval` 控制基础自动刷新。
  - 组件可在 `useEffect` 中监听 `refreshIndex` 以决定何时重新抓取数据。
  - 若某些图表需要更复杂的调度，可以通过 `context.requestRefresh()` 暴露的回调自定义触发。

## UI 风格建议

- 使用玻璃拟态 + 深色渐变风格，与现有布局保持一致。
- 组件区域建议提供错误提示、加载状态和手动刷新按钮。
- 若图表包含阈值或参考线，请使用清晰的颜色和文字说明。

## 下一步规划

- 引入多租户/多页面路由支持。
- 加入图表搜索、筛选和收藏功能。
- 考虑与 Python 后端通过 WebSocket 建立实时推送。
