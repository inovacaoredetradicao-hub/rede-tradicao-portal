import { authHeaders, notifyIfUnauthorized, withTokenQuery } from '@/lib/session';
import {
  PortalAuditDashboardSummary,
  PortalAuditUnitLosses,
  PortalAuditUnitMetrics,
  PortalChecklistDetail,
  PortalChecklistSummary,
  PortalReturnDetail,
  PortalReturnSummary,
} from '@/types';

const DEFAULT_API_BASE_URL = 'http://localhost:4000';
const API_TIMEOUT_MS = 10000;
const API_RETRY_COUNT = 1;

function getPortalApiBaseUrl() {
  return (((import.meta as any).env?.VITE_PORTAL_API_BASE_URL as string | undefined) || DEFAULT_API_BASE_URL).replace(/\/$/, '');
}

async function fetchWithTimeout(input: string, init?: RequestInit) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    return notifyIfUnauthorized(
      await fetch(input, {
        ...init,
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          ...authHeaders(),
          ...init?.headers,
        },
      }),
    );
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function requestJson<T>(path: string): Promise<T> {
  const url = `${getPortalApiBaseUrl()}${path}`;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= API_RETRY_COUNT; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url);

      if (!response.ok) {
        throw new Error(`Falha ao carregar dados do backend (${response.status}).`);
      }

      return (await response.json()) as T;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Erro desconhecido ao acessar a API.');

      if (attempt === API_RETRY_COUNT) {
        break;
      }
    }
  }

  throw lastError ?? new Error('Falha ao acessar a API do portal.');
}

async function requestPostJson<T>(path: string, body: unknown): Promise<T> {
  const url = `${getPortalApiBaseUrl()}${path}`;
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: `Falha na API (${response.status}).` }));
    throw new Error(payload.error ?? `Falha na API (${response.status}).`);
  }

  return (await response.json()) as T;
}

function buildQuery(filters: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const query = params.toString();
  return query ? `?${query}` : '';
}

export interface PortalDashboardQueryFilters {
  [key: string]: string | undefined;
  unitId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export async function getPortalAuditDashboardSummary(filters: PortalDashboardQueryFilters = {}) {
  return requestJson<PortalAuditDashboardSummary>(`/portal/dashboard/summary${buildQuery(filters)}`);
}

export async function getPortalAuditDashboardByUnit(filters: PortalDashboardQueryFilters = {}) {
  return requestJson<PortalAuditUnitMetrics[]>(`/portal/dashboard/by-unit${buildQuery(filters)}`);
}

export async function getPortalAuditLossesByUnit(filters: PortalDashboardQueryFilters = {}) {
  return requestJson<PortalAuditUnitLosses[]>(`/portal/dashboard/losses-by-unit${buildQuery(filters)}`);
}

export async function loginPortalUser(username: string, password: string) {
  return requestPostJson<{
    id: string;
    name: string;
    username: string;
    role: string;
    createdAt: string;
    isMaster?: boolean;
    token?: string;
  }>(
    '/auth/login',
    { username, password },
  );
}

export async function getPortalChecklists(filters: { unitId?: string; sellerName?: string; dateFrom?: string; dateTo?: string } = {}) {
  return requestJson<PortalChecklistSummary[]>(`/portal/checklists${buildQuery(filters)}`);
}

export async function getPortalChecklistDetail(sourceSessionId: string) {
  return requestJson<PortalChecklistDetail>(`/portal/checklists/${sourceSessionId}`);
}

export async function getPortalReturns(filters: { unitId?: string; sellerName?: string; dateFrom?: string; dateTo?: string } = {}) {
  return requestJson<PortalReturnSummary[]>(`/portal/returns${buildQuery(filters)}`);
}

export async function getPortalReturnDetail(sourceSessionId: string) {
  return requestJson<PortalReturnDetail>(`/portal/returns/${sourceSessionId}`);
}

export function getPortalAuditPdfUrl(sourceSessionId: string) {
  return withTokenQuery(`${getPortalApiBaseUrl()}/portal/audits/${sourceSessionId}/pdf`);
}

export function getPortalAuditApiBaseUrl() {
  return getPortalApiBaseUrl();
}
