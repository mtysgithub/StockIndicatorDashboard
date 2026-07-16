# 指标集合扩展指南

指标集合是页面级模块，例如“技术指标”“宏观基本面”“流动性条件”或“信用周期”。集合之间可以使用完全不同的数据源、组件结构和告警规则。

## 1. 新建集合组件

在 `src/dashboards` 下新增一个默认导出的 React 组件：

```tsx
export default function LiquidityDashboard() {
  return <section>Liquidity dashboard</section>;
}
```

集合组件可以直接展示卡片，也可以继续使用 `chartRegistry` 和 `ChartGrid` 组织内部图表。

## 2. 注册集合

在 `src/dashboards/registerDashboards.ts` 中追加：

```ts
dashboardRegistry.register({
  id: 'liquidity',
  title: '流动性条件',
  description: '跟踪美元流动性、金融条件和资产负债表变化。',
  order: 30,
  tags: ['Liquidity', 'FRED'],
  loader: () => import('./LiquidityDashboard'),
});
```

字段说明：

- `id`：稳定且唯一，会出现在 URL hash 中。
- `title`：导航标题。
- `description`：集合用途说明。
- `order`：导航排序，数值越小越靠前。
- `tags`：可选的来源或主题标签。
- `loader`：懒加载集合组件。

## 3. 不要修改总入口

新增集合时不应再替换 `App.tsx`。`App.tsx` 只负责读取 `dashboardRegistry`，`DashboardShell` 负责导航、URL 状态和懒加载。

## 4. 集合内部新增单图表

若集合内部采用原模块化图表系统：

1. 在 `src/modules` 新增图表模块。
2. 在 `src/modules/registerCharts.ts` 注册。
3. 使用 `ChartGrid` 展示注册图表。

具体参考 `docs/CHART_MODULE_GUIDE.md`。

## 设计原则

- 页面级功能通过 `dashboardRegistry` 增量扩展。
- 单图表功能通过 `chartRegistry` 增量扩展。
- 数据请求、阈值判断和视图代码尽量封装在所属集合内。
- 集合之间不覆盖入口、不相互依赖、不共享隐式全局状态。
