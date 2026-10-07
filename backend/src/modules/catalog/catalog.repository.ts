import { query } from '../../lib/db.js';
import { CatalogProduct, CatalogUnit } from './catalog.types.js';

const productSelect = `
  id,
  product_code AS "productCode",
  barcode,
  name,
  classification,
  sub_group AS "subGroup",
  stock_type AS "stockType",
  is_active AS "isActive"
`;

const unitSelect = `
  id,
  code,
  name,
  city,
  state,
  is_active AS "isActive"
`;

export class CatalogRepository {
  async listProducts() {
    const result = await query<CatalogProduct>(
      `
        SELECT ${productSelect}
        FROM products
        WHERE is_active = true
        ORDER BY name ASC
      `,
    );

    return result.rows;
  }

  async listUnits() {
    const result = await query<CatalogUnit>(
      `
        SELECT ${unitSelect}
        FROM units
        WHERE is_active = true
        ORDER BY name ASC
      `,
    );

    return result.rows;
  }
}
