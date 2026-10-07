export type UniformTagStatus = 'livre' | 'em_uso';
export type UniformMovementType = 'entrada' | 'saida';

export interface UniformItem {
  id: string;
  name: string;
  size: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUniformItemInput {
  name: string;
  size: string;
}

export interface UniformTag {
  id: string;
  status: UniformTagStatus;
  uniformItemId: string | null;
  uniformName: string | null;
  uniformSize: string | null;
  unitId: string | null;
  unitName: string | null;
  locationLabel: string | null;
  quantity: number;
  batchLabel: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GenerateTagsInput {
  quantity: number;
  batchLabel?: string | null;
}

export interface EntradaInput {
  uniformItemId: string;
  quantity: number;
  unitId: string;
  locationLabel?: string | null;
  userId?: string | null;
}

export interface SaidaInput {
  quantity: number;
  destinationUnitId: string;
  userId?: string | null;
}

export interface UniformStockRow {
  unitId: string;
  unitName: string;
  uniformItemId: string;
  uniformName: string;
  uniformSize: string;
  quantity: number;
  locationLabel: string | null;
  tagIds: string[] | null;
  updatedAt: string;
}

export interface UniformUnitStockRow {
  unitId: string;
  unitName: string;
  uniformItemId: string;
  uniformName: string;
  uniformSize: string;
  quantity: number;
}

export interface UniformTagFilters {
  status?: UniformTagStatus;
  unitId?: string;
  batchLabel?: string;
}
