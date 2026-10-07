import React from 'react';
import {
  Activity,
  Building2,
  Calendar,
  ChevronRight,
  ClipboardList,
  Filter,
  Package,
  RefreshCcw,
  Undo2,
  X,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/AuthContext';
import { useOperationalAuditDashboard } from '@/hooks/useOperationalAuditDashboard';
import { getPortalAuditApiBaseUrl } from '@/services/portalAuditApi';
import { OperationalAuditLossesSection } from './OperationalAuditLossesSection';
import { OperationalAuditSummaryCards } from './OperationalAuditSummaryCards';
import { OperationalAuditUnitTable } from './OperationalAuditUnitTable';

interface OperationalAuditOverviewProps {
  onNavigate: (view: string) => void;
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

const DATE_PRESETS = [
  {
    label: 'Hoje',
    getRange: () => {
      const today = toIsoDate(new Date());
      return { dateFrom: today, dateTo: today };
    },
  },
  {
    label: 'Ultimos 7 dias',
    getRange: () => {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 6);
      return { dateFrom: toIsoDate(from), dateTo: toIsoDate(to) };
    },
  },
  {
    label: 'Ultimos 30 dias',
    getRange: () => {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 29);
      return { dateFrom: toIsoDate(from), dateTo: toIsoDate(to) };
    },
  },
  {
    label: 'Este mes',
    getRange: () => {
      const today = new Date();
      const from = new Date(today.getFullYear(), today.getMonth(), 1);
      return { dateFrom: toIsoDate(from), dateTo: toIsoDate(today) };
    },
  },
];

