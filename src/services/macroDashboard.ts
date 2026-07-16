export type IndicatorStatus = 'healthy' | 'watch' | 'warning';

export interface IndicatorDetail {
  label: string;
  value: string;
}

export interface MacroIndicator {
  id: string;
  title: string;
  value: number;
  displayValue: string;
  status: IndicatorStatus;
  summary: string;
  threshold: string;
  updatedAt: string;
  source: string;
  sourceUrl: string;
  details: IndicatorDetail[];
}

export interface MacroDashboardPayload {
  generatedAt: string;
  overall: {
    level: 'stable' | 'fragile' | 'deteriorating';
    fundamentalAlertActive: boolean;
    headline: string;
    reasons: string[];
  };
  indicators: MacroIndicator[];
  methodology: {
    fundamentalRule: string;
    caveat: string;
  };
}

export async function fetchMacroDashboard(signal?: AbortSignal): Promise<MacroDashboardPayload> {
  const response = await fetch(`/api/macro-dashboard?t=${Date.now()}`, {
    signal,
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });

  const payload = await response.json() as MacroDashboardPayload | { error?: string };
  if (!response.ok) {
    throw new Error('error' in payload && payload.error ? payload.error : `请求失败：${response.status}`);
  }

  return payload as MacroDashboardPayload;
}
