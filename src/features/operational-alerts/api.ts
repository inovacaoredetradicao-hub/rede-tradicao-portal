import { authHeaders, notifyIfUnauthorized } from '@/lib/session';
import {
  OperationalCountAlert,
  OperationalAuditResult,
  OperationalCountRule,
  OperationalAlertsDashboardSummary,
  OperationalProductOption,
  OperationalRulePayload,
  OperationalRuleSubmitResult,
  OperationalUnitOption,
  OperationalUserOption,
  OperationalClassificationOption,
  OperationalRuleBatchEditPayload,
} from './types';

const DEFAULT_BACKEND_BASE_URL = 'http://localhost:4001';
const DEFAULT_CATALOG_BASE_URL = 'http://localhost:4000';
const MODULE_PREFIX = '/operational-alerts';
const REQUEST_TIMEOUT_MS = 10000;
const MAX_RETRIES = 1;

function normalizeBaseUrl(url: string) {
  return url.replace(/\/$/, '');
}

function normalizeKey(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function getBackendBaseUrl() {
  return ((((import.meta as any).env?.VITE_OPERATIONAL_ALERTS_API_BASE_URL as string | undefined) || DEFAULT_BACKEND_BASE_URL)).replace(/\/$/, '');
}

function getCatalogBaseUrl() {
  return normalizeBaseUrl((((import.meta as any).env?.VITE_CATALOG_API_BASE_URL as string | undefined) || DEFAULT_CATALOG_BASE_URL));
}

async function fetchWithTimeout(url: string, init?: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return notifyIfUnauthorized(
      await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...authHeaders(),
          ...init?.headers,
        },
      }),
    );
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function requestJson<T>(baseUrl: string, path: string, init?: RequestInit): Promise<T> {
  const url = `${baseUrl}${path}`;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, init);

      if (!response.ok) {
        let message = `Falha ao carregar dados (${response.status}) em ${path}.`;

        try {
          const errorPayload = (await response.json()) as { message?: string };
          if (errorPayload.message) {
            message = `${errorPayload.message} [${path}]`;
          }
        } catch {
          // Ignore invalid JSON error payloads.
        }

        throw new Error(message);
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        lastError = new Error(`A requisicao demorou demais para responder em ${path}.`);
      } else if (error instanceof Error) {
        lastError = new Error(error.message === 'Failed to fetch' ? `Falha ao buscar dados no endpoint ${url}.` : error.message);
      } else {
        lastError = new Error(`Falha ao buscar dados no endpoint ${url}.`);
      }
    }

    if (attempt < MAX_RETRIES) {
      await new Promise((resolve) => window.setTimeout(resolve, 400));
    }
  }

  throw lastError ?? new Error(`Falha ao buscar dados no endpoint ${url}.`);
}

async function requestOperationalJson<T>(path: string, init?: RequestInit): Promise<T> {
  return requestJson<T>(getBackendBaseUrl(), path, init);
}

async function requestCatalogJson<T>(path: string, init?: RequestInit): Promise<T> {
  return requestJson<T>(getCatalogBaseUrl(), path, init);
}

async function requestOptionalCatalogJson<T>(path: string, fallback: T, init?: RequestInit): Promise<T> {
  try {
    return await requestCatalogJson<T>(path, init);
  } catch {
    return fallback;
  }
}

function normalizeProduct(raw: any): OperationalProductOption {
  const id = String(raw.id ?? raw.productId ?? raw.uuid ?? '');
  const productCode = String(raw.product_code ?? raw.productCode ?? '');
  const barcode = String(raw.barcode ?? raw.code ?? raw.productCode ?? '');
  const name = String(raw.name ?? raw.productName ?? raw.description ?? '');
  const classification = String(raw.classification ?? raw.stock_type ?? '').trim();
  const stockType = String(raw.stock_type ?? '').trim();
  const subGroup = String(raw.sub_group ?? raw.subGroup ?? '').trim();

  return {
    id,
    productCode,
    barcode,
    name,
    classification: classification || undefined,
    classificationKey: classification ? normalizeKey(classification) : stockType ? normalizeKey(stockType) : undefined,
    stockType: stockType || undefined,
    subGroup: subGroup || undefined,
    displayLabel: [barcode, name].filter(Boolean).join(' • '),
    stockTotal: raw.stock_total === null || raw.stock_total === undefined ? undefined : Number(raw.stock_total),
  };
}

