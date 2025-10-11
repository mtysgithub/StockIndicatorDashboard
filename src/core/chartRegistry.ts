import type { ChartRegistration, ChartModuleLoader } from './types';

interface RegisterOptions {
  id: string;
  title: string;
  description?: string;
  tags?: string[];
  defaultRefreshInterval?: number;
  loader: ChartModuleLoader;
}

class ChartRegistry {
  private readonly registry = new Map<string, ChartRegistration>();

  register(options: RegisterOptions) {
    if (this.registry.has(options.id)) {
      throw new Error(`Chart with id "${options.id}" already exists.`);
    }
    this.registry.set(options.id, { ...options });
  }

  list(): ChartRegistration[] {
    return Array.from(this.registry.values());
  }
}

export const chartRegistry = new ChartRegistry();
