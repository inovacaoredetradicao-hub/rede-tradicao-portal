import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, BellRing, CheckCircle2, PackageSearch, Play, RefreshCcw, Search, Settings2, TimerReset, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { OperationalCountRuleForm } from './OperationalCountRuleForm';
import { OperationalCountRulesTable } from './OperationalCountRulesTable';
import { OperationalCountAlertsTable } from './OperationalCountAlertsTable';
import { OperationalAuditResultsSection } from './OperationalAuditResultsSection';
import { UserUnitsManager } from './UserUnitsManager';
import { useOperationalCountAdmin } from '@/hooks/useOperationalCountAdmin';
import {
  getCatalogBackendBaseUrl,
  getOperationalAlertsBackendBaseUrl,
  searchOperationalProducts,
} from '@/features/operational-alerts/api';
import {
  EditingRuleGroup,
  OperationalCountRule,
  OperationalProductOption,
  OperationalRuleListItem,
  OperationalRuleSubmitInput,
} from '@/features/operational-alerts/types';

interface OperationalCountsAdminProps {
  onBack: () => void;
}

export const OperationalCountsAdmin: React.FC<OperationalCountsAdminProps> = ({ onBack }) => {
  const {
    summary,
    classificationOptions,
    units,
    users,
    filters,
    setFilters,
    auditResultFilters,
    setAuditResultFilters,
    filteredRules,
    filteredAlerts,
    filteredAuditResults,
    loading,
    saving,
    runningScheduler,
    error,
    catalogError,
    reload,
    saveRule,
    toggleRule,
    deleteRule,
    deleteAuditResult,
    runScheduler,
  } = useOperationalCountAdmin();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isProductsOpen, setIsProductsOpen] = useState(false);
  const [isUserUnitsOpen, setIsUserUnitsOpen] = useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<OperationalCountRule | null>(null);
  const [editingGroup, setEditingGroup] = useState<EditingRuleGroup | null>(null);
  const [productCatalogSearch, setProductCatalogSearch] = useState('');
  // Consulta de mercadorias sob demanda (botao/Enter), 100 por vez.
  const [catalogResults, setCatalogResults] = useState<OperationalProductOption[]>([]);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [catalogSearched, setCatalogSearched] = useState(false);
  const [catalogSearching, setCatalogSearching] = useState(false);

  const runCatalogSearch = async () => {
    setCatalogSearching(true);
    try {
      const result = await searchOperationalProducts(productCatalogSearch, 100);
      setCatalogResults(result.items);
      setCatalogTotal(result.total);
      setCatalogSearched(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel buscar mercadorias.');
    } finally {
      setCatalogSearching(false);
    }
  };

  const summaryCards = useMemo(() => {
    return [
      {
        label: 'Regras ativas',
        value: filteredRules.filter((rule) => rule.isActive).length,
        icon: Settings2,
        tone: 'bg-blue-500/10 text-blue-600',
      },
      {
        label: 'Alertas pendentes',
        value: summary?.totalPending ?? 0,
        icon: BellRing,
        tone: 'bg-amber-500/10 text-amber-600',
      },
      {
        label: 'Alertas vencidos',
        value: summary?.totalExpired ?? 0,
        icon: AlertTriangle,
        tone: 'bg-rose-500/10 text-rose-600',
      },
      {
        label: 'Alertas concluidos',
        value: summary?.totalCompleted ?? 0,
        icon: CheckCircle2,
        tone: 'bg-emerald-500/10 text-emerald-600',
      },
    ];
  }, [filteredRules, summary]);

  const handleOpenCreate = () => {
    setEditingRule(null);
    setEditingGroup(null);
    setIsFormOpen(true);
  };

  const handleEditRule = (rule: OperationalRuleListItem) => {
    if (!rule.representativeRule) {
      return;
    }

    // Lote (classificacao ou varios produtos): a edicao vale para todas as regras dele.
    setEditingGroup(
      rule.ruleIds.length > 1
        ? {
            ruleIds: rule.ruleIds,
            title: rule.title,
            type: rule.type,
            productCount: rule.productCount,
            responsibleCount: rule.responsibleCount ?? 1,
            products: rule.products ?? [],
          }
        : null,
    );
    setEditingRule(rule.representativeRule as OperationalCountRule);
    setIsFormOpen(true);
  };

  const handleSaveRule = async (payload: OperationalRuleSubmitInput, editingRuleId?: string | null) => {
    try {
      const result = await saveRule(payload, editingRuleId);

      if (payload.mode === 'edit-batch') {
        toast.success(`Lote atualizado: ${result.createdCount} regra(s).`);
        return result;
      }

      if (editingRuleId) {
        toast.success('Regra atualizada com sucesso.');
        return result;
      }

      const label = result.classificationLabel ? ` para ${result.classificationLabel}` : '';
      toast.success(
        result.skippedCount > 0
          ? `${result.createdCount} disparo(s) criado(s)${label}. ${result.skippedCount} ja existiam.`
          : `${result.createdCount} disparo(s) criado(s)${label}.`,
      );
      return result;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel salvar a regra.');
      throw error;
    }
  };

  const handleToggleRule = async (ruleIds: string[]) => {
    try {
      await Promise.all(ruleIds.map((ruleId) => toggleRule(ruleId)));
      toast.success(ruleIds.length > 1 ? 'Status do lote atualizado.' : 'Status da regra atualizado.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel alterar a regra.');
    }
  };

  const handleRunScheduler = async () => {
    try {
      const result = await runScheduler();
      toast.success(`Disparo concluido. ${result.createdCount} alerta(s) criado(s) e ${result.expiredCount} vencido(s).`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao disparar alertas.');
    }
  };

  const handleDeleteRule = async (ruleIds: string[]) => {
    const confirmed = window.confirm(
      ruleIds.length > 1
        ? 'Deseja excluir este lote de classificacao? Todos os produtos vinculados serao removidos.'
        : 'Deseja excluir esta regra? Os alertas vinculados tambem serao removidos.',
    );

    if (!confirmed) {
      return;
    }

    try {
      await Promise.all(ruleIds.map((ruleId) => deleteRule(ruleId)));
      toast.success(ruleIds.length > 1 ? 'Lote de classificacao excluido com sucesso.' : 'Regra excluida com sucesso.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel excluir a regra.');
    }
  };

  const handleDeleteAuditResult = async (auditId: string) => {
    const confirmed = window.confirm('Deseja excluir esta auditoria recebida? Esta acao nao pode ser desfeita.');

    if (!confirmed) {
      return;
    }

    try {
      await deleteAuditResult(auditId);
      toast.success('Auditoria recebida excluida com sucesso.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel excluir a auditoria recebida.');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="space-y-1">
            <h2 className="text-3xl font-bold text-foreground">Cadastro de contagens</h2>
            <p className="text-muted-foreground">Cadastre regras de contagem por produto e dispare rapidamente alertas operacionais para o app mobile.</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Badge variant="outline" className="px-3 py-1">
            Catalogo: {getCatalogBackendBaseUrl()}
          </Badge>
          <Badge variant="outline" className="px-3 py-1">
            Disparos: {getOperationalAlertsBackendBaseUrl()}
          </Badge>
          <Button className="gap-2" onClick={handleOpenCreate}>
            <Play className="h-4 w-4" />
            Novo disparo
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => setIsProductsOpen(true)}>
            <PackageSearch className="h-4 w-4" />
            Ver mercadorias
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => setIsUserUnitsOpen(true)}>
            <Users className="h-4 w-4" />
            Usuarios por filial
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => void handleRunScheduler()} disabled={runningScheduler}>
            <TimerReset className={`h-4 w-4 ${runningScheduler ? 'animate-spin' : ''}`} />
            Disparar agora
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => void reload()}>
            <RefreshCcw className="h-4 w-4" />
            Atualizar
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-rose-500/20 bg-rose-500/5">
          <CardContent className="flex flex-col gap-3 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="font-semibold text-foreground">Nao foi possivel carregar o modulo</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
            <Button variant="outline" onClick={() => void reload()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((item) => (
          <Card key={item.label} className="border-border/60 shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${item.tone}`}>
                <item.icon className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{item.label}</p>
                <p className="text-3xl font-bold text-foreground">{loading ? '...' : item.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {classificationOptions.length > 0 && (
        <Card className="border-border/60 shadow-sm">
          <CardContent className="space-y-4 p-5">
            <div>
              <p className="text-sm font-semibold text-foreground">Disparo por classificacao</p>
              <p className="text-sm text-muted-foreground">
                Visualize rapidamente os grupos disponiveis e use o modo de classificacao no botao Novo disparo para mandar um lote inteiro ao app.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {classificationOptions.slice(0, 8).map((classification) => (
                <div key={classification.key} className="rounded-xl border border-border bg-background px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">{classification.label}</p>
                      <p className="text-xs text-muted-foreground">Pronto para disparo em lote</p>
                    </div>
                    <div className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                      {classification.productCount}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/60 shadow-sm">
        <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-10"
                placeholder="Buscar produto ou codigo de barras"
                value={filters.productSearch}
                onChange={(event) => setFilters((current) => ({ ...current, productSearch: event.target.value }))}
              />
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-10"
                placeholder="Buscar filial ou unidade"
                value={filters.unitSearch}
                onChange={(event) => setFilters((current) => ({ ...current, unitSearch: event.target.value }))}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-border px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Mostrar apenas ativas</p>
              <p className="text-xs text-muted-foreground">Foco nas regras em operacao</p>
            </div>
            <Switch
              checked={filters.showOnlyActive}
              onCheckedChange={(checked) => setFilters((current) => ({ ...current, showOnlyActive: checked }))}
            />
          </div>
        </CardContent>
      </Card>

      <OperationalCountRulesTable
        loading={loading}
        rules={filteredRules}
        onEdit={handleEditRule}
        onToggle={handleToggleRule}
        onDelete={handleDeleteRule}
        onRunScheduler={handleRunScheduler}
      />

      <div className="flex justify-end">
        <Button variant="outline" className="gap-2" onClick={() => setIsAlertsOpen(true)}>
          <BellRing className="h-4 w-4" />
          Ver lotes/alertas gerados ({filteredAlerts.length})
        </Button>
      </div>

      <OperationalAuditResultsSection
        loading={loading}
        results={filteredAuditResults}
        filters={auditResultFilters}
        onFiltersChange={setAuditResultFilters}
        onDelete={handleDeleteAuditResult}
      />

      <OperationalCountRuleForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSubmit={handleSaveRule}
        saving={saving}
        classificationOptions={classificationOptions}
        units={units}
        users={users}
        editingRule={editingRule}
        editingGroup={editingGroup}
      />

      <Dialog open={isProductsOpen} onOpenChange={setIsProductsOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Mercadorias cadastradas</DialogTitle>
            <DialogDescription>Veja todas as mercadorias disponiveis no catalogo para usar nos disparos de contagem.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {catalogError && (
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-sm text-rose-600">
                {catalogError}
              </div>
            )}

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-10"
                  placeholder="Buscar por nome, codigo interno ou codigo de barras"
                  value={productCatalogSearch}
                  onChange={(event) => setProductCatalogSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void runCatalogSearch();
                  }}
                />
              </div>
              <Button type="button" onClick={() => void runCatalogSearch()} disabled={catalogSearching}>
                {catalogSearching ? 'Buscando...' : 'Buscar'}
              </Button>
            </div>
            {catalogSearched && (
              <p className="text-xs text-muted-foreground">
                {catalogTotal > catalogResults.length
                  ? `Mostrando ${catalogResults.length} de ${catalogTotal.toLocaleString('pt-BR')} mercadorias. Refine a busca para encontrar outras.`
                  : `${catalogTotal.toLocaleString('pt-BR')} mercadoria(s) encontrada(s).`}
              </p>
            )}

            <div className="rounded-xl border border-border/60">
              <div className="h-[420px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Codigo</TableHead>
                      <TableHead>Codigo de barras</TableHead>
                      <TableHead>Mercadoria</TableHead>
                      <TableHead className="pr-6">ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {catalogResults.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="px-6 py-10 text-center text-muted-foreground">
                          {catalogSearched ? 'Nenhuma mercadoria encontrada.' : 'Digite e clique em Buscar para consultar as mercadorias.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      catalogResults.map((product) => (
                        <TableRow key={product.id}>
                          <TableCell className="pl-6">{product.productCode || '-'}</TableCell>
                          <TableCell>{product.barcode || '-'}</TableCell>
                          <TableCell className="font-medium text-foreground">{product.name}</TableCell>
                          <TableCell className="pr-6 text-xs text-muted-foreground">{product.id}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isAlertsOpen} onOpenChange={setIsAlertsOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Lotes/alertas gerados</DialogTitle>
            <DialogDescription>Lotes disparados a partir das regras, com status pendente, em andamento, concluido ou vencido.</DialogDescription>
          </DialogHeader>
          <OperationalCountAlertsTable loading={loading} alerts={filteredAlerts} />
        </DialogContent>
      </Dialog>

      <Dialog open={isUserUnitsOpen} onOpenChange={setIsUserUnitsOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Usuarios por filial</DialogTitle>
            <DialogDescription>
              Marque em quais filiais cada usuario atua. Isso define quem aparece para escolha ao disparar uma contagem para uma filial.
            </DialogDescription>
          </DialogHeader>
          <UserUnitsManager />
        </DialogContent>
      </Dialog>
    </div>
  );
};
