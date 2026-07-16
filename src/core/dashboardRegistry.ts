import type { ComponentType } from 'react';

export type DashboardCollectionLoader = () => Promise<{ default: ComponentType }>;

export interface DashboardCollectionRegistration {
  id: string;
  title: string;
  description: string;
  order?: number;
  tags?: string[];
  loader: DashboardCollectionLoader;
}

class DashboardRegistry {
  private readonly registry = new Map<string, DashboardCollectionRegistration>();

  register(registration: DashboardCollectionRegistration) {
    if (this.registry.has(registration.id)) {
      throw new Error(`Dashboard collection with id "${registration.id}" already exists.`);
    }

    this.registry.set(registration.id, { ...registration });
  }

  list(): DashboardCollectionRegistration[] {
    return Array.from(this.registry.values()).sort((left, right) => {
      const orderDifference = (left.order ?? 100) - (right.order ?? 100);
      return orderDifference || left.title.localeCompare(right.title, 'zh-CN');
    });
  }
}

export const dashboardRegistry = new DashboardRegistry();