function normalizeUnit(raw: any): OperationalUnitOption {
  const id = String(raw.id ?? raw.unitId ?? raw.uuid ?? '');
  const name = String(raw.name ?? raw.unitName ?? raw.description ?? '');

  return {
    id,
    name,
    displayLabel: [name, id].filter(Boolean).join(' • '),
  };
}

function normalizeUser(raw: any): OperationalUserOption {
  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? raw.username ?? ''),
    username: String(raw.username ?? ''),
    role: String(raw.role ?? ''),
    isActive: Boolean(raw.is_active ?? raw.isActive ?? true),
  };
}

export function getOperationalAlertsBackendBaseUrl() {
  return getBackendBaseUrl();
}

export function getCatalogBackendBaseUrl() {
  return getCatalogBaseUrl();
}

export async function getOperationalCountRules() {
  return requestOperationalJson<OperationalCountRule[]>(`${MODULE_PREFIX}/rules`);
}

export async function getOperationalCountRule(ruleId: string) {
  return requestOperationalJson<OperationalCountRule>(`${MODULE_PREFIX}/rules/${ruleId}`);
}

export async function createOperationalCountRule(payload: OperationalRulePayload) {
  return requestOperationalJson<OperationalCountRule>(`${MODULE_PREFIX}/rules`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function createOperationalCountRulesBatch(payloads: OperationalRulePayload[]): Promise<OperationalRuleSubmitResult> {
  if (payloads.length === 0) {
    return {
      mode: 'classification',
      createdCount: 0,
      skippedCount: 0,
    };
  }

  // Uma requisicao so com o lote inteiro (antes: uma por regra, todas em paralelo).
  // Sem nova tentativa automatica: repetir um POST que demorou poderia duplicar regras.
  const response = await fetchWithTimeout(
    `${getBackendBaseUrl()}${MODULE_PREFIX}/rules/batch`,
    { method: 'POST', body: JSON.stringify({ rules: payloads }) },
    120000,
  ).catch((error) => {
    throw new Error(
      error instanceof DOMException && error.name === 'AbortError'
        ? 'O servidor demorou demais para salvar o disparo. Confira a lista antes de tentar de novo.'
        : 'Nao foi possivel conectar ao servidor para salvar o disparo.',
    );
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(payload.message || `Falha ao salvar o disparo (${response.status}).`);
  }

  const result = (await response.json()) as { createdCount: number };
  return {
    mode: 'classification',
    createdCount: result.createdCount,
    skippedCount: 0,
  };
}

export async function updateOperationalCountRulesBatch(
  ruleIds: string[],
  changes: OperationalRuleBatchEditPayload['changes'],
) {
  return requestOperationalJson<{ updatedCount: number }>(`${MODULE_PREFIX}/rules/batch`, {
    method: 'PATCH',
    body: JSON.stringify({ ruleIds, changes }),
  });
}

export async function updateOperationalCountRule(ruleId: string, payload: Partial<OperationalRulePayload>) {
  return requestOperationalJson<OperationalCountRule>(`${MODULE_PREFIX}/rules/${ruleId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function toggleOperationalCountRule(ruleId: string) {
  return requestOperationalJson<OperationalCountRule>(`${MODULE_PREFIX}/rules/${ruleId}/toggle`, {
    method: 'PATCH',
  });
}

export async function deleteOperationalCountRule(ruleId: string) {
  return requestOperationalJson<OperationalCountRule>(`${MODULE_PREFIX}/rules/${ruleId}`, {
    method: 'DELETE',
  });
}

export async function getOperationalCountAlerts() {
  return requestOperationalJson<OperationalCountAlert[]>(`${MODULE_PREFIX}/alerts`);
}

/** Exclui o aviso do app (status 'cancelado'; continua no historico do portal). */
export async function cancelOperationalCountAlert(alertId: string) {
  return requestOperationalJson<OperationalCountAlert>(`${MODULE_PREFIX}/alerts/${alertId}/cancel`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function getOperationalAuditResults() {
  return requestOperationalJson<OperationalAuditResult[]>(`${MODULE_PREFIX}/results`);
}

export async function getOperationalAuditResultById(auditId: string) {
  return requestOperationalJson<OperationalAuditResult>(`${MODULE_PREFIX}/results/${auditId}`);
}

export async function deleteOperationalAuditResult(auditId: string) {
  return requestOperationalJson<OperationalAuditResult>(`${MODULE_PREFIX}/results/${auditId}`, {
    method: 'DELETE',
  });
}

export async function getPendingOperationalCountAlerts() {
  return requestOperationalJson<OperationalCountAlert[]>(`${MODULE_PREFIX}/alerts/pending`);
}

export async function runOperationalAlertsScheduler() {
  return requestOperationalJson<{ createdCount: number; expiredCount: number }>(`${MODULE_PREFIX}/scheduler/run`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function getOperationalAlertsDashboardSummary() {
  return requestOperationalJson<OperationalAlertsDashboardSummary>(`${MODULE_PREFIX}/dashboard-summary`);
}

// O catalogo completo (~20 mil produtos) nao e mais baixado nesta tela: as funcoes
// abaixo buscam so o necessario no backend, sob demanda.

/** Busca de produtos para escolher no disparo (pagina pequena, so ativos). */
/** Com unitId, o estoque de cada produto vem so daquela filial; sem, soma todas. */
export async function searchOperationalProducts(term: string, limit = 50, unitId?: string) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (term.trim()) params.set('q', term.trim());
  if (unitId) params.set('unitIds', unitId);
  const result = await requestCatalogJson<{ items: any[]; total: number }>(`/products/search?${params.toString()}`);
  return {
    items: result.items.map(normalizeProduct).filter((product) => product.id && product.name),
    total: Number(result.total ?? 0),
  };
}

/** Produtos que ja tem regra - usados so para agrupar a lista de regras por classificacao. */
export async function lookupOperationalProducts(ids: string[]) {
  if (ids.length === 0) return [];
  const products = await requestCatalogJson<any[]>('/products/lookup', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  });
  return products.map(normalizeProduct).filter((product) => product.id && product.name);
}

/** Classificacoes com contagem de produtos; os produtos de cada uma vem sob demanda. */
/** Com unitId: so as classificacoes (e contagens) de produtos com estoque naquela filial. */
export async function getOperationalClassifications(unitId?: string): Promise<OperationalClassificationOption[]> {
  const query = unitId ? `?unitId=${encodeURIComponent(unitId)}` : '';
  const rows = await requestCatalogJson<{ label: string; product_count: number }[]>(`/products/classifications${query}`);
  return rows.map((row) => ({
    key: normalizeKey(row.label),
    label: row.label,
    productCount: Number(row.product_count ?? 0),
    products: [],
  }));
}

export async function getProductsByClassification(label: string, unitId?: string) {
  const unitQuery = unitId ? `&unitId=${encodeURIComponent(unitId)}` : '';
  const products = await requestCatalogJson<any[]>(`/products/by-classification?label=${encodeURIComponent(label)}${unitQuery}`);
  return products.map(normalizeProduct).filter((product) => product.id && product.name);
}

export async function getOperationalUnits() {
  const units = await requestOptionalCatalogJson<any[]>('/units', []);
  return units.map(normalizeUnit).filter((unit) => unit.id && unit.name);
}

export async function getOperationalUsers() {
  const users = await requestOptionalCatalogJson<any[]>('/users', []);
  return users.map(normalizeUser).filter((user) => user.id && user.isActive);
}

export async function getUsersByUnit(unitId: string) {
  const users = await requestOptionalCatalogJson<any[]>(`/units/${unitId}/users`, []);
  return users.map(normalizeUser).filter((user) => user.id);
}

export async function getUnitsForUser(userId: string) {
  return requestOptionalCatalogJson<{ id: string; name: string; code?: string }[]>(`/users/${userId}/units`, []);
}

export async function setUnitsForUser(userId: string, unitIds: string[]) {
  return requestCatalogJson<{ success: boolean }>(`/users/${userId}/units`, {
    method: 'PUT',
    body: JSON.stringify({ unitIds }),
  });
}
