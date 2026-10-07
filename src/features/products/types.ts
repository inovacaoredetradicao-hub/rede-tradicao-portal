export interface ProductCatalogItem {
  id: string;
  productCode: string;
  barcode: string;
  name: string;
  classification?: string;
  stockType?: string;
  subGroup?: string;
  /** Todos os codigos de barras vinculados (inclui o principal). */
  barcodes: string[];
  /** Soma do estoque esperado em todas as filiais; null quando nao ha saldo registrado. */
  stockTotal: number | null;
}

export interface ProductSearchFilters {
  term: string;
  /** Filiais cujo estoque entra na soma; vazio = todas. */
  unitIds: string[];
  onlyWithStock: boolean;
}

export interface ProductSearchResult {
  items: ProductCatalogItem[];
  total: number;
}

export interface ProductUnitStock {
  unitId: string;
  unitName: string;
  erpCompanyId: number | null;
  quantity: number;
  updatedAt: string;
}

export interface UnitErpMapping {
  id: string;
  code: string;
  name: string;
  erpCompanyId: number | null;
}

export interface ArgoCompanyOption {
  idempresa: number;
  nomefantasia: string;
  razaosocial: string;
  cidade?: string;
}

export interface ErpSyncRun {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: 'em_andamento' | 'sucesso' | 'erro';
  total_fetched: number;
  products_created: number;
  products_updated: number;
  barcodes_linked: number;
  stock_updated: number;
  skipped_no_unit_mapping: number;
  error_message: string | null;
}

export interface ErpSyncStatus {
  configured: boolean;
  lastRun: ErpSyncRun | null;
}

export interface ErpSyncSummary {
  totalFetched: number;
  created: number;
  updated: number;
  barcodesLinked: number;
  stockUpdated: number;
  skippedNoUnitMapping: number;
  errors: string[];
}
