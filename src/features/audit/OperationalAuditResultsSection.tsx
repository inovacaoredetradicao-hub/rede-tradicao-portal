import React, { useMemo, useState } from 'react';
import { Eye, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { OperationalAuditResult, OperationalAuditResultFilters } from '@/features/operational-alerts/types';
import { getPortalAuditApiBaseUrl } from '@/services/portalAuditApi';

interface OperationalAuditResultsSectionProps {
  loading: boolean;
  results: OperationalAuditResult[];
  filters: OperationalAuditResultFilters;
  onFiltersChange: React.Dispatch<React.SetStateAction<OperationalAuditResultFilters>>;
  onDelete: (auditId: string) => void | Promise<void>;
}

function formatPercent(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return '-';
  }

  return `${value.toFixed(1)}%`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleString('pt-BR');
}

interface PayloadItem {
  code?: string;
  name?: string;
  expectedQuantity?: number;
  countedQuantity?: number;
}

interface PayloadDivergence {
  code?: string;
  type?: string;
  justification?: string;
}

function getPayloadItems(payload: unknown): PayloadItem[] {
  const items = (payload as { items?: unknown })?.items;
  return Array.isArray(items) ? (items as PayloadItem[]) : [];
}

function getPayloadDivergenceMap(payload: unknown): Map<string, PayloadDivergence> {
  const divergences = (payload as { divergences?: unknown })?.divergences;
  const list = Array.isArray(divergences) ? (divergences as PayloadDivergence[]) : [];
  return new Map(list.filter((item) => item.code).map((item) => [item.code as string, item]));
}

function getPayloadTimestamps(payload: unknown) {
  const value = payload as { createdAt?: string; updatedAt?: string; finishedAt?: string };
  return {
    createdAt: value?.createdAt ?? null,
    updatedAt: value?.updatedAt ?? null,
    finishedAt: value?.finishedAt ?? null,
  };
}

