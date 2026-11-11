export type UniformTagStatus = 'livre' | 'em_uso';

export interface UniformItem {
  id: string;
  name: string;
  size: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
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

export type UniformShipmentStatus = 'em_transito' | 'recebido' | 'cancelado';

export interface UniformShipmentItem {
  tagId: string;
  uniformItemId: string;
  uniformName: string;
  uniformSize: string;
  quantity: number;
}

export interface UniformShipment {
  id: string;
  code: string;
  status: UniformShipmentStatus;
  note: string | null;
  fromUnitId: string;
  fromUnitName: string;
  toUnitId: string;
  toUnitName: string;
  createdByName: string | null;
  createdAt: string;
  receivedByName: string | null;
  receivedAt: string | null;
  cancelledByName: string | null;
  cancelledAt: string | null;
  totalQuantity: number;
  items: UniformShipmentItem[];
}
