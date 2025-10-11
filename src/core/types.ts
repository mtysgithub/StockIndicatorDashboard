import type { ComponentType } from 'react';

export interface ChartRuntimeContext {
  requestRefresh: () => void;
  refreshInterval: number | null | undefined;
}

export interface ChartComponentProps {
  refreshIndex: number;
  context: ChartRuntimeContext;
}

export type ChartComponent = ComponentType<ChartComponentProps>;

export type ChartModuleLoader = () => Promise<{ default: ChartComponent }>;

export interface ChartRegistration {
  id: string;
  title: string;
  description?: string;
  tags?: string[];
  defaultRefreshInterval?: number;
  loader: ChartModuleLoader;
}
