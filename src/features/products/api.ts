import { authHeaders, notifyIfUnauthorized } from '@/lib/session';
import {
  ArgoCompanyOption,
  ErpSyncStatus,
  ErpSyncSummary,
  ProductCatalogItem,
  ProductSearchFilters,
  ProductSearchResult,
  ProductUnitStock,
  UnitErpMapping,
} from './types';

const DEFAULT_CATALOG_BASE_URL = 'http://localhost:4000';
const REQUEST_TIMEOUT_MS = 10000;

function getCatalogBaseUrl() {
  return (((import.meta as any).env?.VITE_CATALOG_API_BASE_URL as string | undefined) || DEFAULT_CATALOG_BASE_URL).replace(
    /\/$/,
    '',
  );
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = notifyIfUnauthorized(
      await fetch(`${getCatalogBaseUrl()}${path}`, {
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

    if (!response.ok) {
      let message = `Falha na requisicao (${response.status}) em ${path}.`;
      try {
        const errorPayload = (await response.json()) as { error?: string };
        if (errorPayload.error) {
          message = errorPayload.error;
        }
      } catch {
        // Ignore invalid JSON error payloads.
      }
      throw new Error(message);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`A requisicao demorou demais para responder em ${path}.`);
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Falha ao buscar dados no endpoint ${path}.`);
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function normalizeProduct(raw: any): ProductCatalogItem {
  return {
    id: String(raw.id ?? ''),
    productCode: String(raw.product_code ?? raw.productCode ?? ''),
    barcode: String(raw.barcode ?? ''),
    name: String(raw.name ?? ''),
    classification: raw.classification || undefined,
    stockType: raw.stock_type || raw.stockType || undefined,
    subGroup: raw.sub_group || raw.subGroup || undefined,
    barcodes: Array.isArray(raw.barcodes) && raw.barcodes.length > 0 ? raw.barcodes.map(String) : [String(raw.barcode ?? '')],
    stockTotal: raw.stock_total === null || raw.stock_total === undefined ? null : Number(raw.stock_total),
  };
}

/** Busca paginada no backend; stockTotal vem somado so nas filiais do filtro. */
export async function searchProducts(
  filters: ProductSearchFilters,
  limit: number,
  offset: number,
): Promise<ProductSearchResult> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (filters.term) params.set('q', filters.term);
  if (filters.unitIds.length > 0) params.set('unitIds', filters.unitIds.join(','));
  if (filters.onlyWithStock) params.set('onlyWithStock', '1');

  const result = await requestJson<{ items: any[]; total: number }>(`/products/search?${params.toString()}`);
  return {
    items: result.items.map(normalizeProduct).filter((product) => product.id && product.name),
    total: Number(result.total ?? 0),
  };
}

export async function getProductStockByUnit(productId: string): Promise<ProductUnitStock[]> {
  const rows = await requestJson<any[]>(`/products/${productId}/stock`);
  return rows.map((row) => ({
    unitId: String(row.unit_id),
    unitName: String(row.unit_name ?? ''),
    erpCompanyId: row.erp_company_id === null || row.erp_company_id === undefined ? null : Number(row.erp_company_id),
    quantity: Number(row.expected_quantity ?? 0),
    updatedAt: String(row.updated_at ?? ''),
  }));
}

export async function updateProductBarcode(productId: string, barcode: string): Promise<void> {
  await requestJson(`/products/${productId}`, {
    method: 'PATCH',
    body: JSON.stringify({ barcode }),
  });
}

export async function addProductBarcode(productId: string, barcode: string): Promise<void> {
  await requestJson(`/products/${productId}/barcodes`, {
    method: 'POST',
    body: JSON.stringify({ barcode }),
  });
}

export async function removeProductBarcode(productId: string, barcode: string): Promise<void> {
  await requestJson(`/products/${productId}/barcodes/${encodeURIComponent(barcode)}`, {
    method: 'DELETE',
  });
}

function normalizeUnitMapping(raw: any): UnitErpMapping {
  return {
    id: String(raw.id ?? ''),
    code: String(raw.code ?? ''),
    name: String(raw.name ?? ''),
    erpCompanyId: raw.erp_company_id === null || raw.erp_company_id === undefined ? null : Number(raw.erp_company_id),
  };
}

export async function getUnitsErpMapping(): Promise<UnitErpMapping[]> {
  const rows = await requestJson<any[]>('/units');
  return rows.map(normalizeUnitMapping).filter((unit) => unit.id);
}

export async function setUnitErpCompanyId(unitId: string, erpCompanyId: number | null): Promise<void> {
  await requestJson(`/units/${unitId}`, {
    method: 'PATCH',
    body: JSON.stringify({ erp_company_id: erpCompanyId }),
  });
}

export async function getErpSyncStatus(): Promise<ErpSyncStatus> {
  return requestJson<ErpSyncStatus>('/integrations/argo/status');
}

export async function getArgoCompanies(): Promise<ArgoCompanyOption[]> {
  const rows = await requestJson<any[]>('/integrations/argo/empresas');
  return rows.map((raw) => ({
    idempresa: Number(raw.idempresa),
    nomefantasia: String(raw.nomefantasia ?? ''),
    razaosocial: String(raw.razaosocial ?? ''),
    cidade: raw.cidade || undefined,
  }));
}

/** Inicia a sincronizacao no servidor (roda em segundo plano); acompanhe por getErpSyncStatus. */
export async function triggerErpSync(): Promise<{ started: boolean }> {
  return requestJson<{ started: boolean }>('/integrations/argo/sync', { method: 'POST' });
}
