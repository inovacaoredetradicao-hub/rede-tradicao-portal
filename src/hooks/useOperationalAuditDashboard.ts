import { useEffect, useMemo, useState } from 'react';
import { PortalAuditDashboardFilters, PortalAuditDashboardSummary, PortalAuditUnitLosses, PortalAuditUnitMetrics } from '@/types';
import {
  getPortalAuditDashboardByUnit,
  getPortalAuditDashboardSummary,
  getPortalAuditLossesByUnit,
} from '@/services/portalAuditApi';
import { getOperationalUnits } from '@/features/operational-alerts/api';
import { OperationalUnitOption } from '@/features/operational-alerts/types';

const TOP_RANKING_SIZE = 5;

const DEFAULT_FILTERS: PortalAuditDashboardFilters = {
  unitId: 'all',
  dateFrom: '',
  dateTo: '',
  operationType: 'all',
};

export function useOperationalAuditDashboard() {
  const [summary, setSummary] = useState<PortalAuditDashboardSummary | null>(null);
  const [unitMetrics, setUnitMetrics] = useState<PortalAuditUnitMetrics[]>([]);
  const [unitLosses, setUnitLosses] = useState<PortalAuditUnitLosses[]>([]);
  const [allUnits, setAllUnits] = useState<OperationalUnitOption[]>([]);
  const [filters, setFilters] = useState<PortalAuditDashboardFilters>(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getOperationalUnits()
      .then(setAllUnits)
      .catch(() => setAllUnits([]));
  }, []);

  const loadDashboard = async (activeFilters: PortalAuditDashboardFilters = filters) => {
    setLoading(true);
    setError(null);

    const queryFilters = {
      unitId: activeFilters.unitId !== 'all' ? activeFilters.unitId : undefined,
      dateFrom: activeFilters.dateFrom || undefined,
      dateTo: activeFilters.dateTo || undefined,
    };

    try {
      const [summaryData, unitData, lossesData] = await Promise.all([
        getPortalAuditDashboardSummary(queryFilters),
        getPortalAuditDashboardByUnit(queryFilters),
        getPortalAuditLossesByUnit(queryFilters),
      ]);

      setSummary(summaryData);
      setUnitMetrics(unitData);
      setUnitLosses(lossesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar os dados da auditoria.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.unitId, filters.dateFrom, filters.dateTo]);

  const unitOptions = useMemo(() => {
    return allUnits.slice().sort((first, second) => first.name.localeCompare(second.name, 'pt-BR'));
  }, [allUnits]);

  const topShortageUnits = useMemo(() => {
    return unitLosses
      .filter((item) => item.shortageQty > 0)
      .sort((a, b) => b.shortageQty - a.shortageQty)
      .slice(0, TOP_RANKING_SIZE);
  }, [unitLosses]);

  const topSurplusUnits = useMemo(() => {
    return unitLosses
      .filter((item) => item.surplusQty > 0)
      .sort((a, b) => b.surplusQty - a.surplusQty)
      .slice(0, TOP_RANKING_SIZE);
  }, [unitLosses]);

  const hasData = Boolean(summary) || unitMetrics.length > 0;

  return {
    summary,
    unitMetrics,
    unitLosses,
    topShortageUnits,
    topSurplusUnits,
    unitOptions,
    filters,
    setFilters,
    loading,
    error,
    hasData,
    reload: () => loadDashboard(filters),
  };
}
