import { useEffect, useMemo, useState } from 'react';
import {
  createOperationalCountRulesBatch,
  deleteOperationalAuditResult,
  getOperationalAuditResults,
  createOperationalCountRule,
  getOperationalCountAlerts,
  getOperationalCountRules,
  getOperationalAlertsDashboardSummary,
  getOperationalClassifications,
  lookupOperationalProducts,
  getOperationalUnits,
  getOperationalUsers,
  runOperationalAlertsScheduler,
  updateOperationalCountRule,
  updateOperationalCountRulesBatch,
  cancelOperationalCountAlert,
  dispatchOperationalRules,
  deleteOperationalCountRulesBatch,
} from '@/features/operational-alerts/api';
import {
  OperationalCountAlert,
  OperationalClassificationOption,
  OperationalAuditResult,
  OperationalAuditResultFilters,
  OperationalCountRule,
  OperationalAlertsDashboardSummary,
  OperationalProductOption,
  OperationalRuleListItem,
  OperationalRuleFilters,
  OperationalRuleSubmitInput,
  OperationalRuleSubmitResult,
  OperationalRulePayload,
  OperationalUnitOption,
  OperationalUserOption,
} from '@/features/operational-alerts/types';

const DEFAULT_FILTERS: OperationalRuleFilters = {
  productSearch: '',
  unitSearch: '',
  showOnlyActive: false,
};

const DEFAULT_AUDIT_RESULT_FILTERS: OperationalAuditResultFilters = {
  productSearch: '',
  unitSearch: '',
  sellerSearch: '',
  status: 'todos',
  dateFrom: '',
  dateTo: '',
};