export const OperationalAuditOverview: React.FC<OperationalAuditOverviewProps> = ({ onNavigate }) => {
  const { profile } = useAuth();
  const {
    summary,
    unitMetrics,
    topShortageUnits,
    topSurplusUnits,
    unitOptions,
    filters,
    setFilters,
    loading,
    error,
    hasData,
    reload,
  } = useOperationalAuditDashboard();

  const navCards = [
    {
      id: 'management',
      title: 'Gestao de Contagens',
      description: 'Cadastrar regras, disparar lotes e revisar auditorias recebidas.',
      icon: Package,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      adminOnly: true,
    },
    {
      id: 'checklists',
      title: 'Checklists',
      description: 'Checklists de conformidade finalizados pelo app.',
      icon: ClipboardList,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
      adminOnly: false,
    },
    {
      id: 'returns',
      title: 'Devolucoes',
      description: 'Devolucoes de mercadoria enviadas pelo app.',
      icon: Undo2,
      color: 'text-rose-500',
      bgColor: 'bg-rose-500/10',
      adminOnly: false,
    },
  ];

  const filteredCards = navCards.filter((card) => !card.adminOnly || profile?.role === 'admin');

  const selectedUnitName = filters.unitId !== 'all' ? unitOptions.find((unit) => unit.id === filters.unitId)?.name : undefined;
  const activeFilterCount = (filters.unitId !== 'all' ? 1 : 0) + (filters.dateFrom || filters.dateTo ? 1 : 0);
  const clearFilters = () => setFilters((current) => ({ ...current, unitId: 'all', dateFrom: '', dateTo: '' }));

  return (
    <div className="space-y-8">
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
        <CardContent className="flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-primary">
              <Activity className="h-5 w-5" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Integracao operacional</span>
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-foreground">Dashboard conectado ao backend do app de auditoria</h3>
              <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
                Todos os indicadores abaixo ja podem ser filtrados por filial e por periodo, direto no banco de dados.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">API: {getPortalAuditApiBaseUrl()}</Badge>
              <Badge variant="outline">Leitura sem JWT</Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="gap-2" onClick={() => void reload()} disabled={loading}>
              <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            {profile?.role === 'admin' && (
              <Button className="gap-2 shadow-lg shadow-primary/20" onClick={() => onNavigate('management')}>
                Abrir Gestao de Contagens
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 shadow-sm">
        <CardHeader className="gap-5">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Filter className="h-4.5 w-4.5" />
              </div>
              <div>
                <CardTitle className="text-xl">Filtros do Dashboard</CardTitle>
                <CardDescription>Veja os indicadores de uma filial e/ou periodo especifico.</CardDescription>
              </div>
            </div>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={clearFilters}>
                <X className="h-3.5 w-3.5" />
                Limpar filtros ({activeFilterCount})
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Building2 className="h-3.5 w-3.5" />
                Filial
              </Label>
              <Select value={filters.unitId} onValueChange={(value) => setFilters((current) => ({ ...current, unitId: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as filiais" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as filiais</SelectItem>
                  {unitOptions.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>
                      {unit.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dashboard-date-from" className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                De
              </Label>
              <Input
                id="dashboard-date-from"
                type="date"
                value={filters.dateFrom}
                max={filters.dateTo || undefined}
                onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dashboard-date-to" className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                Ate
              </Label>
              <Input
                id="dashboard-date-to"
                type="date"
                value={filters.dateTo}
                min={filters.dateFrom || undefined}
                onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-4">
            <span className="text-xs font-medium text-muted-foreground">Periodos rapidos:</span>
            {DATE_PRESETS.map((preset) => (
              <Button
                key={preset.label}
                type="button"
                variant="outline"
                size="sm"
                className="h-7 rounded-full px-3 text-xs"
                onClick={() => setFilters((current) => ({ ...current, ...preset.getRange() }))}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          {activeFilterCount > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {selectedUnitName && (
                <Badge variant="secondary" className="gap-1.5 py-1 pl-2.5 pr-1.5 font-normal">
                  Filial: {selectedUnitName}
                  <button
                    type="button"
                    onClick={() => setFilters((current) => ({ ...current, unitId: 'all' }))}
                    className="rounded-full p-0.5 hover:bg-background/60"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {(filters.dateFrom || filters.dateTo) && (
                <Badge variant="secondary" className="gap-1.5 py-1 pl-2.5 pr-1.5 font-normal">
                  Periodo: {filters.dateFrom || '...'} a {filters.dateTo || '...'}
                  <button
                    type="button"
                    onClick={() => setFilters((current) => ({ ...current, dateFrom: '', dateTo: '' }))}
                    className="rounded-full p-0.5 hover:bg-background/60"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
            </div>
          )}
        </CardHeader>
      </Card>

      {error ? (
        <Card className="border-rose-500/20 bg-rose-500/5">
          <CardContent className="flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <p className="text-lg font-bold text-foreground">Falha ao carregar a integracao da auditoria</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
            <Button variant="outline" className="gap-2" onClick={() => void reload()}>
              <RefreshCcw className="h-4 w-4" />
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <OperationalAuditSummaryCards loading={loading} summary={summary} />
          <OperationalAuditLossesSection
            loading={loading}
            topShortageUnits={topShortageUnits}
            topSurplusUnits={topSurplusUnits}
          />
          <OperationalAuditUnitTable loading={loading} rows={unitMetrics} />
          {!loading && !hasData && (
            <Card className="border-dashed border-border/80">
              <CardContent className="px-6 py-12 text-center">
                <p className="text-lg font-semibold text-foreground">Ainda nao ha sessoes sincronizadas</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Assim que o app enviar auditorias, checklists e devolucoes finalizadas para o backend,
                  o portal passara a mostrar os indicadores aqui automaticamente.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {filteredCards.map((card) => (
          <Card
            key={card.id}
            className="group cursor-pointer border-border/50 transition-all hover:-translate-y-0.5 hover:shadow-md"
            onClick={() => onNavigate(card.id)}
          >
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${card.bgColor} transition-transform group-hover:scale-110`}>
                  <card.icon className={`h-6 w-6 ${card.color}`} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-foreground transition-colors group-hover:text-primary">{card.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{card.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
