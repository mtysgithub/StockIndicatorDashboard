import { ChartPanel } from './ChartPanel';
import type { ChartRegistration } from '../core/types';
import styles from './ChartGrid.module.css';

interface ChartGridProps {
  charts: ChartRegistration[];
}

export const ChartGrid = ({ charts }: ChartGridProps) => (
  <section className={styles.grid}>
    {charts.map((chart) => (
      <ChartPanel key={chart.id} registration={chart} />
    ))}
  </section>
);
