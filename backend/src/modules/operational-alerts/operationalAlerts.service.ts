import {
  AlertFilters,
  AuditResultFilters,
  CompleteAlertInput,
  CreateRuleInput,
  OperationalAlertBatch,
  OperationalAlertBatchType,
  OperationalCountRule,
  RuleFilters,
  UpdateRuleInput,
} from './operationalAlerts.types.js';
import { OperationalAlertsRepository } from './operationalAlerts.repository.js';
import { env } from '../../config/env.js';

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function toIsoDate(value: Date) {
  return value.toISOString();
}

function getMonthlyOccurrenceDate(baseDate: Date, referenceDate: Date) {
  const occurrence = new Date(referenceDate);
  occurrence.setUTCDate(baseDate.getUTCDate());
  occurrence.setUTCHours(0, 0, 0, 0);
  return occurrence;
}

function resolveScheduledAt(baseDate: Date, now: Date) {
  const scheduledAt = new Date(baseDate);

  if (env.OPERATIONAL_ALERT_HOUR !== undefined) {
    scheduledAt.setHours(
      env.OPERATIONAL_ALERT_HOUR,
      env.OPERATIONAL_ALERT_MINUTE ?? 0,
      0,
      0,
    );
  } else {
    scheduledAt.setHours(
      now.getHours(),
      now.getMinutes(),
      now.getSeconds(),
      now.getMilliseconds(),
    );
  }

  if (scheduledAt.getTime() < now.getTime()) {
    return new Date(now);
  }

  return scheduledAt;
}

