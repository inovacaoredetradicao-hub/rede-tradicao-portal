import { randomInt } from 'node:crypto';
import { Request, Response, Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { pool, query } from '../../lib/db.js';

// Remessas de uniformes (Separar e enviar): o RH da matriz bipa as etiquetas das pecas,
// escolhe a filial e envia. A remessa fica "em_transito" com um codigo/QR (REM-XXXXXX)
// que vai junto das pecas. Ao enviar, as pecas ja saem do estoque de origem (ficam "em
// transito"). Quando a filial (ou a Gestao, pelo portal) confirma o recebimento, entram
// no estoque da filial. Se a remessa for cancelada, voltam para o estoque de origem.
// Remessas antigas (stock_deducted = false) seguem a regra anterior: so baixavam a
// origem na confirmacao.

type ShipmentStatus = 'em_transito' | 'recebido' | 'cancelado';
type SessionUser = { id: string; name: string; username: string; role: string };

class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function ensureShipmentTables() {
  // So cria o que ainda nao existe: nenhum dado e apagado ou alterado.
  await query(`
    CREATE TABLE IF NOT EXISTS uniform_shipments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code TEXT NOT NULL UNIQUE,
      from_unit_id UUID NOT NULL REFERENCES units(id),
      to_unit_id UUID NOT NULL REFERENCES units(id),
      status TEXT NOT NULL DEFAULT 'em_transito' CHECK (status IN ('em_transito', 'recebido', 'cancelado')),
      note TEXT NULL,
      created_by_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
      created_by_name TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      received_by_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
      received_by_name TEXT NULL,
      received_at TIMESTAMPTZ NULL,
      cancelled_by_name TEXT NULL,
      cancelled_at TIMESTAMPTZ NULL
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS uniform_shipment_items (
      shipment_id UUID NOT NULL REFERENCES uniform_shipments(id) ON DELETE CASCADE,
      tag_id TEXT NOT NULL REFERENCES uniform_tags(id),
      uniform_item_id UUID NOT NULL REFERENCES uniform_items(id),
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      PRIMARY KEY (shipment_id, tag_id)
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_uniform_shipments_status ON uniform_shipments (status, created_at DESC)`);
  await query(`ALTER TABLE uniform_stock_movements ADD COLUMN IF NOT EXISTS shipment_id UUID NULL REFERENCES uniform_shipments(id)`);
  // So acrescenta colunas; remessas ja existentes ficam com stock_deducted = false.
  await query(`ALTER TABLE uniform_shipments ADD COLUMN IF NOT EXISTS stock_deducted BOOLEAN NOT NULL DEFAULT false`);
  await query(`ALTER TABLE uniform_shipments ADD COLUMN IF NOT EXISTS received_via TEXT NULL`);
}

type Queryable = { query: typeof pool.query };

async function bumpUnitStock(client: Queryable, unitId: string, uniformItemId: string, delta: number) {
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

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateShipmentCode() {
  let code = 'REM-';
  for (let i = 0; i < 6; i += 1) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

function normalizeCode(value: unknown) {
  const raw = String(value ?? '').trim().toUpperCase().replace(/\s+/g, '');
  if (!raw) return '';
  return raw.startsWith('REM-') ? raw : raw.startsWith('REM') ? `REM-${raw.slice(3)}` : `REM-${raw}`;
}

function sessionUser(response: Response) {
  return response.locals.sessionUser as SessionUser;
}

// Mesma regra do resto do sistema: Gestao (admin) ve tudo; quem tem filiais vinculadas
// so atua nelas; usuario sem vinculo ve tudo.
async function scopedUnitIds(user: SessionUser): Promise<string[] | null> {
  if (user.role === 'admin') return null;
  const result = await query<{ unit_id: string }>(`SELECT unit_id::text AS unit_id FROM user_units WHERE user_id = $1`, [user.id]);
  return result.rows.length ? result.rows.map((row) => row.unit_id) : null;
}

const canSend = (user: SessionUser) => user.role === 'rh' || user.role === 'admin';

const shipmentSelect = `
  s.id,
  s.code,
  s.status,
  s.note,
  s.from_unit_id AS "fromUnitId",
  fu.name AS "fromUnitName",
  s.to_unit_id AS "toUnitId",
  tu.name AS "toUnitName",
  s.created_by_name AS "createdByName",
  s.created_at AS "createdAt",
  s.received_by_name AS "receivedByName",
  s.received_at AS "receivedAt",
  s.cancelled_by_name AS "cancelledByName",
  s.cancelled_at AS "cancelledAt",
  s.received_via AS "receivedVia",
  COALESCE((SELECT SUM(i.quantity) FROM uniform_shipment_items i WHERE i.shipment_id = s.id), 0)::int AS "totalQuantity",
  COALESCE((
    SELECT json_agg(json_build_object(
      'tagId', i.tag_id,
      'uniformItemId', i.uniform_item_id,
      'uniformName', ui.name,
      'uniformSize', ui.size,
      'quantity', i.quantity
    ) ORDER BY ui.name, ui.size, i.tag_id)
    FROM uniform_shipment_items i
    JOIN uniform_items ui ON ui.id = i.uniform_item_id
    WHERE i.shipment_id = s.id
  ), '[]'::json) AS items
`;

const shipmentFrom = `
  FROM uniform_shipments s
  JOIN units fu ON fu.id = s.from_unit_id
  JOIN units tu ON tu.id = s.to_unit_id
`;

async function getShipment(where: string, value: string) {
  const result = await query(`SELECT ${shipmentSelect} ${shipmentFrom} WHERE ${where} = $1`, [value]);
  return result.rows[0] ?? null;
}

// Quanto da etiqueta ainda pode ser enviado: estoque da etiqueta menos o que esta
// reservado em remessas antigas em transito (as novas ja baixaram a etiqueta ao enviar).
async function availableByTag(client: Queryable, tagIds: string[], ignoreShipmentId?: string) {
  const result = await client.query<{
    id: string;
    unit_id: string | null;
    uniform_item_id: string | null;
    quantity: number;
    reserved: number;
  }>(
    `
      SELECT t.id, t.unit_id::text AS unit_id, t.uniform_item_id::text AS uniform_item_id, t.quantity,
        COALESCE((
          SELECT SUM(i.quantity) FROM uniform_shipment_items i
          JOIN uniform_shipments s ON s.id = i.shipment_id
          WHERE i.tag_id = t.id AND s.status = 'em_transito' AND NOT s.stock_deducted
            AND ($2::uuid IS NULL OR s.id <> $2::uuid)
        ), 0)::int AS reserved
      FROM uniform_tags t
      WHERE t.id = ANY($1::text[])
    `,
    [tagIds, ignoreShipmentId ?? null],
  );
  return new Map(result.rows.map((row) => [row.id, row]));
}

export function createUniformShipmentsRouter() {
  const router = Router();

  // Todas as filiais (destino da remessa). Separado de /units do app, que e filtrado
  // pelas filiais do usuario.
  router.get(
    '/units',
    asyncHandler(async (_request: Request, response: Response) => {
      const result = await query(`SELECT id::text AS id, name FROM units WHERE is_active ORDER BY name ASC`);
      response.json(result.rows);
    }),
  );

  // Disponivel para envio de uma etiqueta (ao bipar no app).
  router.get(
    '/tags/:id/available',
    asyncHandler(async (request: Request, response: Response) => {
      const tagId = String(request.params.id).trim().toUpperCase();
      const tag = await query<{
        id: string;
        status: string;
        unit_id: string | null;
        unit_name: string | null;
        uniform_item_id: string | null;
        uniform_name: string | null;
        uniform_size: string | null;
      }>(
        `
          SELECT t.id, t.status, t.unit_id::text AS unit_id, u.name AS unit_name, t.uniform_item_id::text AS uniform_item_id,
            ui.name AS uniform_name, ui.size AS uniform_size
          FROM uniform_tags t
          LEFT JOIN units u ON u.id = t.unit_id
          LEFT JOIN uniform_items ui ON ui.id = t.uniform_item_id
          WHERE t.id = $1
        `,
        [tagId],
      );
      const row = tag.rows[0];
      if (!row) throw new HttpError(404, 'Etiqueta nao encontrada.');
      if (row.status !== 'em_uso' || !row.unit_id || !row.uniform_item_id) {
        throw new HttpError(400, 'Esta etiqueta ainda nao tem entrada de estoque.');
      }
      const map = await availableByTag(pool, [tagId]);
      const info = map.get(tagId)!;
      response.json({
        tagId,
        unitId: row.unit_id,
        unitName: row.unit_name,
        uniformItemId: row.uniform_item_id,
        uniformName: row.uniform_name,
        uniformSize: row.uniform_size,
        quantity: info.quantity,
        reserved: info.reserved,
        available: Math.max(info.quantity - info.reserved, 0),
      });
    }),
  );

  // Lista de remessas. Filtros: status (lista separada por virgula), unitId (origem ou
  // destino), direction=entrada|saida (relativo as filiais do usuario), from/to (datas).
  router.get(
    '/',
    asyncHandler(async (request: Request, response: Response) => {
      const user = sessionUser(response);
      const conditions: string[] = [];
      const values: unknown[] = [];
      const statuses = String(request.query.status ?? '')
        .split(',')
        .map((item) => item.trim())
        .filter((item) => ['em_transito', 'recebido', 'cancelado'].includes(item));
      if (statuses.length) {
        values.push(statuses);
        conditions.push(`s.status = ANY($${values.length}::text[])`);
      }
      const unitId = String(request.query.unitId ?? '').trim();
      if (unitId && unitId !== 'all') {
        values.push(unitId);
        conditions.push(`(s.from_unit_id::text = $${values.length} OR s.to_unit_id::text = $${values.length})`);
      }
      const from = String(request.query.from ?? '').trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(from)) {
        values.push(from);
        conditions.push(`s.created_at >= $${values.length}::date`);
      }
      const to = String(request.query.to ?? '').trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(to)) {
        values.push(to);
        conditions.push(`s.created_at < $${values.length}::date + 1`);
      }
      const scoped = await scopedUnitIds(user);
      if (scoped) {
        values.push(scoped);
        const direction = String(request.query.direction ?? '');
        if (direction === 'entrada') conditions.push(`s.to_unit_id::text = ANY($${values.length}::text[])`);
        else if (direction === 'saida') conditions.push(`s.from_unit_id::text = ANY($${values.length}::text[])`);
        else conditions.push(`(s.from_unit_id::text = ANY($${values.length}::text[]) OR s.to_unit_id::text = ANY($${values.length}::text[]))`);
      }
      const limit = Math.min(Math.max(Number(request.query.limit ?? 300) || 300, 1), 1000);
      const result = await query(
        `SELECT ${shipmentSelect} ${shipmentFrom} ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
         ORDER BY s.created_at DESC LIMIT ${limit}`,
        values,
      );
      response.json(result.rows);
    }),
  );

  // Busca pelo codigo lido no QR (ou digitado).
  router.get(
    '/code/:code',
    asyncHandler(async (request: Request, response: Response) => {
      const code = normalizeCode(request.params.code);
      const shipment = await getShipment('s.code', code);
      if (!shipment) throw new HttpError(404, `Remessa ${code} nao encontrada. Confira o codigo.`);
      response.json(shipment);
    }),
  );

  // Cria a remessa (RH/Gestao). Body: { toUnitId, note?, items: [{ tagId, quantity }] }
  router.post(
    '/',
    asyncHandler(async (request: Request, response: Response) => {
      const user = sessionUser(response);
      if (!canSend(user)) throw new HttpError(403, 'Somente o RH (Matriz) pode separar e enviar uniformes.');

      const toUnitId = String(request.body?.toUnitId ?? '').trim();
      const note = String(request.body?.note ?? '').trim() || null;
      const merged = new Map<string, number>();
      for (const item of Array.isArray(request.body?.items) ? request.body.items : []) {
        const tagId = String(item?.tagId ?? '').trim().toUpperCase();
        const quantity = Math.floor(Number(item?.quantity));
        if (!tagId || !Number.isFinite(quantity) || quantity < 1) continue;
        merged.set(tagId, (merged.get(tagId) ?? 0) + quantity);
      }
      if (!toUnitId) throw new HttpError(400, 'Selecione a filial de destino.');
      if (!merged.size) throw new HttpError(400, 'Bipe ao menos um uniforme para a remessa.');

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const tagIds = [...merged.keys()];
        // Trava as etiquetas para duas remessas simultaneas nao reservarem a mesma peca.
        await client.query(`SELECT id FROM uniform_tags WHERE id = ANY($1::text[]) FOR UPDATE`, [tagIds]);
        const info = await availableByTag(client, tagIds);

        const origins = new Set<string>();
        for (const [tagId, quantity] of merged) {
          const tag = info.get(tagId);
          if (!tag) throw new HttpError(400, `Etiqueta ${tagId} nao encontrada.`);
          if (!tag.unit_id || !tag.uniform_item_id) throw new HttpError(400, `Etiqueta ${tagId} ainda nao tem entrada de estoque.`);
          const available = tag.quantity - tag.reserved;
          if (quantity > available) {
            throw new HttpError(400, `Etiqueta ${tagId}: so ha ${Math.max(available, 0)} peca(s) disponivel(is) para envio.`);
          }
          origins.add(tag.unit_id);
        }
        if (origins.size > 1) throw new HttpError(400, 'Todas as pecas da remessa precisam estar no mesmo estoque de origem.');
        const fromUnitId = [...origins][0];
        if (fromUnitId === toUnitId) throw new HttpError(400, 'A filial de destino e a mesma do estoque de origem.');

        const scoped = await scopedUnitIds(user);
        if (scoped && !scoped.includes(fromUnitId)) {
          throw new HttpError(403, 'Estas pecas sao de um estoque que nao esta vinculado ao seu usuario.');
        }
        const dest = await client.query(`SELECT 1 FROM units WHERE id::text = $1`, [toUnitId]);
        if (!dest.rowCount) throw new HttpError(400, 'Filial de destino nao encontrada.');

        let shipmentId = '';
        for (let attempt = 0; attempt < 5 && !shipmentId; attempt += 1) {
          const created = await client.query<{ id: string }>(
            `
              INSERT INTO uniform_shipments (code, from_unit_id, to_unit_id, note, created_by_id, created_by_name, stock_deducted)
              VALUES ($1, $2, $3, $4, $5, $6, true)
              ON CONFLICT (code) DO NOTHING
              RETURNING id
            `,
            [generateShipmentCode(), fromUnitId, toUnitId, note, user.id, user.name],
          );
          shipmentId = created.rows[0]?.id ?? '';
        }
        if (!shipmentId) throw new Error('Nao foi possivel gerar o codigo da remessa. Tente de novo.');

        // As pecas ja saem do estoque de origem no envio.
        for (const [tagId, quantity] of merged) {
          const uniformItemId = info.get(tagId)!.uniform_item_id!;
          await client.query(
            `INSERT INTO uniform_shipment_items (shipment_id, tag_id, uniform_item_id, quantity) VALUES ($1, $2, $3, $4)`,
            [shipmentId, tagId, uniformItemId, quantity],
          );
          const updated = await client.query(
            `UPDATE uniform_tags SET quantity = quantity - $2, updated_at = NOW() WHERE id = $1 AND quantity >= $2`,
            [tagId, quantity],
          );
          if (!updated.rowCount) throw new HttpError(409, `Etiqueta ${tagId}: estoque insuficiente para o envio.`);
          await client.query(
            `
              INSERT INTO uniform_stock_movements (tag_id, uniform_item_id, type, quantity, unit_id, from_unit_id, user_id, shipment_id)
              VALUES ($1, $2, 'saida', $3, $4, $5, $6, $7)
            `,
            [tagId, uniformItemId, quantity, toUnitId, fromUnitId, user.id, shipmentId],
          );
          await bumpUnitStock(client, fromUnitId, uniformItemId, -quantity);
        }
        await client.query('COMMIT');
        response.status(201).json(await getShipment('s.id', shipmentId));
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }),
  );

  // Confirma o recebimento (filial no app ou Gestao/RH no portal): entra no estoque da filial.
  router.post(
    '/:id/receive',
    asyncHandler(async (request: Request, response: Response) => {
      const user = sessionUser(response);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const found = await client.query<{
          id: string;
          code: string;
          status: ShipmentStatus;
          from_unit_id: string;
          to_unit_id: string;
          stock_deducted: boolean;
        }>(
          `SELECT id, code, status, from_unit_id::text AS from_unit_id, to_unit_id::text AS to_unit_id, stock_deducted
           FROM uniform_shipments WHERE id::text = $1 FOR UPDATE`,
          [String(request.params.id)],
        );
        const shipment = found.rows[0];
        if (!shipment) throw new HttpError(404, 'Remessa nao encontrada.');
        if (shipment.status === 'recebido') throw new HttpError(409, `A remessa ${shipment.code} ja foi recebida.`);
        if (shipment.status === 'cancelado') throw new HttpError(409, `A remessa ${shipment.code} foi cancelada pelo RH.`);

        // Pode confirmar: a filial de destino, ou o RH/Gestao responsavel pela origem
        // (enquanto as filiais ainda nao confirmam pelo app, a confirmacao e feita no portal).
        const scoped = await scopedUnitIds(user);
        const isDestination = !scoped || scoped.includes(shipment.to_unit_id);
        const isSender = canSend(user) && (!scoped || scoped.includes(shipment.from_unit_id));
        if (!isDestination && !isSender) {
          throw new HttpError(403, 'Esta remessa e de outra filial. Somente a filial de destino confirma o recebimento.');
        }
        const via = request.body?.via === 'portal' ? 'portal' : 'app';

        const items = await client.query<{ tag_id: string; uniform_item_id: string; quantity: number }>(
          `SELECT tag_id, uniform_item_id::text AS uniform_item_id, quantity FROM uniform_shipment_items WHERE shipment_id = $1`,
          [shipment.id],
        );
        await client.query(`SELECT id FROM uniform_tags WHERE id = ANY($1::text[]) FOR UPDATE`, [items.rows.map((row) => row.tag_id)]);

        for (const item of items.rows) {
          if (shipment.stock_deducted) {
            // A origem ja foi baixada no envio: so entra no estoque da filial.
            await bumpUnitStock(client, shipment.to_unit_id, item.uniform_item_id, item.quantity);
            continue;
          }
          // Remessa antiga: baixa a origem agora e entra na filial.
          const updated = await client.query(
            `UPDATE uniform_tags SET quantity = quantity - $2, updated_at = NOW() WHERE id = $1 AND quantity >= $2`,
            [item.tag_id, item.quantity],
          );
          if (!updated.rowCount) {
            throw new HttpError(409, `A etiqueta ${item.tag_id} nao tem mais ${item.quantity} peca(s) na origem. Fale com o RH.`);
          }
          await client.query(
            `
              INSERT INTO uniform_stock_movements (tag_id, uniform_item_id, type, quantity, unit_id, from_unit_id, user_id, shipment_id)
              VALUES ($1, $2, 'saida', $3, $4, $5, $6, $7)
            `,
            [item.tag_id, item.uniform_item_id, item.quantity, shipment.to_unit_id, shipment.from_unit_id, user.id, shipment.id],
          );
          await bumpUnitStock(client, shipment.from_unit_id, item.uniform_item_id, -item.quantity);
          await bumpUnitStock(client, shipment.to_unit_id, item.uniform_item_id, item.quantity);
        }

        await client.query(
          `UPDATE uniform_shipments SET status = 'recebido', received_by_id = $2, received_by_name = $3, received_at = NOW(), received_via = $4
           WHERE id = $1`,
          [shipment.id, user.id, user.name, via],
        );
        await client.query('COMMIT');
        response.json(await getShipment('s.id', shipment.id));
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }),
  );

  // RH/Gestao cancela uma remessa ainda em transito: as pecas voltam para o estoque de origem.
  router.post(
    '/:id/cancel',
    asyncHandler(async (request: Request, response: Response) => {
      const user = sessionUser(response);
      if (!canSend(user)) throw new HttpError(403, 'Somente o RH (Matriz) ou a Gestao pode cancelar uma remessa.');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const found = await client.query<{ id: string; code: string; status: ShipmentStatus; from_unit_id: string; stock_deducted: boolean }>(
          `SELECT id, code, status, from_unit_id::text AS from_unit_id, stock_deducted
           FROM uniform_shipments WHERE id::text = $1 FOR UPDATE`,
          [String(request.params.id)],
        );
        const shipment = found.rows[0];
        if (!shipment) throw new HttpError(404, 'Remessa nao encontrada.');
        const scoped = await scopedUnitIds(user);
        if (scoped && !scoped.includes(shipment.from_unit_id)) {
          throw new HttpError(403, 'Esta remessa saiu de um estoque que nao esta vinculado ao seu usuario.');
        }
        if (shipment.status !== 'em_transito') throw new HttpError(409, 'So e possivel cancelar remessas que ainda estao em transito.');

        if (shipment.stock_deducted) {
          const items = await client.query<{ tag_id: string; uniform_item_id: string; quantity: number }>(
            `SELECT tag_id, uniform_item_id::text AS uniform_item_id, quantity FROM uniform_shipment_items WHERE shipment_id = $1`,
            [shipment.id],
          );
          for (const item of items.rows) {
            // Devolve a etiqueta (se ela ainda for do mesmo uniforme) e o estoque de origem.
            await client.query(
              `UPDATE uniform_tags SET quantity = quantity + $2, updated_at = NOW() WHERE id = $1 AND uniform_item_id::text = $3`,
              [item.tag_id, item.quantity, item.uniform_item_id],
            );
            await client.query(
              `
                INSERT INTO uniform_stock_movements (tag_id, uniform_item_id, type, quantity, unit_id, location_label, user_id, shipment_id)
                VALUES ($1, $2, 'entrada', $3, $4, $5, $6, $7)
              `,
              [item.tag_id, item.uniform_item_id, item.quantity, shipment.from_unit_id, `Remessa ${shipment.code} cancelada`, user.id, shipment.id],
            );
            await bumpUnitStock(client, shipment.from_unit_id, item.uniform_item_id, item.quantity);
          }
        }

        await client.query(
          `UPDATE uniform_shipments SET status = 'cancelado', cancelled_by_name = $2, cancelled_at = NOW() WHERE id = $1`,
          [shipment.id, user.name],
        );
        await client.query('COMMIT');
        response.json(await getShipment('s.id', shipment.id));
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }),
  );

  return router;
}
