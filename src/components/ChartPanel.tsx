import { useEffect, useMemo, useState } from 'react';
import type { ChartComponent, ChartRegistration } from '../core/types';
import styles from './ChartPanel.module.css';

interface ChartPanelProps {
  registration: ChartRegistration;
}

const Loading = () => (
  <div className={styles.loadingState}>
    <div className={styles.spinner} />
    <span>加载图表模块...</span>
  </div>
);

const ErrorState = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
  <div className={styles.errorState}>
    <strong>图表加载失败</strong>
    <span>{message}</span>
    <button onClick={onRetry}>重试</button>
  </div>
);

export const ChartPanel = ({ registration }: ChartPanelProps) => {
  const { id, title, description, tags, defaultRefreshInterval, loader } = registration;
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [Component, setComponent] = useState<ChartComponent | null>(null);
  const [loaderVersion, setLoaderVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setComponent(null);
    setLoadError(null);
    loader()
      .then((module) => {
        if (cancelled) {
          return;
        }
        setComponent(() => module.default);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setLoadError((error as Error).message);
      });

    return () => {
      cancelled = true;
    };
  }, [loader, loaderVersion]);

  useEffect(() => {
    if (!defaultRefreshInterval) {
      return;
    }
    const timer = window.setInterval(() => {
      setRefreshIndex((current) => current + 1);
    }, defaultRefreshInterval);

    return () => window.clearInterval(timer);
  }, [defaultRefreshInterval]);

  const context = useMemo(
    () => ({
      requestRefresh: () => setRefreshIndex((current) => current + 1),
      refreshInterval: defaultRefreshInterval,
    }),
    [defaultRefreshInterval],
  );

  return (
    <article className={styles.card}>
      <header className={styles.header}>
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {tags?.length ? (
          <div className={styles.tags}>
            {tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        ) : null}
      </header>
      <div className={styles.body}>
        {loadError ? (
          <ErrorState
            message={loadError}
            onRetry={() => setLoaderVersion((version) => version + 1)}
          />
        ) : null}
        {Component ? <Component refreshIndex={refreshIndex} context={context} /> : <Loading />}
      </div>
      <footer className={styles.footer}>
        <span>模块 ID：{id}</span>
        {defaultRefreshInterval ? (
          <span>默认刷新：{Math.round(defaultRefreshInterval / 1000)} 秒</span>
        ) : (
          <span>默认刷新：手动</span>
        )}
      </footer>
    </article>
  );
};
