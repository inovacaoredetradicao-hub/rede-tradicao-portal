import { PoolClient } from 'pg';
import { pool, query } from '../../lib/db.js';
import {
  AlertFilters,
  AlertStatus,
  AuditResultFilters,
  BatchGroupLookup,
  CreateBatchInput,
  CreateRuleInput,
  DashboardSummary,
  OperationalAlertBatch,
  OperationalAlertBatchItem,
  OperationalAuditResult,
  OperationalCountRule,
  ResponsibleUserLookup,
  RuleFilters,
  UpdateRuleInput,
} from './operationalAlerts.types.js';

const ruleSelect = `
  operational_count_rules.id,
  operational_count_rules.product_id AS "productId",
  operational_count_rules.barcode,
  operational_count_rules.product_name AS "productName",
  operational_count_rules.unit_id AS "unitId",
  operational_count_rules.unit_name AS "unitName",
  operational_count_rules.frequency,
  operational_count_rules.execution_deadline_minutes AS "executionDeadlineMinutes",
  operational_count_rules.is_active AS "isActive",
  operational_count_rules.start_date::text AS "startDate",
  operational_count_rules.end_date::text AS "endDate",
  operational_count_rules.responsible_user_id AS "responsibleUserId",
  operational_count_rules.responsible_user_name AS "responsibleUserName",
  COALESCE(NULLIF(products.classification, ''), NULLIF(products.stock_type, '')) AS "classificationLabel",
  operational_count_rules.group_id AS "groupId",
  operational_count_rules.created_at AS "createdAt",
  operational_count_rules.updated_at AS "updatedAt"
`;

const batchSelect = `
  operational_alert_batches.id,
  operational_alert_batches.type,
  operational_alert_batches.classification_key AS "classificationKey",
  operational_alert_batches.classification_label AS "classificationLabel",
  operational_alert_batches.unit_id AS "unitId",
  operational_alert_batches.unit_name AS "unitName",
  operational_alert_batches.responsible_user_id AS "responsibleUserId",
  operational_alert_batches.responsible_user_name AS "responsibleUserName",
  operational_alert_batches.scheduled_at AS "scheduledAt",
  operational_alert_batches.due_at AS "dueAt",
  operational_alert_batches.status,
  operational_alert_batches.linked_audit_session_id AS "linkedAuditSessionId",
  operational_alert_batches.created_at AS "createdAt",
  operational_alert_batches.updated_at AS "updatedAt"
`;

const batchItemSelect = `
  id,
  batch_id AS "batchId",
  rule_id AS "ruleId",
  product_id AS "productId",
  barcode,
  product_name AS "productName"
`;

const auditResultSelect = `
  portal_audits.id,
  portal_audits.source_session_id AS "sourceSessionId",
  COALESCE(
    portal_audits.payload->'session'->>'operationalAlertId',
    portal_audits.payload->'session'->>'operational_alert_id',
    portal_audits.payload->>'operationalAlertId',
    portal_audits.payload->>'operational_alert_id'
  ) AS "operationalAlertId",
  COALESCE(
    -- Contagem de um unico produto: mostra o nome do produto contado de verdade,
    -- nao a classificacao do lote (evita mostrar "Conveniancia" no lugar de "Agua Mineral 500ml").
    CASE
      WHEN jsonb_array_length(COALESCE(portal_audits.payload->'items', '[]'::jsonb)) = 1
        THEN portal_audits.payload->'items'->0->>'name'
    END,
    -- Contagem de varios produtos de uma classificacao: mostra a classificacao como resumo.
    operational_alert_batches.classification_label,
    -- Fallbacks: nome do primeiro item contado, ou campos antigos de payload.
    portal_audits.payload->'items'->0->>'name',
    portal_audits.payload->'session'->'items'->0->>'name',
    portal_audits.payload->'session'->>'productName',
    portal_audits.payload->'session'->>'product_name',
    portal_audits.payload->>'productName',
    portal_audits.payload->>'product_name'
  ) AS "productName",
  portal_audits.unit_id AS "unitId",
  units.name AS "unitName",
  portal_audits.user_id AS "userId",
  portal_audits.seller_name AS "sellerName",
  portal_audits.stock_type AS "stockType",
  portal_audits.count_mode AS "countMode",
  CASE
    WHEN COALESCE(portal_audits.total_divergences, 0) > 0 THEN 'Divergente'
    ELSE 'OK'
  END AS "resultStatus",
  portal_audits.accuracy::float8 AS "accuracy",
  COALESCE(portal_audits.total_items, 0) AS "totalItems",
  COALESCE(portal_audits.total_divergences, 0) AS "totalDivergences",
  portal_audits.finished_at::text AS "finishedAt",
  portal_audits.payload AS payload
`;

