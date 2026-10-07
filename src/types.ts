export type UserRole = 'admin' | 'auditor';

export interface UserProfile {
  id: string;
  displayName: string;
  username: string;
  role: UserRole;
  /** Conta master (processos@redetradicao.com.br): unica que ve a aba Usuarios. */
  isMaster?: boolean;
  /** Token de sessao do backend, enviado nas rotas protegidas (ex.: /admin/users). */
  token?: string;
}

export interface PortalAuditDashboardSummary {
  totalAudits: number;
  totalChecklists: number;
  totalReturns: number;
  avgAuditAccuracy: number;
  avgChecklistScore: number;
  totalReturnedItems: number;
}

export interface PortalAuditSellerMetrics {
  userId: string;
  sellerName: string;
  totalAudits: number;
  totalChecklists: number;
  totalReturns: number;
  avgAuditAccuracy: number;
  avgChecklistScore: number;
  totalReturnedItems: number;
}

export interface PortalAuditUnitMetrics {
  unitId: string;
  unitName: string;
  totalAudits: number;
  totalChecklists: number;
  totalReturns: number;
  avgAuditAccuracy: number;
  avgChecklistScore: number;
  totalReturnedItems: number;
}

export interface PortalAuditUnitLosses {
  unitId: string;
  unitName: string;
  shortageQty: number;
  surplusQty: number;
  shortageItems: number;
  surplusItems: number;
}

export interface PortalAuditDashboardFilters {
  unitId: string;
  dateFrom: string;
  dateTo: string;
  operationType: string;
}

export interface PortalChecklistSummary {
  id: string;
  source_session_id: string;
  unit_id: string;
  unit_name: string | null;
  user_id: string | null;
  seller_name: string;
  progress: number;
  conformity_score: number;
  total_sections: number;
  non_conformities: number;
  finished_at: string | null;
  received_at: string;
}

export interface PortalChecklistDetail extends PortalChecklistSummary {
  payload: unknown;
}

export interface PortalReturnSummary {
  id: string;
  source_session_id: string;
  unit_id: string;
  user_id: string | null;
  seller_name: string;
  reason: string;
  total_items: number;
  total_quantity: number;
  finished_at: string | null;
  received_at: string;
}

export interface PortalReturnDetail extends PortalReturnSummary {
  payload: unknown;
}
