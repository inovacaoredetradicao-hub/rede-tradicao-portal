export type CountFrequency = 'unica' | 'diario' | 'quinzenal' | 'mensal';
export type AlertStatus = 'pendente' | 'em_andamento' | 'concluido' | 'vencido';
export type OperationalAlertBatchType = 'product' | 'classification';

export interface OperationalCountRule {
  id: string;
  productId: string;
  barcode: string;
  productName: string;
  unitId: string;
  unitName: string;
  frequency: CountFrequency;
  executionDeadlineMinutes: number;
  isActive: boolean;
  startDate: string;
  endDate: string | null;
  responsibleUserId: string | null;
  responsibleUserName: string | null;
  classificationLabel?: string | null;
  groupId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OperationalAlertBatchItem {
  id: string;
  batchId: string;
  ruleId: string;
  productId: string;
  barcode: string;
  productName: string;
}

export interface OperationalAlertBatch {
  id: string;
  type: OperationalAlertBatchType;
  classificationKey: string | null;
  classificationLabel: string | null;
  title: string;
  description: string;
  unitId: string;
  unitName: string;
  responsibleUserId: string | null;
  responsibleUserName: string | null;
  scheduledAt: string;
  dueAt: string;
  status: AlertStatus;
  linkedAuditSessionId: string | null;
  createdAt: string;
  updatedAt: string;
  items: OperationalAlertBatchItem[];
}

export interface RuleFilters {
  unitId?: string;
  productId?: string;
  responsibleUserId?: string;
  isActive?: boolean;
}

export interface AlertFilters {
  status?: AlertStatus;
  unitId?: string;
  productId?: string;
  responsibleUserId?: string;
}

export interface CreateRuleInput {
  productId: string;
  barcode: string;
  productName: string;
  unitId: string;
  unitName: string;
  frequency: CountFrequency;
  executionDeadlineMinutes: number;
  isActive: boolean;
  startDate: string;
  endDate?: string | null;
  responsibleUserId?: string | null;
  responsibleUserName?: string | null;
  groupId?: string | null;
}

export interface UpdateRuleInput extends Partial<CreateRuleInput> {}

export interface CompleteAlertInput {
  auditSessionId: string;
}

export interface DashboardSummary {
  totalPending: number;
  totalInProgress: number;
  totalCompleted: number;
  totalExpired: number;
}

export interface ResponsibleUserLookup {
  id: string;
  name: string;
}

export type OperationalAuditResultStatus = 'OK' | 'Divergente';

export interface OperationalAuditResult {
  id: string;
  sourceSessionId: string;
  operationalAlertId: string | null;
  productName: string | null;
  unitId: string | null;
  unitName: string | null;
  userId: string | null;
  sellerName: string | null;
  stockType: string | null;
  countMode: string | null;
  resultStatus: OperationalAuditResultStatus;
  accuracy: number | null;
  totalItems: number;
  totalDivergences: number;
  finishedAt: string | null;
  payload: unknown;
}

export interface AuditResultFilters {
  unitId?: string;
  sellerName?: string;
  resultStatus?: OperationalAuditResultStatus;
  productSearch?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface CreateBatchInput {
  type: OperationalAlertBatchType;
  classificationKey: string;
  classificationLabel: string;
  unitId: string;
  unitName: string;
  responsibleUserId: string | null;
  responsibleUserName: string | null;
  scheduledAt: string;
  dueAt: string;
  status: AlertStatus;
  linkedAuditSessionId: string | null;
  items: Array<{
    ruleId: string;
    productId: string;
    barcode: string;
    productName: string;
  }>;
}

export interface BatchGroupLookup {
  type: OperationalAlertBatchType;
  classificationKey: string;
  unitId: string;
  responsibleUserId: string | null;
  scheduledAt: string;
}