function shouldGenerateForRule(rule: OperationalCountRule, referenceDate: Date) {
  const startDate = new Date(rule.startDate);
  startDate.setUTCHours(0, 0, 0, 0);

  const diffInDays = Math.floor((referenceDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
  if (diffInDays < 0) {
    return false;
  }

  switch (rule.frequency) {
    case 'unica':
      return diffInDays === 0;
    case 'diario':
      return true;
    case 'quinzenal':
      return diffInDays % 15 === 0;
    case 'mensal':
      return referenceDate.getUTCDate() === startDate.getUTCDate();
    default:
      return false;
  }
}

function normalizeClassificationKey(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

interface BatchRuleGroup {
  type: OperationalAlertBatchType;
  classificationKey: string;
  classificationLabel: string;
  unitId: string;
  unitName: string;
  responsibleUserId: string | null;
  responsibleUserName: string | null;
  frequency: OperationalCountRule['frequency'];
  executionDeadlineMinutes: number;
  rules: OperationalCountRule[];
  isCustomGroup: boolean;
}

function buildCustomGroupLabel(productNames: string[]) {
  const unique = Array.from(new Set(productNames));
  if (unique.length <= 3) {
    return unique.join(', ');
  }
  return `${unique.slice(0, 3).join(', ')} e mais ${unique.length - 3} produto(s)`;
}

export class OperationalAlertsService {
  constructor(private readonly repository: OperationalAlertsRepository) {}

  async createRule(input: CreateRuleInput) {
    return this.repository.createRule(await this.resolveResponsibleUser(input));
  }

  async createRulesBatch(inputs: CreateRuleInput[]) {
    // Resolve o nome de cada responsavel uma vez so (o lote repete os mesmos usuarios).
    const names = new Map<string, string | null>();
    const resolved: CreateRuleInput[] = [];
    for (const input of inputs) {
      if (!input.responsibleUserId || input.responsibleUserName?.trim()) {
        resolved.push(input);
        continue;
      }
      if (!names.has(input.responsibleUserId)) {
        const user = await this.repository.findUserById(input.responsibleUserId);
        names.set(input.responsibleUserId, user?.name ?? null);
      }
      resolved.push({ ...input, responsibleUserName: names.get(input.responsibleUserId) ?? input.responsibleUserName });
    }
    return this.repository.createRulesBatch(resolved);
  }

  async getRuleById(ruleId: string) {
    const rule = await this.repository.findRuleById(ruleId);

    if (!rule) {
      throw new Error('Regra nao encontrada.');
    }

    return rule;
  }

  async updateRulesBatch(ruleIds: string[], input: UpdateRuleInput) {
    return this.repository.updateRulesBatch(ruleIds, await this.resolveResponsibleUser(input));
  }

  async updateRule(ruleId: string, input: UpdateRuleInput) {
    return this.repository.updateRule(ruleId, await this.resolveResponsibleUser(input));
  }

  async toggleRule(ruleId: string) {
    const rule = await this.getRuleById(ruleId);
    const nextIsActive = !rule.isActive;
    const updatedRule = await this.repository.updateRule(ruleId, {
      isActive: nextIsActive,
    });

    if (!nextIsActive) {
      await this.repository.deactivateOpenBatchesForRule(ruleId);
    }

    return updatedRule;
  }

  listRules(filters: RuleFilters) {
    return this.repository.listRules(filters);
  }

  async deleteRule(ruleId: string) {
    const rule = await this.repository.deleteRule(ruleId);

    if (!rule) {
      throw new Error('Regra nao encontrada.');
    }

    return rule;
  }

  listAlerts(filters: AlertFilters) {
    return this.repository.listAlerts(filters);
  }

  listPendingAlerts(filters: Omit<AlertFilters, 'status'>) {
    return this.repository.listPendingAlerts(filters);
  }

  listMobileAlerts(input: { userId?: string; unitId?: string }) {
    return this.repository.listMobileAlerts(input);
  }

  getDashboardSummary() {
    return this.repository.getDashboardSummary();
  }

  listAuditResults(filters: AuditResultFilters) {
    return this.repository.listAuditResults(filters);
  }

  async getAuditResultById(auditId: string) {
    const audit = await this.repository.findAuditResultById(auditId);

    if (!audit) {
      throw new Error('Resultado da auditoria nao encontrado.');
    }

    return audit;
  }

  async deleteAuditResult(auditId: string) {
    const existingAudit = await this.repository.findAuditResultById(auditId);

    if (!existingAudit) {
      throw new Error('Resultado da auditoria nao encontrado.');
    }

    await this.repository.deleteAuditResult(auditId);
    return existingAudit;
  }

  async startAlert(alertId: string) {
    return this.transitionAlert(alertId, 'em_andamento');
  }

  async completeAlert(alertId: string, input: CompleteAlertInput) {
    return this.transitionAlert(alertId, 'concluido', {
      linkedAuditSessionId: input.auditSessionId,
    });
  }

  async expireAlert(alertId: string) {
    return this.transitionAlert(alertId, 'vencido');
  }

  // "Excluir aviso" do portal: tira do app na hora (o app so lista 'pendente').
  async cancelAlert(alertId: string) {
    return this.transitionAlert(alertId, 'cancelado');
  }

  async expireOverdueAlerts(referenceDate = new Date()) {
    return this.repository.expireOverdueBatches(referenceDate.toISOString());
  }

  async generateScheduledAlerts(referenceDate = new Date()) {
    const now = new Date();
    const normalizedDate = new Date(referenceDate);
    normalizedDate.setUTCHours(0, 0, 0, 0);

    const rules = await this.repository.findActiveRules(normalizedDate.toISOString().slice(0, 10));
    const eligibleRules = rules.filter((rule) => shouldGenerateForRule(rule, normalizedDate));
    const groupedRules = this.groupRulesByBatch(eligibleRules);
    const createdBatches: OperationalAlertBatch[] = [];

    for (const group of groupedRules) {
      let scheduledAt = new Date(normalizedDate);
      if (group.frequency === 'mensal') {
        scheduledAt = getMonthlyOccurrenceDate(new Date(group.rules[0].startDate), normalizedDate);
      }
      scheduledAt = resolveScheduledAt(scheduledAt, now);

      const scheduledAtIso = toIsoDate(scheduledAt);
      const alreadyExists = await this.repository.batchExistsForGroupAt({
        type: group.type,
        classificationKey: group.classificationKey,
        unitId: group.unitId,
        responsibleUserId: group.responsibleUserId,
        scheduledAt: scheduledAtIso,
      });
      const hasOpenBatch = await this.repository.hasOpenBatchForGroup({
        type: group.type,
        classificationKey: group.classificationKey,
        unitId: group.unitId,
        responsibleUserId: group.responsibleUserId,
      });

      if (alreadyExists || hasOpenBatch) {
        continue;
      }

      const dueAt = addMinutes(scheduledAt, group.executionDeadlineMinutes);
      const batch = await this.repository.createBatch({
        type: group.type,
        classificationKey: group.classificationKey,
        classificationLabel: group.classificationLabel,
        unitId: group.unitId,
        unitName: group.unitName,
        responsibleUserId: group.responsibleUserId,
        responsibleUserName: group.responsibleUserName,
        scheduledAt: scheduledAtIso,
        dueAt: dueAt.toISOString(),
        status: 'pendente',
        linkedAuditSessionId: null,
        items: group.rules.map((rule) => ({
          ruleId: rule.id,
          productId: rule.productId,
          barcode: rule.barcode,
          productName: rule.productName,
        })),
      });

      createdBatches.push(batch);

      if (group.frequency === 'unica') {
        await Promise.all(group.rules.map((rule) => this.repository.updateRule(rule.id, { isActive: false })));
      }
    }

    return createdBatches;
  }

  private groupRulesByBatch(rules: OperationalCountRule[]) {
    const groups = new Map<string, BatchRuleGroup>();

    rules.forEach((rule) => {
      const isCustomGroup = !!rule.groupId;
      const hasClassification = !isCustomGroup && !!rule.classificationLabel?.trim();
      const type: OperationalAlertBatchType = hasClassification ? 'classification' : 'product';
      const classificationLabel = isCustomGroup
        ? rule.productName
        : hasClassification
          ? rule.classificationLabel!.trim()
          : rule.productName;
      const classificationKey = isCustomGroup
        ? `grupo:${rule.groupId}`
        : hasClassification
          ? normalizeClassificationKey(classificationLabel)
          : rule.productId;
      const groupKey = [
        type,
        classificationKey,
        rule.unitId,
        rule.responsibleUserId ?? '',
        rule.frequency,
        rule.executionDeadlineMinutes,
      ].join('::');

      const current = groups.get(groupKey);

      if (current) {
        current.rules.push(rule);
        return;
      }

      groups.set(groupKey, {
        type,
        classificationKey,
        classificationLabel,
        unitId: rule.unitId,
        unitName: rule.unitName,
        responsibleUserId: rule.responsibleUserId,
        responsibleUserName: rule.responsibleUserName,
        frequency: rule.frequency,
        executionDeadlineMinutes: rule.executionDeadlineMinutes,
        rules: [rule],
        isCustomGroup,
      });
    });

    return Array.from(groups.values()).map((group) => {
      if (group.isCustomGroup && group.rules.length > 1) {
        return {
          ...group,
          classificationLabel: buildCustomGroupLabel(group.rules.map((rule) => rule.productName)),
        };
      }
      return group;
    });
  }

  private async transitionAlert(
    alertId: string,
    targetStatus: 'em_andamento' | 'concluido' | 'vencido' | 'cancelado',
    fields: { linkedAuditSessionId?: string | null } = {},
  ) {
    const alert = await this.repository.findBatchById(alertId);

    if (!alert) {
      throw new Error('Lote de alerta nao encontrado.');
    }

    if (alert.status === 'concluido') {
      throw new Error('Este lote ja foi concluido.');
    }

    if (alert.status === 'cancelado' && targetStatus === 'em_andamento') {
      throw new Error('Este aviso foi excluido pela gestao e nao esta mais disponivel.');
    }

    return this.repository.updateBatchStatus(alertId, targetStatus, fields);
  }

  private async resolveResponsibleUser<T extends CreateRuleInput | UpdateRuleInput>(input: T): Promise<T> {
    if (!input.responsibleUserId) {
      return input;
    }

    if (input.responsibleUserName && input.responsibleUserName.trim()) {
      return input;
    }

    const user = await this.repository.findUserById(input.responsibleUserId);

    if (!user) {
      return input;
    }

    return {
      ...input,
      responsibleUserName: user.name,
    };
  }
}
