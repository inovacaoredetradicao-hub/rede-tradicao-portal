import { getOperationalAlertsBackendBaseUrl } from '../operational-alerts/api';
import { UniformItem, UniformStockRow, UniformTag, UniformUnitStockRow } from './types';

const REQUEST_TIMEOUT_MS = 10000;

async function fetchWithTimeout(url: string, init?: RequestInit) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...init?.headers },
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${getOperationalAlertsBackendBaseUrl()}/uniforms${path}`;
  const response = await fetchWithTimeout(url, init);

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ message: `Falha na API (${response.status}).` }));
    throw new Error(payload.message ?? `Falha na API (${response.status}).`);
  }

  return (await response.json()) as T;
}

export const getUniformItems = () => request<UniformItem[]>('/items');

export const createUniformItem = (input: { name: string; size: string }) =>
  request<UniformItem>('/items', { method: 'POST', body: JSON.stringify(input) });

export const generateUniformTags = (input: { quantity: number; batchLabel?: string | null }) =>
  request<UniformTag[]>('/tags/generate', { method: 'POST', body: JSON.stringify(input) });

export const getUniformTags = (filters: { status?: string; unitId?: string; batchLabel?: string } = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const query = params.toString();
  return request<UniformTag[]>(`/tags${query ? `?${query}` : ''}`);
};

export const getUniformStock = (unitId?: string) =>
  request<UniformStockRow[]>(`/stock${unitId ? `?unitId=${unitId}` : ''}`);

export const getUniformStockByUnit = () => request<UniformUnitStockRow[]>('/stock/by-unit');
