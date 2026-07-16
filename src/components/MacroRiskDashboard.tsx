import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchMacroDashboard, type IndicatorStatus, type MacroDashboardPayload } from '../services/macroDashboard';
import styles from './MacroRiskDashboard.module.css';

const statusLabel: Record<IndicatorStatus, string> = {
  healthy: '健康',
  watch: '关注',
  warning: '警告',
};

const levelLabel: Record<MacroDashboardPayload['overall']['level'], string> = {
  stable: '稳定',
  fragile: '脆弱',
  deteriorating: '恶化',
};

function formatDate(value: string): string {
  if (!value) return '未知';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
}

export function MacroRiskDashboard() {
  const [data, setData] = useState<MacroDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    try {
      setData(await fetchMacroDashboard(controller.signal));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '加载失败');
    } finally {
      setLoading(false);
    }
    return () => controller.abort();
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const warningCount = useMemo(
    () => data?.indicators.filter((indicator) => indicator.status === 'warning').length ?? 0,
    [data],
  );

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>US EQUITY MACRO MONITOR</p>
          <h1>美股六项风险仪表盘</h1>
          <p className={styles.subtitle}>区分“估值昂贵”与“基本面恶化”，刷新页面即可拉取最新公开数据。</p>
        </div>
        <button className={styles.refreshButton} onClick={() => void refresh()} disabled={loading}>
          {loading ? '刷新中…' : '立即刷新'}
        </button>
      </header>

      {error && (
        <section className={`${styles.alert} ${styles.errorAlert}`}>
          <strong>数据加载失败</strong>
          <span>{error}</span>
        </section>
      )}

      {data && (
        <>
          <section className={`${styles.alert} ${styles[data.overall.level]}`}>
            <div>
              <span className={styles.levelBadge}>{levelLabel[data.overall.level]}</span>
              <h2>{data.overall.headline}</h2>
              <p>{data.overall.reasons.join('；')}</p>
            </div>
            <div className={styles.alertStats}>
              <span>{warningCount}</span>
              <small>警告项</small>
            </div>
          </section>

          <section className={styles.grid}>
            {data.indicators.map((indicator) => (
              <article key={indicator.id} className={`${styles.card} ${styles[indicator.status]}`}>
                <div className={styles.cardHeader}>
                  <div>
                    <p className={styles.cardTitle}>{indicator.title}</p>
                    <p className={styles.cardValue}>{indicator.displayValue}</p>
                  </div>
                  <span className={styles.statusBadge}>{statusLabel[indicator.status]}</span>
                </div>

                <p className={styles.summary}>{indicator.summary}</p>

                <dl className={styles.details}>
                  {indicator.details.map((detail) => (
                    <div key={`${indicator.id}-${detail.label}`}>
                      <dt>{detail.label}</dt>
                      <dd>{detail.value}</dd>
                    </div>
                  ))}
                </dl>

                <div className={styles.threshold}>
                  <span>阈值</span>
                  <p>{indicator.threshold}</p>
                </div>

                <footer className={styles.cardFooter}>
                  <span>数据截至 {indicator.updatedAt}</span>
                  <a href={indicator.sourceUrl} target="_blank" rel="noreferrer">{indicator.source}</a>
                </footer>
              </article>
            ))}
          </section>

          <section className={styles.methodology}>
            <h2>判定逻辑</h2>
            <p>{data.methodology.fundamentalRule}</p>
            <p>{data.methodology.caveat}</p>
            <p>页面生成时间：{formatDate(data.generatedAt)}</p>
          </section>
        </>
      )}

      {!data && loading && <div className={styles.loading}>正在计算六项指标…</div>}
    </div>
  );
}