function buildRuleWhereClause(filters: RuleFilters) {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let index = 1;

  if (filters.unitId) {
    conditions.push(`operational_count_rules.unit_id = $${index}`);
    values.push(filters.unitId);
    index += 1;
  }

  if (filters.productId) {
    conditions.push(`operational_count_rules.product_id = $${index}`);
    values.push(filters.productId);
    index += 1;
  }

  if (filters.responsibleUserId) {
    conditions.push(`operational_count_rules.responsible_user_id = $${index}`);
    values.push(filters.responsibleUserId);
    index += 1;
  }

  if (filters.isActive !== undefined) {
    conditions.push(`operational_count_rules.is_active = $${index}`);
    values.push(filters.isActive);
    index += 1;
  }

  return {
    clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    values,
  };
}

function mapBatch(batch: Omit<OperationalAlertBatch, 'items' | 'title' | 'description'>, items: OperationalAlertBatchItem[]): OperationalAlertBatch {
  const itemCount = items.length;
  const title =
    batch.type === 'classification' || itemCount > 1
      ? batch.classificationLabel || `${itemCount} produtos selecionados`
      : items[0]?.productName || batch.classificationLabel || 'Produto';
  const description =
    itemCount === 1 ? '1 produto para contar' : `${itemCount} produto(s) para contar`;

  return {
    ...batch,
    title,
    description,
    items,
  };
}

export class OperationalAlertsRepository {
  private async attachBatchItems<T extends Omit<OperationalAlertBatch, 'items' | 'title' | 'description'>>(batches: T[]) {
    if (batches.length === 0) {
      return [] as OperationalAlertBatch[];
    }

    const batchIds = batches.map((batch) => batch.id);
    const itemsResult = await query<OperationalAlertBatchItem>(
      `
        SELECT ${batchItemSelect}
        FROM operational_alert_batch_items
        WHERE batch_id = ANY($1::uuid[])
        ORDER BY product_name ASC
      `,
      [batchIds],
    );

    const itemsByBatchId = new Map<string, OperationalAlertBatchItem[]>();
    itemsResult.rows.forEach((item) => {
      const current = itemsByBatchId.get(item.batchId) ?? [];
      current.push(item);
      itemsByBatchId.set(item.batchId, current);
    });

    return batches.map((batch) => mapBatch(batch, itemsByBatchId.get(batch.id) ?? []));
  }

