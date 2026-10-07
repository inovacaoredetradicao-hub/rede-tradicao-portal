export interface CatalogProduct {
  id: string;
  productCode: string | null;
  barcode: string | null;
  name: string;
  classification: string | null;
  subGroup: string | null;
  stockType: string | null;
  isActive: boolean;
}

export interface CatalogUnit {
  id: string;
  code: string | null;
  name: string;
  city: string | null;
  state: string | null;
  isActive: boolean;
}
