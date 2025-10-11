import type { PropsWithChildren } from 'react';
import styles from './DashboardLayout.module.css';

interface DashboardLayoutProps extends PropsWithChildren {
  chartsCount: number;
}

export const DashboardLayout = ({ chartsCount, children }: DashboardLayoutProps) => (
  <div className={styles.wrapper}>
    <header className={styles.header}>
      <div>
        <h1>Stock Indicator Dashboard</h1>
        <p>
          一个可扩展的现代化美股指标仪表盘框架。当前激活图表数：
          <strong> {chartsCount}</strong>
        </p>
      </div>
      <div className={styles.actions}>
        <a
          href="https://github.com/"
          target="_blank"
          rel="noreferrer"
          className={styles.cta}
        >
          项目说明
        </a>
      </div>
    </header>
    <main className={styles.main}>{children}</main>
    <footer className={styles.footer}>
      数据刷新频率可按图表配置。默认刷新间隔可在 chart 模块中调整。
    </footer>
  </div>
);