  async listAuditResults(filters: AuditResultFilters = {}) {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    if (filters.unitId) {
      conditions.push(`portal_audits.unit_id = $${index}`);
      values.push(filters.unitId);
      index += 1;
    }

    if (filters.sellerName) {
      conditions.push(`portal_audits.seller_name ILIKE $${index}`);
      values.push(`%${filters.sellerName}%`);
      index += 1;
    }

    if (filters.productSearch) {
      conditions.push(`COALESCE(
        portal_audits.payload->'items'->0->>'name',
        operational_alert_batches.classification_label,
        portal_audits.payload->'session'->>'productName',
        portal_audits.payload->>'productName',
        ''
      ) ILIKE $${index}`);
      values.push(`%${filters.productSearch}%`);
      index += 1;
    }

    if (filters.resultStatus) {
      conditions.push(`(CASE WHEN COALESCE(portal_audits.total_divergences, 0) > 0 THEN 'Divergente' ELSE 'OK' END) = $${index}`);
      values.push(filters.resultStatus);
      index += 1;
    }

    if (filters.dateFrom) {
      conditions.push(`portal_audits.finished_at >= $${index}::timestamp`);
      values.push(filters.dateFrom);
      index += 1;
    }

    if (filters.dateTo) {
      conditions.push(`portal_audits.finished_at <= $${index}::timestamp`);
      values.push(filters.dateTo);
      index += 1;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query<OperationalAuditResult>(
      `
        SELECT ${auditResultSelect}
        FROM portal_audits
        LEFT JOIN operational_alert_batches
          ON operational_alert_batches.id::text = COALESCE(
            portal_audits.payload->'session'->>'operationalAlertId',
            portal_audits.payload->'session'->>'operational_alert_id',
            portal_audits.payload->>'operationalAlertId',
            portal_audits.payload->>'operational_alert_id'
          )
        LEFT JOIN units
          ON units.id::text = portal_audits.unit_id
        ${whereClause}
        ORDER BY portal_audits.finished_at DESC NULLS LAST, portal_audits.received_at DESC NULLS LAST
      `,
      values,
    );

    return result.rows;
  }

  async findAuditResultById(auditId: string) {
    const result = await query<OperationalAuditResult>(
      `
        SELECT ${auditResultSelect}
        FROM portal_audits
        LEFT JOIN operational_alert_batches
          ON operational_alert_batches.id::text = COALESCE(
            portal_audits.payload->'session'->>'operationalAlertId',
            portal_audits.payload->'session'->>'operational_alert_id',
            portal_audits.payload->>'operationalAlertId',
            portal_audits.payload->>'operational_alert_id'
          )
        LEFT JOIN units
          ON units.id::text = portal_audits.unit_id
        WHERE portal_audits.id = $1
      `,
      [auditId],
    );

    return result.rows[0] ?? null;
  }

  async deleteAuditResult(auditId: string) {
    const result = await query<{ id: string }>(
      `
        DELETE FROM portal_audits
        WHERE id = $1
        RETURNING id
      `,
      [auditId],
    );

    return result.rows[0] ?? null;
  }

  async findUserById(userId: string) {
    const result = await query<ResponsibleUserLookup>(
      `
        SELECT id, name
        FROM users
        WHERE id = $1
      `,
      [userId],
    );

    return result.rows[0] ?? null;
  }

  async findRuleById(ruleId: string) {
    const result = await query<OperationalCountRule>(
      `
        SELECT ${ruleSelect}
        FROM operational_count_rules
        LEFT JOIN products
          ON products.id = operational_count_rules.product_id
        WHERE operational_count_rules.id = $1
      `,
      [ruleId],
    );

    return result.rows[0] ?? null;
  }

  async createRule(input: CreateRuleInput) {
    const result = await query<OperationalCountRule>(
      `
        INSERT INTO operational_count_rules (
          product_id,
          barcode,
          product_name,
          unit_id,
          unit_name,
          frequency,
          execution_deadline_minutes,
          is_active,
          start_date,
          end_date,
          responsible_user_id,
          responsible_user_name,
          group_id
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        RETURNING
          id,
          product_id AS "productId",
          barcode,
          product_name AS "productName",
          unit_id AS "unitId",
          unit_name AS "unitName",
          frequency,
          execution_deadline_minutes AS "executionDeadlineMinutes",
          is_active AS "isActive",
          start_date::text AS "startDate",
          end_date::text AS "endDate",
          responsible_user_id AS "responsibleUserId",
          responsible_user_name AS "responsibleUserName",
          NULL::text AS "classificationLabel",
          group_id AS "groupId",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [
        input.productId,
        input.barcode,
        input.productName,
        input.unitId,
        input.unitName,
        input.frequency,
        input.executionDeadlineMinutes,
        input.isActive,
        input.startDate,
        input.endDate ?? null,
        input.responsibleUserId ?? null,
        input.responsibleUserName ?? null,
        input.groupId ?? null,
      ],
    );

    return result.rows[0];
  }

  // Grava muitas regras de uma vez (uma transacao, INSERT com unnest em blocos de 1000).
  // Antes o portal mandava uma requisicao por regra, todas em paralelo, e um disparo por
  // classificacao (milhares de produtos) estourava o navegador.
  async createRulesBatch(inputs: CreateRuleInput[]) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let created = 0;
      for (let start = 0; start < inputs.length; start += 1000) {
        const chunk = inputs.slice(start, start + 1000);
        const column = <K extends keyof CreateRuleInput>(key: K) => chunk.map((input) => input[key] ?? null);
        const result = await client.query(
          `
            INSERT INTO operational_count_rules (
              product_id, barcode, product_name, unit_id, unit_name, frequency,
              execution_deadline_minutes, is_active, start_date, end_date,
              responsible_user_id, responsible_user_name, group_id
            )
            SELECT * FROM unnest(
              $1::uuid[], $2::text[], $3::text[], $4::uuid[], $5::text[], $6::text[],
              $7::int[], $8::bool[], $9::date[], $10::date[],
              $11::uuid[], $12::text[], $13::uuid[]
            )
          `,
          [
            column('productId'), column('barcode'), column('productName'), column('unitId'),
            column('unitName'), column('frequency'), column('executionDeadlineMinutes'),
            column('isActive'), column('startDate'), column('endDate'),
            column('responsibleUserId'), column('responsibleUserName'), column('groupId'),
          ],
        );
        created += result.rowCount ?? 0;
      }
      await client.query('COMMIT');
      return created;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async updateRule(ruleId: string, input: UpdateRuleInput) {
    const assignments: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    const mapping: Record<string, unknown> = {
      product_id: input.productId,
      barcode: input.barcode,
      product_name: input.productName,
      unit_id: input.unitId,
      unit_name: input.unitName,
      frequency: input.frequency,
      execution_deadline_minutes: input.executionDeadlineMinutes,
      is_active: input.isActive,
      start_date: input.startDate,
      end_date: input.endDate,
      responsible_user_id: input.responsibleUserId,
      responsible_user_name: input.responsibleUserName,
      group_id: input.groupId,
    };

    Object.entries(mapping).forEach(([column, value]) => {
      if (value === undefined) {
        return;
      }

      assignments.push(`${column} = $${index}`);
      values.push(value);
      index += 1;
    });

    assignments.push(`updated_at = NOW()`);
    values.push(ruleId);

    const result = await query<OperationalCountRule>(
      `
        UPDATE operational_count_rules
        SET ${assignments.join(', ')}
        WHERE id = $${index}
        RETURNING
          id,
          product_id AS "productId",
          barcode,
          product_name AS "productName",
          unit_id AS "unitId",
          unit_name AS "unitName",
          frequency,
          execution_deadline_minutes AS "executionDeadlineMinutes",
          is_active AS "isActive",
          start_date::text AS "startDate",
          end_date::text AS "endDate",
          responsible_user_id AS "responsibleUserId",
          responsible_user_name AS "responsibleUserName",
          NULL::text AS "classificationLabel",
          group_id AS "groupId",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      values,
    );

    return result.rows[0] ?? null;
  }

  async deleteRule(ruleId: string) {
    const result = await query<OperationalCountRule>(
      `
        DELETE FROM operational_count_rules
        WHERE id = $1
        RETURNING
          id,
          product_id AS "productId",
          barcode,
          product_name AS "productName",
          unit_id AS "unitId",
          unit_name AS "unitName",
          frequency,
          execution_deadline_minutes AS "executionDeadlineMinutes",
          is_active AS "isActive",
          start_date::text AS "startDate",
          end_date::text AS "endDate",
          responsible_user_id AS "responsibleUserId",
          responsible_user_name AS "responsibleUserName",
          NULL::text AS "classificationLabel",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [ruleId],
    );

    return result.rows[0] ?? null;
  }

  async listRules(filters: RuleFilters = {}) {
    const { clause, values } = buildRuleWhereClause(filters);

    const result = await query<OperationalCountRule>(
      `
        SELECT ${ruleSelect}
        FROM operational_count_rules
        LEFT JOIN products
          ON products.id = operational_count_rules.product_id
        ${clause}
        ORDER BY operational_count_rules.product_name ASC, operational_count_rules.unit_name ASC
      `,
      values,
    );

    return result.rows;
  }

  async findActiveRules(referenceDate: string) {
    const result = await query<OperationalCountRule>(
      `
        SELECT ${ruleSelect}
        FROM operational_count_rules
        LEFT JOIN products
          ON products.id = operational_count_rules.product_id
        WHERE operational_count_rules.is_active = true
          AND operational_count_rules.start_date <= $1::date
          AND (operational_count_rules.end_date IS NULL OR operational_count_rules.end_date >= $1::date)
      `,
      [referenceDate],
    );

    return result.rows;
  }

  async batchExistsForGroupAt(input: BatchGroupLookup) {
    const result = await query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM operational_alert_batches
        WHERE type = $1
          AND classification_key = $2
          AND unit_id = $3
          AND responsible_user_id IS NOT DISTINCT FROM $4
          AND scheduled_at = $5::timestamptz
      `,
      [input.type, input.classificationKey, input.unitId, input.responsibleUserId, input.scheduledAt],
    );

    return Number(result.rows[0]?.count ?? 0) > 0;
  }

  async hasOpenBatchForGroup(input: Omit<BatchGroupLookup, 'scheduledAt'>) {
    const result = await query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM operational_alert_batches
        WHERE type = $1
          AND classification_key = $2
          AND unit_id = $3
          AND responsible_user_id IS NOT DISTINCT FROM $4
          AND status IN ('pendente', 'em_andamento')
      `,
      [input.type, input.classificationKey, input.unitId, input.responsibleUserId],
    );

    return Number(result.rows[0]?.count ?? 0) > 0;
  }

  async createBatch(input: CreateBatchInput) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const batchResult = await client.query<Omit<OperationalAlertBatch, 'items' | 'title' | 'description'>>(
        `
          INSERT INTO operational_alert_batches (
            type,
            classification_key,
            classification_label,
            unit_id,
            unit_name,
            responsible_user_id,
            responsible_user_name,
            scheduled_at,
            due_at,
            status,
            linked_audit_session_id
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
          RETURNING ${batchSelect}
        `,
        [
          input.type,
          input.classificationKey,
          input.classificationLabel,
          input.unitId,
          input.unitName,
          input.responsibleUserId,
          input.responsibleUserName,
          input.scheduledAt,
          input.dueAt,
          input.status,
          input.linkedAuditSessionId,
        ],
      );

      const batch = batchResult.rows[0];
      const items: OperationalAlertBatchItem[] = [];

      for (const item of input.items) {
        const itemResult = await client.query<OperationalAlertBatchItem>(
          `
            INSERT INTO operational_alert_batch_items (
              batch_id,
              rule_id,
              product_id,
              barcode,
              product_name
            )
            VALUES ($1,$2,$3,$4,$5)
            RETURNING ${batchItemSelect}
          `,
          [batch.id, item.ruleId, item.productId, item.barcode, item.productName],
        );

        items.push(itemResult.rows[0]);
      }

      await client.query('COMMIT');
      return mapBatch(batch, items);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async listAlerts(filters: AlertFilters = {}) {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    if (filters.status) {
      conditions.push(`operational_alert_batches.status = $${index}`);
      values.push(filters.status);
      index += 1;
    }

    if (filters.unitId) {
      conditions.push(`operational_alert_batches.unit_id = $${index}`);
      values.push(filters.unitId);
      index += 1;
    }

    if (filters.responsibleUserId) {
      conditions.push(`operational_alert_batches.responsible_user_id = $${index}`);
      values.push(filters.responsibleUserId);
      index += 1;
    }

    if (filters.productId) {
      conditions.push(`EXISTS (
        SELECT 1
        FROM operational_alert_batch_items
        WHERE operational_alert_batch_items.batch_id = operational_alert_batches.id
          AND operational_alert_batch_items.product_id = $${index}
      )`);
      values.push(filters.productId);
      index += 1;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await query<Omit<OperationalAlertBatch, 'items' | 'title' | 'description'>>(
      `
        SELECT ${batchSelect}
        FROM operational_alert_batches
        ${whereClause}
        ORDER BY operational_alert_batches.scheduled_at DESC
      `,
      values,
    );

    return this.attachBatchItems(result.rows);
  }

  async listPendingAlerts(filters: Omit<AlertFilters, 'status'> = {}) {
    return this.listAlerts({
      ...filters,
      status: 'pendente',
    });
  }

  async listMobileAlerts({ userId, unitId }: { userId?: string; unitId?: string }) {
    const filters: string[] = [`operational_alert_batches.status = 'pendente'`];
    const values: unknown[] = [];
    let index = 1;

    if (userId) {
      filters.push(`(operational_alert_batches.responsible_user_id = $${index} OR operational_alert_batches.responsible_user_id IS NULL)`);
      values.push(userId);
      index += 1;
    }

    if (unitId) {
      filters.push(`(
        operational_alert_batches.unit_id::text = $${index}
        OR LOWER(operational_alert_batches.unit_name) = LOWER($${index})
        OR LOWER(COALESCE(units.code, '')) = LOWER($${index})
        OR LOWER(COALESCE(units.name, '')) = LOWER($${index})
      )`);
      values.push(unitId);
      index += 1;
    }

    const result = await query<Omit<OperationalAlertBatch, 'items' | 'title' | 'description'>>(
      `
        SELECT ${batchSelect}
        FROM operational_alert_batches
        LEFT JOIN units
          ON units.id::text = operational_alert_batches.unit_id::text
        WHERE ${filters.join(' AND ')}
        ORDER BY operational_alert_batches.due_at ASC
      `,
      values,
    );

    return this.attachBatchItems(result.rows);
  }

  async deactivateOpenBatchesForRule(ruleId: string) {
    const result = await query<Omit<OperationalAlertBatch, 'items' | 'title' | 'description'>>(
      `
        UPDATE operational_alert_batches
        SET status = 'vencido',
            updated_at = NOW()
        WHERE status IN ('pendente', 'em_andamento')
          AND EXISTS (
            SELECT 1
            FROM operational_alert_batch_items
            WHERE operational_alert_batch_items.batch_id = operational_alert_batches.id
              AND operational_alert_batch_items.rule_id = $1
          )
        RETURNING ${batchSelect}
      `,
      [ruleId],
    );

    return this.attachBatchItems(result.rows);
  }

  async findBatchById(batchId: string) {
    const result = await query<Omit<OperationalAlertBatch, 'items' | 'title' | 'description'>>(
      `
        SELECT ${batchSelect}
        FROM operational_alert_batches
        WHERE operational_alert_batches.id = $1
      `,
      [batchId],
    );

    const batches = await this.attachBatchItems(result.rows);
    return batches[0] ?? null;
  }

  async updateBatchStatus(batchId: string, status: AlertStatus, fields: { linkedAuditSessionId?: string | null } = {}) {
    const assignments = ['status = $1', 'updated_at = NOW()'];
    const values: unknown[] = [status];
    let index = 2;

    if (fields.linkedAuditSessionId !== undefined) {
      assignments.push(`linked_audit_session_id = $${index}`);
      values.push(fields.linkedAuditSessionId);
      index += 1;
    }

    values.push(batchId);

    const result = await query<Omit<OperationalAlertBatch, 'items' | 'title' | 'description'>>(
      `
        UPDATE operational_alert_batches
        SET ${assignments.join(', ')}
        WHERE id = $${index}
        RETURNING ${batchSelect}
      `,
      values,
    );

    const batches = await this.attachBatchItems(result.rows);
    return batches[0] ?? null;
  }

  async expireOverdueBatches(referenceDate: string) {
    const result = await query<Omit<OperationalAlertBatch, 'items' | 'title' | 'description'>>(
      `
        UPDATE operational_alert_batches
        SET status = 'vencido',
            updated_at = NOW()
        WHERE status IN ('pendente', 'em_andamento')
          AND due_at < $1::timestamptz
        RETURNING ${batchSelect}
      `,
      [referenceDate],
    );

    return this.attachBatchItems(result.rows);
  }

  async getDashboardSummary(): Promise<DashboardSummary> {
    const result = await query<DashboardSummary>(
      `
        SELECT
          COUNT(*) FILTER (WHERE status = 'pendente')::int AS "totalPending",
          COUNT(*) FILTER (WHERE status = 'em_andamento')::int AS "totalInProgress",
          COUNT(*) FILTER (WHERE status = 'concluido')::int AS "totalCompleted",
          COUNT(*) FILTER (WHERE status = 'vencido')::int AS "totalExpired"
        FROM operational_alert_batches
      `,
    );

    return result.rows[0] ?? {
      totalPending: 0,
      totalInProgress: 0,
      totalCompleted: 0,
      totalExpired: 0,
    };
  }
}
