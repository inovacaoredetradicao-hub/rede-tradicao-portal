export type CountFrequency = 'unica' | 'diario' | 'quinzenal' | 'mensal';
export type OperationalAlertStatus = 'pendente' | 'em_andamento' | 'concluido' | 'vencido';

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
  groupId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OperationalCountAlert {
  id: string;
  ruleId: string;
  productId: string;
  barcode: string;
  productName: string;
  unitId: string;
  unitName: string;
  responsibleUserId: string | null;
  responsibleUserName: string | null;
  scheduledAt: string;
  dueAt: string;
  status: OperationalAlertStatus;
  linkedAuditSessionId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  expiredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OperationalAlertsDashboardSummary {
  totalPending: number;
  totalInProgress: number;
  totalCompleted: number;
  totalExpired: number;
}

export interface OperationalRulePayload {
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
  groupId?: string | null;
}

export interface OperationalRuleBatchPayload {
  mode: 'classification' | 'product';
  classificationKey?: string;
  classificationLabel?: string;
  payloads: OperationalRulePayload[];
}

export interface OperationalRuleEditPayload {
  mode: 'edit';
  payload: OperationalRulePayload;
}

/** Edicao de um lote inteiro: so os campos comuns (produto e filial nao mudam). */
export interface OperationalRuleBatchEditPayload {
  mode: 'edit-batch';
  ruleIds: string[];
  changes: Partial<
    Pick<
      OperationalRulePayload,
      'frequency' | 'executionDeadlineMinutes' | 'isActive' | 'startDate' | 'endDate' | 'responsibleUserId' | 'responsibleUserName'
    >
  >;
}

export type OperationalRuleSubmitInput =
  | OperationalRuleEditPayload
  | OperationalRuleBatchPayload
  | OperationalRuleBatchEditPayload;

/** Lote aberto para edicao na tela de Gestao de contagens. */
export interface EditingRuleGroup {
  ruleIds: string[];
  title: string;
  type: 'product' | 'classification';
  productCount: number;
  /** Quantos responsaveis diferentes o lote tem (com mais de 1, o responsavel nao muda). */
  responsibleCount: number;
  products: RuleGroupProduct[];
}

export interface OperationalRuleSubmitResult {
  mode: 'product' | 'classification';
  createdCount: number;
  skippedCount: number;
  classificationLabel?: string;
}

export interface OperationalProductOption {
  id: string;
  productCode?: string;
  barcode: string;
  name: string;
  classification?: string;
  classificationKey?: string;
  stockType?: string;
  subGroup?: string;
  displayLabel: string;
  /** Estoque na filial escolhida (ou total), quando a busca pede. */
  stockTotal?: number;
}

export interface OperationalClassificationOption {
  key: string;
  label: string;
  productCount: number;
  products: OperationalProductOption[];
}

export interface OperationalRuleListItem {
  id: string;
  type: 'product' | 'classification';
  title: string;
  subtitle?: string;
  unitName: string;
  frequency: CountFrequency;
  executionDeadlineMinutes: number;
  isActive: boolean;
  responsibleUserId: string | null;
  responsibleUserName: string | null;
  ruleIds: string[];
  productCount: number;
  startDate: string;
  endDate: string | null;
  representativeRule?: OperationalCountRule;
  searchText: string;
  responsibleCount?: number;
  /** Produtos do lote (para listar dentro do "Editar"; a tabela nao mostra). */
  products?: RuleGroupProduct[];
}

export interface RuleGroupProduct {
  id: string;
  name: string;
  barcode: string;
}

export interface OperationalUnitOption {
  id: string;
  name: string;
  displayLabel: string;
}

export interface OperationalUserOption {
  id: string;
  name: string;
  username: string;
  role: string;
  isActive: boolean;
}

export interface UnitOption {
  id: string;
  name: string;
  code?: string;
}

export interface OperationalRuleFilters {
  productSearch: string;
  unitSearch: string;
  showOnlyActive: boolean;
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

export interface OperationalAuditResultFilters {
  productSearch: string;
  unitSearch: string;
  sellerSearch: string;
  status: 'todos' | OperationalAuditResultStatus;
  dateFrom: string;
  dateTo: string;
}