export function useOperationalCountAdmin() {
  const [rules, setRules] = useState<OperationalCountRule[]>([]);
  const [alerts, setAlerts] = useState<OperationalCountAlert[]>([]);
  const [summary, setSummary] = useState<OperationalAlertsDashboardSummary | null>(null);
  const [auditResults, setAuditResults] = useState<OperationalAuditResult[]>([]);
  // So os produtos que ja tem regra (para agrupar a lista); nao e o catalogo inteiro.
  const [products, setProducts] = useState<OperationalProductOption[]>([]);
  const [classificationOptions, setClassificationOptions] = useState<OperationalClassificationOption[]>([]);
  const [units, setUnits] = useState<OperationalUnitOption[]>([]);
  const [users, setUsers] = useState<OperationalUserOption[]>([]);
  const [filters, setFilters] = useState<OperationalRuleFilters>(DEFAULT_FILTERS);
  const [auditResultFilters, setAuditResultFilters] = useState<OperationalAuditResultFilters>(DEFAULT_AUDIT_RESULT_FILTERS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningScheduler, setRunningScheduler] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  // Regras + produtos delas (para agrupar). Chamado so quando regras mudam.
  const refreshRules = async () => {
    const nextRules = await getOperationalCountRules();
    setRules(nextRules);
    const ruleProductIds = Array.from(new Set(nextRules.map((rule) => rule.productId).filter(Boolean)));
    try {
      setProducts(await lookupOperationalProducts(ruleProductIds));
    } catch {
      setProducts([]);
    }
  };

  // Avisos + resumo: o que muda sozinho (app iniciando/concluindo, vencimentos).
  // Silencioso, sem spinner, usado na atualizacao automatica.
  const refreshLive = async () => {
    const [alertsResult, summaryResult] = await Promise.allSettled([
      getOperationalCountAlerts(),
      getOperationalAlertsDashboardSummary(),
    ]);
    if (alertsResult.status === 'fulfilled') setAlerts(alertsResult.value);
    if (summaryResult.status === 'fulfilled') setSummary(summaryResult.value);
    setLastUpdatedAt(new Date());
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    setCatalogError(null);

    const [rulesResult, alertsResult, summaryResult, productsResult, unitsResult, usersResult, auditResultsResult] = await Promise.allSettled([
        getOperationalCountRules(),
        getOperationalCountAlerts(),
        getOperationalAlertsDashboardSummary(),
        getOperationalClassifications(),
        getOperationalUnits(),
        getOperationalUsers(),
        getOperationalAuditResults(),
      ]);

    if (rulesResult.status === 'fulfilled') {
      setRules(rulesResult.value);
    } else {
      setRules([]);
    }

    if (alertsResult.status === 'fulfilled') {
      setAlerts(alertsResult.value);
    } else {
      setAlerts([]);
    }

    if (summaryResult.status === 'fulfilled') {
      setSummary(summaryResult.value);
    } else {
      setSummary(null);
    }

    if (auditResultsResult.status === 'fulfilled') {
      setAuditResults(auditResultsResult.value);
    } else {
      setAuditResults([]);
    }

    if (productsResult.status === 'fulfilled') {
      setClassificationOptions(productsResult.value);
    } else {
      setClassificationOptions([]);
    }

    // Carrega so os produtos referenciados pelas regras existentes.
    if (rulesResult.status === 'fulfilled') {
      const ruleProductIds = Array.from(new Set(rulesResult.value.map((rule) => rule.productId).filter(Boolean)));
      try {
        setProducts(await lookupOperationalProducts(ruleProductIds));
      } catch {
        setProducts([]);
      }
    } else {
      setProducts([]);
    }

    if (unitsResult.status === 'fulfilled') {
      setUnits(unitsResult.value);
    } else {
      setUnits([]);
    }

    if (usersResult.status === 'fulfilled') {
      setUsers(usersResult.value);
    } else {
      setUsers([]);
    }

    const moduleError =
      rulesResult.status === 'rejected'
        ? rulesResult.reason
        : alertsResult.status === 'rejected'
          ? alertsResult.reason
          : summaryResult.status === 'rejected'
            ? summaryResult.reason
            : null;

    const nextCatalogError =
      productsResult.status === 'rejected'
        ? productsResult.reason
        : unitsResult.status === 'rejected'
          ? unitsResult.reason
          : null;

    if (moduleError) {
      setError(moduleError instanceof Error ? moduleError.message : 'Nao foi possivel carregar o modulo de contagens.');
    }

    if (nextCatalogError) {
      setCatalogError(nextCatalogError instanceof Error ? nextCatalogError.message : 'Nao foi possivel carregar o catalogo de mercadorias.');
    }

    setLastUpdatedAt(new Date());
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

  // Tempo real: avisos e resumo a cada 15s (so com a aba visivel) e ao voltar para a aba.
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') void refreshLive();
    };
    const timer = window.setInterval(tick, 15000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);

  const filteredRules = useMemo(() => {
    const productMap = new Map(products.map((product) => [product.id, product]));
    const grouped = new Map<string, OperationalCountRule[]>();
    const singles: OperationalRuleListItem[] = [];

    rules.forEach((rule) => {
      if (rule.groupId) {
        const groupKey = `custom::${rule.groupId}`;
        const current = grouped.get(groupKey) ?? [];
        current.push(rule);
        grouped.set(groupKey, current);
        return;
      }

      const product = productMap.get(rule.productId);
      const classificationKey = product?.classificationKey;
      const classificationLabel = product?.classification || product?.stockType;

      if (!classificationKey || !classificationLabel) {
        singles.push({
          id: rule.id,
          type: 'product',
          title: rule.productName,
          subtitle: rule.barcode,
          unitName: rule.unitName,
          frequency: rule.frequency,
          executionDeadlineMinutes: rule.executionDeadlineMinutes,
          isActive: rule.isActive,
          responsibleUserId: rule.responsibleUserId,
          responsibleUserName: rule.responsibleUserName,
          ruleIds: [rule.id],
          productCount: 1,
          startDate: rule.startDate,
          endDate: rule.endDate,
          representativeRule: rule,
          searchText: `${rule.productName} ${rule.barcode} ${rule.unitName}`.toLowerCase(),
        });
        return;
      }

      const groupKey = [
        classificationKey,
        rule.unitId,
        rule.responsibleUserId ?? '',
        rule.frequency,
        rule.executionDeadlineMinutes,
        rule.startDate,
        rule.endDate ?? '',
        rule.isActive ? '1' : '0',
      ].join('::');

      const current = grouped.get(groupKey) ?? [];
      current.push(rule);
      grouped.set(groupKey, current);
    });

    const groupedItems: OperationalRuleListItem[] = Array.from(grouped.entries()).flatMap<OperationalRuleListItem>(([key, groupRules]) => {
      const firstRule = groupRules[0];
      const product = productMap.get(firstRule.productId);
      const classificationLabel = product?.classification || product?.stockType;

      if (firstRule.groupId && groupRules.length > 1) {
        const names = groupRules.map((rule) => rule.productName);
        const title = names.length <= 3 ? names.join(', ') : `${names.slice(0, 3).join(', ')} e mais ${names.length - 3}`;

        return [
          {
            id: key,
            type: 'product' as const,
            title,
            subtitle: `${groupRules.length} produtos no mesmo disparo`,
            unitName: firstRule.unitName,
            frequency: firstRule.frequency,
            executionDeadlineMinutes: firstRule.executionDeadlineMinutes,
            isActive: firstRule.isActive,
            responsibleUserId: firstRule.responsibleUserId,
            responsibleUserName: firstRule.responsibleUserName,
            ruleIds: groupRules.map((rule) => rule.id),
            productCount: groupRules.length,
            startDate: firstRule.startDate,
            endDate: firstRule.endDate,
            representativeRule: firstRule,
            responsibleCount: new Set(groupRules.map((rule) => rule.responsibleUserId ?? '')).size,
            products: groupRules.map((rule) => ({ id: rule.productId, name: rule.productName, barcode: rule.barcode })),
            searchText: `${names.join(' ')} ${groupRules.map((rule) => rule.barcode).join(' ')} ${firstRule.unitName}`.toLowerCase(),
          },
        ];
      }

      if (!classificationLabel || groupRules.length <= 1) {
        return groupRules.map((rule) => ({
          id: rule.id,
          type: 'product' as const,
          title: rule.productName,
          subtitle: rule.barcode,
          unitName: rule.unitName,
          frequency: rule.frequency,
          executionDeadlineMinutes: rule.executionDeadlineMinutes,
          isActive: rule.isActive,
          responsibleUserId: rule.responsibleUserId,
          responsibleUserName: rule.responsibleUserName,
          ruleIds: [rule.id],
          productCount: 1,
          startDate: rule.startDate,
          endDate: rule.endDate,
          representativeRule: rule,
          searchText: `${rule.productName} ${rule.barcode} ${rule.unitName}`.toLowerCase(),
        }));
      }

      return [
        {
          id: key,
          type: 'classification' as const,
          title: classificationLabel,
          subtitle: `${groupRules.length} produtos no lote`,
          unitName: firstRule.unitName,
          frequency: firstRule.frequency,
          executionDeadlineMinutes: firstRule.executionDeadlineMinutes,
          isActive: firstRule.isActive,
          responsibleUserId: firstRule.responsibleUserId,
          responsibleUserName: firstRule.responsibleUserName,
          ruleIds: groupRules.map((rule) => rule.id),
          productCount: groupRules.length,
          startDate: firstRule.startDate,
          endDate: firstRule.endDate,
          representativeRule: firstRule,
          responsibleCount: new Set(groupRules.map((rule) => rule.responsibleUserId ?? '')).size,
          products: groupRules.map((rule) => ({ id: rule.productId, name: rule.productName, barcode: rule.barcode })),
          searchText: `${classificationLabel} ${groupRules.map((rule) => `${rule.productName} ${rule.barcode}`).join(' ')} ${firstRule.unitName}`.toLowerCase(),
        },
      ];
    });

    return [...singles, ...groupedItems]
      .filter((rule) => {
        const matchesProduct =
          !filters.productSearch ||
          rule.searchText.includes(filters.productSearch.toLowerCase());
        const matchesUnit =
          !filters.unitSearch ||
          rule.unitName.toLowerCase().includes(filters.unitSearch.toLowerCase());
        const matchesStatus = !filters.showOnlyActive || rule.isActive;

        return matchesProduct && matchesUnit && matchesStatus;
      })
      .sort((left, right) => left.title.localeCompare(right.title));
  }, [filters, products, rules]);

  const filteredAlerts = useMemo(() => {
    const productSearch = filters.productSearch.toLowerCase();
    const unitSearch = filters.unitSearch.toLowerCase();
    return alerts.filter((alert) => {
      const matchesProduct =
        !productSearch ||
        (alert.title || '').toLowerCase().includes(productSearch) ||
        (alert.items ?? []).some(
          (item) =>
            (item.productName || '').toLowerCase().includes(productSearch) ||
            (item.barcode || '').toLowerCase().includes(productSearch),
        );
      const matchesUnit = !unitSearch || (alert.unitName || '').toLowerCase().includes(unitSearch);

      return matchesProduct && matchesUnit;
    });
  }, [alerts, filters]);

  const filteredAuditResults = useMemo(() => {
    return auditResults.filter((result) => {
      const matchesProduct =
        !auditResultFilters.productSearch ||
        (result.productName || '').toLowerCase().includes(auditResultFilters.productSearch.toLowerCase());
      const matchesUnit =
        !auditResultFilters.unitSearch ||
        (result.unitName || '').toLowerCase().includes(auditResultFilters.unitSearch.toLowerCase());
      const matchesSeller =
        !auditResultFilters.sellerSearch ||
        (result.sellerName || '').toLowerCase().includes(auditResultFilters.sellerSearch.toLowerCase());
      const matchesStatus =
        auditResultFilters.status === 'todos' || result.resultStatus === auditResultFilters.status;
      const finishedAtTime = result.finishedAt ? new Date(result.finishedAt).getTime() : null;
      const matchesDateFrom =
        !auditResultFilters.dateFrom || (finishedAtTime !== null && finishedAtTime >= new Date(auditResultFilters.dateFrom).getTime());
      const matchesDateTo =
        !auditResultFilters.dateTo || (finishedAtTime !== null && finishedAtTime <= new Date(`${auditResultFilters.dateTo}T23:59:59`).getTime());

      return matchesProduct && matchesUnit && matchesSeller && matchesStatus && matchesDateFrom && matchesDateTo;
    });
  }, [auditResultFilters, auditResults]);

  const saveRule = async (input: OperationalRuleSubmitInput, editingRuleId?: string | null): Promise<OperationalRuleSubmitResult> => {
    setSaving(true);

    try {
      if (input.mode === 'edit-batch') {
        const { updatedCount } = await updateOperationalCountRulesBatch(input.ruleIds, input.changes);
        await Promise.all([refreshRules(), refreshLive()]);
        return { mode: 'product', createdCount: updatedCount, skippedCount: 0 };
      }

      if (input.mode === 'edit') {
        await updateOperationalCountRule(editingRuleId!, input.payload);
        await Promise.all([refreshRules(), refreshLive()]);
        return { mode: 'product', createdCount: 1, skippedCount: 0 };
      }

      const existingKeys = new Set(
        rules.map((rule) => `${rule.productId}:${rule.unitId}:${rule.responsibleUserId ?? ''}`),
      );
      const uniquePayloads = input.payloads.filter((payload, index, current) => {
        const duplicateIndex = current.findIndex(
          (candidate) =>
            candidate.productId === payload.productId &&
            candidate.unitId === payload.unitId &&
            (candidate.responsibleUserId ?? '') === (payload.responsibleUserId ?? ''),
        );

        return duplicateIndex === index;
      });
      const payloadsToCreate = uniquePayloads.filter(
        (payload) => !existingKeys.has(`${payload.productId}:${payload.unitId}:${payload.responsibleUserId ?? ''}`),
      );

      await createOperationalCountRulesBatch(payloadsToCreate);
      await Promise.all([refreshRules(), refreshLive()]);

      return {
        mode: input.mode,
        classificationLabel: input.classificationLabel,
        createdCount: payloadsToCreate.length,
        skippedCount: uniquePayloads.length - payloadsToCreate.length,
      };
    } finally {
      setSaving(false);
    }
  };

  const cancelAlert = async (alertId: string) => {
    setSaving(true);
    try {
      await cancelOperationalCountAlert(alertId);
      await refreshLive();
    } finally {
      setSaving(false);
    }
  };

  // Ativar/desativar regra ou lote inteiro numa requisicao so. Desativar tira do app os
  // avisos abertos dessas regras.
  const setRulesActive = async (ruleIds: string[], isActive: boolean) => {
    setSaving(true);
    try {
      await updateOperationalCountRulesBatch(ruleIds, { isActive });
      await Promise.all([refreshRules(), refreshLive()]);
    } finally {
      setSaving(false);
    }
  };

  const deleteRules = async (ruleIds: string[]) => {
    setSaving(true);
    try {
      await deleteOperationalCountRulesBatch(ruleIds);
      await Promise.all([refreshRules(), refreshLive()]);
    } finally {
      setSaving(false);
    }
  };

  const deleteAuditResult = async (auditId: string) => {
    setSaving(true);

    try {
      await deleteOperationalAuditResult(auditId);
      setAuditResults((current) => current.filter((result) => result.id !== auditId));
    } finally {
      setSaving(false);
    }
  };

  const dispatchRules = async (ruleIds: string[]) => {
    setSaving(true);
    try {
      const result = await dispatchOperationalRules(ruleIds);
      await refreshLive();
      return result;
    } finally {
      setSaving(false);
    }
  };

  const runScheduler = async () => {
    setRunningScheduler(true);

    try {
      const result = await runOperationalAlertsScheduler();
      await Promise.all([refreshRules(), refreshLive()]);
      return result;
    } finally {
      setRunningScheduler(false);
    }
  };

  return {
    rules,
    alerts,
    summary,
    products,
    classificationOptions,
    units,
    users,
    filters,
    setFilters,
    auditResults,
    auditResultFilters,
    setAuditResultFilters,
    filteredRules,
    filteredAlerts,
    cancelAlert,
    dispatchRules,
    filteredAuditResults,
    loading,
    saving,
    runningScheduler,
    error,
    catalogError,
    reload: loadData,
    saveRule,
    setRulesActive,
    deleteRules,
    lastUpdatedAt,
    deleteAuditResult,
    runScheduler,
  };
}
