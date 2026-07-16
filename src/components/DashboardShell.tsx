import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import type { DashboardCollectionRegistration } from '../core/dashboardRegistry';
import styles from './DashboardShell.module.css';

interface DashboardShellProps {
  collections: DashboardCollectionRegistration[];
}

function collectionIdFromHash(collections: DashboardCollectionRegistration[]): string {
  if (!collections.length) return '';
  if (typeof window === 'undefined') return collections[0].id;

  const rawHash = window.location.hash.replace(/^#\/?/, '').trim();
  const candidate = rawHash.startsWith('collection=')
    ? decodeURIComponent(rawHash.slice('collection='.length))
    : decodeURIComponent(rawHash);

  return collections.some((collection) => collection.id === candidate)
    ? candidate
    : collections[0].id;
}

export function DashboardShell({ collections }: DashboardShellProps) {
  const [selectedId, setSelectedId] = useState(() => collectionIdFromHash(collections));

  useEffect(() => {
    const handleHashChange = () => setSelectedId(collectionIdFromHash(collections));
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [collections]);

  const activeCollection = collections.find((collection) => collection.id === selectedId) ?? collections[0];
  const ActiveDashboard = useMemo(
    () => (activeCollection ? lazy(activeCollection.loader) : null),
    [activeCollection],
  );

  if (!activeCollection || !ActiveDashboard) {
    return <main className={styles.empty}>尚未注册任何指标集合。</main>;
  }

  const selectCollection = (id: string) => {
    const nextHash = `#${encodeURIComponent(id)}`;
    if (window.location.hash === nextHash) {
      setSelectedId(id);
      return;
    }
    window.location.hash = nextHash;
  };

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <p className={styles.eyebrow}>MARKET MONITORING SYSTEM</p>
          <h1>Stock Indicator Dashboard</h1>
          <p>按指标集合增量扩展。每个集合拥有独立数据源、阈值和展示逻辑。</p>
        </div>
        <a
          className={styles.repositoryLink}
          href="https://github.com/mtysgithub/StockIndicatorDashboard"
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>
      </header>

      <nav className={styles.navigation} aria-label="指标集合">
        {collections.map((collection) => {
          const active = collection.id === activeCollection.id;
          return (
            <button
              key={collection.id}
              type="button"
              className={`${styles.navItem} ${active ? styles.navItemActive : ''}`}
              aria-current={active ? 'page' : undefined}
              onClick={() => selectCollection(collection.id)}
            >
              <strong>{collection.title}</strong>
              <span>{collection.description}</span>
            </button>
          );
        })}
      </nav>

      <section className={styles.collectionHeader}>
        <div>
          <p className={styles.collectionLabel}>当前指标集合</p>
          <h2>{activeCollection.title}</h2>
          <p>{activeCollection.description}</p>
        </div>
        {activeCollection.tags?.length ? (
          <div className={styles.tags}>
            {activeCollection.tags.map((tag) => <span key={tag}>{tag}</span>)}
          </div>
        ) : null}
      </section>

      <main className={styles.content}>
        <Suspense key={activeCollection.id} fallback={<div className={styles.loading}>正在加载指标集合…</div>}>
          <ActiveDashboard />
        </Suspense>
      </main>
    </div>
  );
}
