import React, { useEffect, useMemo, useState } from 'react';
import { Eye, RefreshCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getPortalChecklistDetail, getPortalChecklists } from '@/services/portalAuditApi';
import { getOperationalUnits } from '@/features/operational-alerts/api';
import { OperationalUnitOption } from '@/features/operational-alerts/types';
import { PortalChecklistDetail, PortalChecklistSummary } from '@/types';

const STATUS_LABELS: Record<string, string> = {
  conforme: 'Conforme',
  nao_conforme: 'Nao conforme',
  nao_se_aplica: 'Nao se aplica',
};

interface PayloadChecklistItem {
  sectionId?: string;
  itemId?: string;
  label?: string;
  status?: string;
  observation?: string;
}

interface PayloadChecklistSection {
  sectionId?: string;
  title?: string;
  items?: PayloadChecklistItem[];
}

function formatDateTime(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('pt-BR');
}

function formatPercent(value: number) {
  return `${Number(value).toFixed(1)}%`;
}

function statusBadgeVariant(status: string | undefined): 'default' | 'destructive' | 'outline' {
  if (status === 'nao_conforme') return 'destructive';
  if (status === 'conforme') return 'default';
  return 'outline';
}

function getPayloadSections(payload: unknown): PayloadChecklistSection[] {
  const sections = (payload as { sections?: unknown })?.sections;
  return Array.isArray(sections) ? (sections as PayloadChecklistSection[]) : [];
}

export const ChecklistsPage: React.FC = () => {
  const [checklists, setChecklists] = useState<PortalChecklistSummary[]>([]);
  const [units, setUnits] = useState<OperationalUnitOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sellerSearch, setSellerSearch] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [selected, setSelected] = useState<PortalChecklistDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const load = async (filterUnitId?: string) => {
    setLoading(true);
    setError(null);

    try {
      const [checklistData, unitData] = await Promise.all([
        getPortalChecklists(filterUnitId ? { unitId: filterUnitId } : {}),
        getOperationalUnits(),
      ]);
      setChecklists(checklistData);
      setUnits(unitData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel carregar os checklists.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const search = sellerSearch.trim().toLowerCase();
    if (!search) return checklists;
    return checklists.filter((item) => item.seller_name.toLowerCase().includes(search));
  }, [checklists, sellerSearch]);

  const summary = useMemo(() => {
    const total = checklists.length;
    const avgConformity = total > 0 ? checklists.reduce((sum, item) => sum + Number(item.conformity_score), 0) / total : 0;
    const totalNonConformities = checklists.reduce((sum, item) => sum + item.non_conformities, 0);
    return { total, avgConformity, totalNonConformities };
  }, [checklists]);

  const openDetail = async (sourceSessionId: string) => {
    setLoadingDetail(true);
    try {
      setSelected(await getPortalChecklistDetail(sourceSessionId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel carregar o checklist.');
    } finally {
      setLoadingDetail(false);
    }
  };

  const sections = getPayloadSections(selected?.payload);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Checklists</h2>
          <p className="text-muted-foreground">Checklists de conformidade finalizados e enviados pelo app, por filial.</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => void load(unitFilter)} disabled={loading}>
          <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {error && (
        <Card className="border-rose-500/20 bg-rose-500/5">
          <CardContent className="p-5 text-sm text-rose-600">{error}</CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card><CardContent className="p-5"><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Total de checklists</p><p className="mt-2 text-3xl font-bold text-foreground">{loading ? '...' : summary.total}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Conformidade media</p><p className="mt-2 text-3xl font-bold text-foreground">{loading ? '...' : formatPercent(summary.avgConformity)}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Nao conformidades</p><p className="mt-2 text-3xl font-bold text-rose-600">{loading ? '...' : summary.totalNonConformities}</p></CardContent></Card>
      </div>

      <Card className="border-border/60 shadow-sm">
        <CardContent className="grid gap-4 p-5 md:grid-cols-2">
          <Input placeholder="Filtrar por auditor" value={sellerSearch} onChange={(event) => setSellerSearch(event.target.value)} />
          <select
            className="flex h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={unitFilter}
            onChange={(event) => {
              setUnitFilter(event.target.value);
              void load(event.target.value);
            }}
          >
            <option value="">Todas as filiais</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      <Card className="border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">Checklists recebidos</CardTitle>
          <CardDescription>Abra o detalhe para ver o resultado de cada pergunta respondida.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-sm text-muted-foreground">Carregando checklists...</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">Nenhum checklist foi recebido ainda.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Filial</TableHead>
                  <TableHead>Auditor</TableHead>
                  <TableHead>Quando</TableHead>
                  <TableHead>Progresso</TableHead>
                  <TableHead>Conformidade</TableHead>
                  <TableHead className="pr-6 text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="pl-6 font-medium text-foreground">{item.unit_name || item.unit_id}</TableCell>
                    <TableCell>{item.seller_name}</TableCell>
                    <TableCell>{formatDateTime(item.finished_at)}</TableCell>
                    <TableCell>{formatPercent(item.progress)}</TableCell>
                    <TableCell>
                      <Badge variant={item.non_conformities === 0 ? 'default' : 'destructive'}>
                        {formatPercent(item.conformity_score)}
                      </Badge>
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <Button variant="outline" size="icon" onClick={() => void openDetail(item.source_session_id)} title="Ver checklist">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="flex max-h-[85vh] max-w-4xl flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Checklist</DialogTitle>
            <DialogDescription>Resultado de cada pergunta respondida no app mobile.</DialogDescription>
          </DialogHeader>

          {loadingDetail ? (
            <div className="p-6 text-sm text-muted-foreground">Carregando...</div>
          ) : selected ? (
            <div className="flex min-h-0 flex-1 flex-col space-y-5">
              <div className="grid gap-4 md:grid-cols-4">
                <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Filial</p><p className="mt-1 font-semibold">{selected.unit_name || selected.unit_id}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Auditor</p><p className="mt-1 font-semibold">{selected.seller_name}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Secoes</p><p className="mt-1 font-semibold">{selected.total_sections}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Conformidade</p><p className="mt-1 font-semibold">{formatPercent(selected.conformity_score)}</p></CardContent></Card>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto pr-4">
                <div className="space-y-4 pb-2">
                {sections.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum item detalhado disponivel para este checklist.</p>
                ) : (
                  sections.map((section, sectionIndex) => (
                    <div key={section.sectionId ?? sectionIndex} className="overflow-x-auto rounded-xl border border-border/60">
                      <div className="border-b border-border/60 bg-muted/30 px-4 py-2 text-sm font-semibold text-foreground">
                        {section.title || `Secao ${sectionIndex + 1}`}
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="pl-4">Item</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="pr-4">Observacao</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(section.items ?? []).map((item, itemIndex) => (
                            <TableRow key={item.itemId ?? itemIndex}>
                              <TableCell className="pl-4 font-medium text-foreground">{item.label || '-'}</TableCell>
                              <TableCell>
                                <Badge variant={statusBadgeVariant(item.status)}>
                                  {item.status ? STATUS_LABELS[item.status] ?? item.status : 'Sem resposta'}
                                </Badge>
                              </TableCell>
                              <TableCell className="pr-4 text-sm text-muted-foreground">{item.observation || '-'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ))
                )}
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};