export const OperationalAuditResultsSection: React.FC<OperationalAuditResultsSectionProps> = ({
  loading,
  results,
  filters,
  onFiltersChange,
  onDelete,
}) => {
  const [selectedResult, setSelectedResult] = useState<OperationalAuditResult | null>(null);
  const portalApiBaseUrl = getPortalAuditApiBaseUrl();

  const summary = useMemo(() => {
    const total = results.length;
    const totalOk = results.filter((result) => result.resultStatus === 'OK').length;
    const totalDivergent = results.filter((result) => result.resultStatus === 'Divergente').length;
    const accuracies = results.map((result) => result.accuracy).filter((value): value is number => value !== null);
    const avgAccuracy = accuracies.length > 0 ? accuracies.reduce((sum, value) => sum + value, 0) / accuracies.length : null;

    return { total, totalOk, totalDivergent, avgAccuracy };
  }, [results]);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-2xl font-bold text-foreground">Resultados das contagens</h3>
        <p className="text-muted-foreground">Veja o retorno completo das auditorias vindas do app mobile e entenda o que aconteceu em cada contagem.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card><CardContent className="p-5"><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Total de auditorias</p><p className="mt-2 text-3xl font-bold text-foreground">{loading ? '...' : summary.total}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Total OK</p><p className="mt-2 text-3xl font-bold text-emerald-600">{loading ? '...' : summary.totalOk}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Total divergentes</p><p className="mt-2 text-3xl font-bold text-rose-600">{loading ? '...' : summary.totalDivergent}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Acuracidade media</p><p className="mt-2 text-3xl font-bold text-foreground">{loading ? '...' : formatPercent(summary.avgAccuracy)}</p></CardContent></Card>
      </div>

      <Card className="border-border/60 shadow-sm">
        <CardContent className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-5">
          <Input placeholder="Filtrar por produto" value={filters.productSearch} onChange={(event) => onFiltersChange((current) => ({ ...current, productSearch: event.target.value }))} />
          <Input placeholder="Filtrar por filial" value={filters.unitSearch} onChange={(event) => onFiltersChange((current) => ({ ...current, unitSearch: event.target.value }))} />
          <Input placeholder="Filtrar por auditor" value={filters.sellerSearch} onChange={(event) => onFiltersChange((current) => ({ ...current, sellerSearch: event.target.value }))} />
          <select className="flex h-10 rounded-md border border-input bg-background px-3 text-sm" value={filters.status} onChange={(event) => onFiltersChange((current) => ({ ...current, status: event.target.value as OperationalAuditResultFilters['status'] }))}>
            <option value="todos">Todos os status</option>
            <option value="OK">OK</option>
            <option value="Divergente">Divergente</option>
          </select>
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={filters.dateFrom} onChange={(event) => onFiltersChange((current) => ({ ...current, dateFrom: event.target.value }))} />
            <Input type="date" value={filters.dateTo} onChange={(event) => onFiltersChange((current) => ({ ...current, dateTo: event.target.value }))} />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">Auditorias recebidas</CardTitle>
          <CardDescription>Abra o detalhe para entender produto, divergencias e payload completo da auditoria.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-sm text-muted-foreground">Carregando resultados...</div>
          ) : results.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">Nenhum resultado de auditoria foi recebido ainda.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Produto</TableHead>
                  <TableHead>Auditor</TableHead>
                  <TableHead>Quando</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Resumo</TableHead>
                  <TableHead className="pr-6 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((result) => (
                  <TableRow key={result.id}>
                    <TableCell className="pl-6">
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">{result.productName || 'Nao identificado'}</p>
                        <p className="text-xs text-muted-foreground">{result.unitName || result.unitId || '-'}</p>
                      </div>
                    </TableCell>
                    <TableCell>{result.sellerName || '-'}</TableCell>
                    <TableCell>{formatDateTime(result.finishedAt)}</TableCell>
                    <TableCell>
                      <Badge variant={result.resultStatus === 'OK' ? 'default' : 'destructive'}>
                        {result.resultStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        <p>Acuracidade: {formatPercent(result.accuracy)}</p>
                        <p className="text-muted-foreground">Itens: {result.totalItems} | Divergencias: {result.totalDivergences}</p>
                      </div>
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="icon" onClick={() => setSelectedResult(result)} title="Ver resultado">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => void onDelete(result.id)}
                          title="Excluir auditoria"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedResult} onOpenChange={(open) => !open && setSelectedResult(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Resultado da auditoria</DialogTitle>
            <DialogDescription>Visao completa da contagem recebida do app mobile.</DialogDescription>
          </DialogHeader>

          {selectedResult && (
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Produto</p><p className="mt-1 font-semibold">{selectedResult.productName || '-'}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Filial</p><p className="mt-1 font-semibold">{selectedResult.unitName || selectedResult.unitId || '-'}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Auditor</p><p className="mt-1 font-semibold">{selectedResult.sellerName || '-'}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Status</p><p className="mt-1 font-semibold">{selectedResult.resultStatus}</p></CardContent></Card>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Acuracidade</p><p className="mt-1 font-semibold">{formatPercent(selectedResult.accuracy)}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Itens</p><p className="mt-1 font-semibold">{selectedResult.totalItems}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Divergencias</p><p className="mt-1 font-semibold">{selectedResult.totalDivergences}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Disparo operacional</p><p className="mt-1 font-semibold break-all">{selectedResult.operationalAlertId || '-'}</p></CardContent></Card>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {(() => {
                  const times = getPayloadTimestamps(selectedResult.payload);
                  return (
                    <>
                      <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Iniciado em</p><p className="mt-1 font-semibold">{formatDateTime(times.createdAt)}</p></CardContent></Card>
                      <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Finalizado em</p><p className="mt-1 font-semibold">{formatDateTime(times.finishedAt ?? times.updatedAt)}</p></CardContent></Card>
                      <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Sincronizado em</p><p className="mt-1 font-semibold">{formatDateTime(selectedResult.finishedAt)}</p></CardContent></Card>
                    </>
                  );
                })()}
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-foreground">Itens contados</p>
                <div className="overflow-x-auto rounded-xl border border-border/60">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-4">Codigo</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead>Esperado</TableHead>
                        <TableHead>Contado</TableHead>
                        <TableHead>Diferenca</TableHead>
                        <TableHead className="pr-4">Justificativa</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const items = getPayloadItems(selectedResult.payload);
                        const divergenceMap = getPayloadDivergenceMap(selectedResult.payload);

                        if (items.length === 0) {
                          return (
                            <TableRow>
                              <TableCell colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                                Nenhum item detalhado disponivel para esta contagem.
                              </TableCell>
                            </TableRow>
                          );
                        }

                        return items.map((item, index) => {
                          const expected = Number(item.expectedQuantity ?? 0);
                          const counted = Number(item.countedQuantity ?? 0);
                          const difference = counted - expected;
                          const divergence = item.code ? divergenceMap.get(item.code) : undefined;

                          return (
                            <TableRow key={item.code ?? index}>
                              <TableCell className="pl-4 font-mono text-xs text-muted-foreground">{item.code || '-'}</TableCell>
                              <TableCell className="font-medium text-foreground">{item.name || '-'}</TableCell>
                              <TableCell>{expected}</TableCell>
                              <TableCell>{counted}</TableCell>
                              <TableCell>
                                {difference === 0 ? (
                                  <Badge variant="outline">0</Badge>
                                ) : (
                                  <Badge variant="destructive">{difference > 0 ? `+${difference}` : difference}</Badge>
                                )}
                              </TableCell>
                              <TableCell className="pr-4 text-sm text-muted-foreground">{divergence?.justification || '-'}</TableCell>
                            </TableRow>
                          );
                        });
                      })()}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => window.open(`${portalApiBaseUrl}/portal/audits/${selectedResult.sourceSessionId}/pdf`, '_blank', 'noopener,noreferrer')}
                  disabled={!selectedResult.sourceSessionId}
                >
                  Ver PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
