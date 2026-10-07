import { randomBytes } from 'node:crypto';
import { pool, query } from '../../lib/db.js';
import {
  CreateUniformItemInput,
  EntradaInput,
  GenerateTagsInput,
  SaidaInput,
  UniformItem,
  UniformStockRow,
  UniformTag,
  UniformTagFilters,
  UniformUnitStockRow,
} from './uniforms.types.js';

const itemSelect = `
  id,
  name,
  size,
  is_active AS "isActive",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

const tagSelect = `
  uniform_tags.id,
  uniform_tags.status,
  uniform_tags.uniform_item_id AS "uniformItemId",
  uniform_items.name AS "uniformName",
  uniform_items.size AS "uniformSize",
  uniform_tags.unit_id AS "unitId",
  units.name AS "unitName",
  uniform_tags.location_label AS "locationLabel",
  uniform_tags.quantity,
  uniform_tags.batch_label AS "batchLabel",
  uniform_tags.created_at AS "createdAt",
  uniform_tags.updated_at AS "updatedAt"
`;

function generateTagCode() {
  return `UNF-${randomBytes(4).toString('hex').toUpperCase()}`;
}

export class UniformsRepository {
  async listItems(includeInactive = false) {
    const clause = includeInactive ? '' : 'WHERE is_active = true';
    const result = await query<UniformItem>(
      `SELECT ${itemSelect} FROM uniform_items ${clause} ORDER BY name ASC, size ASC`,
    );
    return result.rows;
  }

  async createItem(input: CreateUniformItemInput) {
    const result = await query<UniformItem>(
      `
        INSERT INTO uniform_items (name, size)
        VALUES ($1, $2)
        ON CONFLICT (name, size) DO UPDATE SET is_active = true, updated_at = NOW()
        RETURNING ${itemSelect}
      `,
      [input.name.trim(), input.size.trim()],
    );
    return result.rows[0];
  }

  async generateTags(input: GenerateTagsInput) {
    const codes = Array.from({ length: input.quantity }, () => generateTagCode());
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      const tags: UniformTag[] = [];

      for (const code of codes) {
        const result = await client.query<{
          id: string;
          status: UniformTag['status'];
          locationLabel: string | null;
          quantity: number;
          batchLabel: string | null;
          createdAt: string;
          updatedAt: string;
        }>(
          `
            INSERT INTO uniform_tags (id, status, batch_label)
            VALUES ($1, 'livre', $2)
            RETURNING
              id,
              status,
              location_label AS "locationLabel",
              quantity,
              batch_label AS "batchLabel",
              created_at AS "createdAt",
              updated_at AS "updatedAt"
          `,
          [code, input.batchLabel ?? null],
        );
        const row = result.rows[0];
        tags.push({
          ...row,
          uniformItemId: null,
          uniformName: null,
          uniformSize: null,
          unitId: null,
          unitName: null,
        });
      }

      await client.query('COMMIT');
      return tags;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async listTags(filters: UniformTagFilters = {}) {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    if (filters.status) {
      conditions.push(`uniform_tags.status = $${index}`);
      values.push(filters.status);
      index += 1;
    }

    if (filters.unitId) {
      conditions.push(`uniform_tags.unit_id = $${index}`);
      values.push(filters.unitId);
      index += 1;
    }

    if (filters.batchLabel) {
      conditions.push(`uniform_tags.batch_label = $${index}`);
      values.push(filters.batchLabel);
      index += 1;
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query<UniformTag>(
      `
        SELECT ${tagSelect}
        FROM uniform_tags
        LEFT JOIN uniform_items ON uniform_items.id = uniform_tags.uniform_item_id
        LEFT JOIN units ON units.id = uniform_tags.unit_id
        ${whereClause}
        ORDER BY uniform_tags.created_at DESC
      `,
      values,
    );

    return result.rows;
  }

  async getTagById(tagId: string) {
    const result = await query<UniformTag>(
      `
        SELECT ${tagSelect}
        FROM uniform_tags
        LEFT JOIN uniform_items ON uniform_items.id = uniform_tags.uniform_item_id
        LEFT JOIN units ON units.id = uniform_tags.unit_id
        WHERE uniform_tags.id = $1
      `,
      [tagId],
    );

    return result.rows[0] ?? null;
  }

  private async bumpUnitStock(client: import('pg').PoolClient, unitId: string, uniformItemId: string, delta: number) {
    await client.query(
      `
        INSERT INTO uniform_unit_stock (unit_id, uniform_item_id, quantity, updated_at)
        VALUES ($1, $2, GREATEST($3, 0), NOW())
        ON CONFLICT (unit_id, uniform_item_id) DO UPDATE SET
          quantity = GREATEST(uniform_unit_stock.quantity + $3, 0),
          updated_at = NOW()
      `,
      [unitId, uniformItemId, delta],
    );
  }

  async registerEntrada(tagId: string, input: EntradaInput) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const existing = await client.query<{ id: string; uniform_item_id: string | null; unit_id: string | null }>(
        `SELECT id, uniform_item_id, unit_id FROM uniform_tags WHERE id = $1 FOR UPDATE`,
        [tagId],
      );

      if (!existing.rows[0]) {
        throw new Error('Etiqueta nao encontrada.');
      }

      const current = existing.rows[0];
      if (current.uniform_item_id && current.uniform_item_id !== input.uniformItemId) {
        throw new Error('Esta etiqueta ja esta vinculada a outro modelo de uniforme.');
      }
      if (current.unit_id && current.unit_id !== input.unitId) {
        throw new Error('Esta etiqueta ja esta vinculada a outra unidade. Faca uma saida antes de mover.');
      }

      await client.query(
        `
          UPDATE uniform_tags SET
            status = 'em_uso',
            uniform_item_id = $2,
            unit_id = $3,
            location_label = COALESCE($4, location_label),
            quantity = quantity + $5,
            updated_at = NOW()
          WHERE id = $1
        `,
        [tagId, input.uniformItemId, input.unitId, input.locationLabel ?? null, input.quantity],
      );

      await client.query(
        `
          INSERT INTO uniform_stock_movements (tag_id, uniform_item_id, type, quantity, unit_id, location_label, user_id)
          VALUES ($1, $2, 'entrada', $3, $4, $5, $6)
        `,
        [tagId, input.uniformItemId, input.quantity, input.unitId, input.locationLabel ?? null, input.userId ?? null],
      );

      await this.bumpUnitStock(client, input.unitId, input.uniformItemId, input.quantity);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return this.getTagById(tagId);
  }

  async registerSaida(tagId: string, input: SaidaInput) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const existing = await client.query<{
        id: string;
        uniform_item_id: string | null;
        unit_id: string | null;
        quantity: number;
      }>(`SELECT id, uniform_item_id, unit_id, quantity FROM uniform_tags WHERE id = $1 FOR UPDATE`, [tagId]);

      const current = existing.rows[0];
      if (!current || !current.uniform_item_id || !current.unit_id) {
        throw new Error('Esta etiqueta ainda nao tem entrada registrada.');
      }

      if (input.quantity > current.quantity) {
        throw new Error(`Quantidade indisponivel. Estoque atual nesta etiqueta: ${current.quantity}.`);
      }

      if (input.destinationUnitId === current.unit_id) {
        throw new Error('A unidade de destino deve ser diferente da unidade atual da etiqueta.');
      }

      await client.query(
        `UPDATE uniform_tags SET quantity = quantity - $2, updated_at = NOW() WHERE id = $1`,
        [tagId, input.quantity],
      );

      await client.query(
        `
          INSERT INTO uniform_stock_movements (tag_id, uniform_item_id, type, quantity, unit_id, from_unit_id, user_id)
          VALUES ($1, $2, 'saida', $3, $4, $5, $6)
        `,
        [tagId, current.uniform_item_id, input.quantity, input.destinationUnitId, current.unit_id, input.userId ?? null],
      );

      await this.bumpUnitStock(client, current.unit_id, current.uniform_item_id, -input.quantity);
      await this.bumpUnitStock(client, input.destinationUnitId, current.uniform_item_id, input.quantity);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return this.getTagById(tagId);
  }

  async getStock(unitId?: string) {
    // Baseado em uniform_unit_stock (sempre correto, inclusive uniformes que
    // chegaram por transferencia/saida e por isso nao tem etiqueta propria
    // naquela unidade). O local mostrado e o das etiquetas que efetivamente
    // estao ali, quando existirem; senao fica em branco.
    const conditions = ['uniform_unit_stock.quantity > 0'];
    const values: unknown[] = [];

    if (unitId) {
      conditions.push(`uniform_unit_stock.unit_id = $1`);
      values.push(unitId);
    }

    const result = await query<UniformStockRow>(
      `
        SELECT
          uniform_unit_stock.unit_id AS "unitId",
          units.name AS "unitName",
          uniform_unit_stock.uniform_item_id AS "uniformItemId",
          uniform_items.name AS "uniformName",
          uniform_items.size AS "uniformSize",
          uniform_unit_stock.quantity,
          uniform_unit_stock.updated_at AS "updatedAt",
          (
            SELECT string_agg(DISTINCT tags.location_label, ', ' ORDER BY tags.location_label)
            FROM uniform_tags tags
            WHERE tags.unit_id = uniform_unit_stock.unit_id
              AND tags.uniform_item_id = uniform_unit_stock.uniform_item_id
              AND tags.quantity > 0
              AND tags.location_label IS NOT NULL
          ) AS "locationLabel",
          (
            SELECT array_agg(tags.id)
            FROM uniform_tags tags
            WHERE tags.unit_id = uniform_unit_stock.unit_id
              AND tags.uniform_item_id = uniform_unit_stock.uniform_item_id
              AND tags.quantity > 0
          ) AS "tagIds"
        FROM uniform_unit_stock
        JOIN uniform_items ON uniform_items.id = uniform_unit_stock.uniform_item_id
        JOIN units ON units.id = uniform_unit_stock.unit_id
        WHERE ${conditions.join(' AND ')}
        ORDER BY units.name ASC, uniform_items.name ASC, uniform_items.size ASC
      `,
      values,
    );

    return result.rows;
  }

  async getStockByUnit() {
    const result = await query<UniformUnitStockRow>(
      `
        SELECT
          uniform_unit_stock.unit_id AS "unitId",
          units.name AS "unitName",
          uniform_unit_stock.uniform_item_id AS "uniformItemId",
          uniform_items.name AS "uniformName",
          uniform_items.size AS "uniformSize",
          uniform_unit_stock.quantity
        FROM uniform_unit_stock
        JOIN units ON units.id = uniform_unit_stock.unit_id
        JOIN uniform_items ON uniform_items.id = uniform_unit_stock.uniform_item_id
        WHERE uniform_unit_stock.quantity > 0
        ORDER BY units.name ASC, uniform_items.name ASC, uniform_items.size ASC
      `,
    );

    return result.rows;
  }
}
