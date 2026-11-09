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

export interface LossBreakdownRow {
  key: string;
  total_cost: number;
  quantity: number;
  items: number;
}

export interface LossDashboard {
  year: number;
  kpis: {
    total_cost: number;
    vencidos_cost: number;
    avariados_cost: number;
    quantity: number;
    items: number;
    repeated_lots: number;
    bonificado_quantity: number;
    bonificado_cost: number;
    /** Vencidos + avariados menos o que foi baixado com bonificacao. */
    perda_acumulada: number;
  };
  byCurve: LossBreakdownRow[];
  byPromotion: LossBreakdownRow[];
  byOrigin: LossBreakdownRow[];
  byLossType: LossBreakdownRow[];
  byReason: LossBreakdownRow[];
  monthly: { month: number; total_cost: number; vencidos_cost: number; avariados_cost: number }[];
}

export interface LossItem {
  source_session_id: string;
  item_id: string;
  unit_id: string;
  unit_name: string | null;
  seller_name: string | null;
  finished_at: string | null;
  code: string | null;
  name: string | null;
  lot: string | null;
  curve: string | null;
  origin: string | null;
  manufactured_at: string | null;
  expires_at: string | null;
  loss_type: string | null;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  promotion: boolean | null;
  loss_reason: string | null;
  repeated_lot: boolean;
  has_photo: boolean;
  settlement: string | null;
  invoice_number: string | null;
}

export type LossFilters = { unitId?: string; year?: string; dateFrom?: string; dateTo?: string };

export async function getLossDashboard(filters: LossFilters = {}) {
  return requestJson<LossDashboard>(`/portal/losses/dashboard${buildQuery(filters)}`);
}

export async function getLossItems(filters: LossFilters = {}) {
  return requestJson<LossItem[]>(`/portal/losses/items${buildQuery(filters)}`);
}

export async function getPortalReturnDetail(sourceSessionId: string) {
  return requestJson<PortalReturnDetail>(`/portal/returns/${sourceSessionId}`);
}

export function getPortalReturnPdfUrl(sourceSessionId: string) {
  return withTokenQuery(`${getPortalApiBaseUrl()}/portal/returns/${encodeURIComponent(sourceSessionId)}/pdf`);
}

export function getPortalAuditPdfUrl(sourceSessionId: string) {
  return withTokenQuery(`${getPortalApiBaseUrl()}/portal/audits/${sourceSessionId}/pdf`);
}

export function getPortalAuditApiBaseUrl() {
  return getPortalApiBaseUrl();
}

// ---- Organizacao de estoque: solicitar foto do estoque da filial e avaliar ----
export type StockPhotoStatus = 'pendente' | 'enviado' | 'avaliado';
export type StockRating = 'organizado' | 'parcial' | 'desorganizado';

export interface StockPhotoRequest {
  id: string;
  unit_id: string;
  unit_name: string | null;
  instructions: string | null;
  requested_by_name: string | null;
  requested_at: string;
  due_at: string | null;
  status: StockPhotoStatus;
  sent_at: string | null;
  sent_by_name: string | null;
  sent_note: string | null;
  rating: StockRating | null;
  evaluation_note: string | null;
  evaluated_at: string | null;
  evaluated_by_name: string | null;
  photo_count: number;
}

export async function getStockPhotoRequests(filters: { status?: string; unitId?: string } = {}) {
  return requestJson<StockPhotoRequest[]>(`/stock-organization/requests${buildQuery(filters)}`);
}

export async function createStockPhotoRequests(payload: { unitIds: string[]; instructions?: string; dueAt?: string }) {
  return requestPostJson<{ created: number }>('/stock-organization/requests', payload);
}

export async function evaluateStockPhotoRequest(id: string, rating: StockRating, note: string) {
  return requestPostJson<{ success: true }>(`/stock-organization/requests/${encodeURIComponent(id)}/evaluation`, { rating, note });
}

export async function cancelStockPhotoRequest(id: string) {
  const response = await fetchWithTimeout(`${getPortalApiBaseUrl()}/stock-organization/requests/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: `Falha na API (${response.status}).` }));
    throw new Error(payload.error ?? `Falha na API (${response.status}).`);
  }
}

export function stockPhotoUrl(id: string, position: number) {
  return withTokenQuery(`${getPortalApiBaseUrl()}/stock-organization/requests/${encodeURIComponent(id)}/photos/${position}`);
}
