import React, { useEffect, useMemo, useState } from 'react';
import { Eye, RefreshCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getPortalAuditApiBaseUrl, getPortalReturnDetail, getPortalReturns } from '@/services/portalAuditApi';
import { withTokenQuery } from '@/lib/session';
import { LossDashboard } from './LossDashboard';
import { PortalReturnDetail, PortalReturnSummary } from '@/types';

// "vencidos_ou_avarias" e o motivo antigo, de antes de separar avariados e vencidos.
const REASON_LABELS: Record<string, string> = {
  avariados: 'Avariados',
  vencidos: 'Vencidos',
  excesso_mercadoria: 'Excesso de mercadoria',
  vencidos_ou_avarias: 'Vencidos ou avarias (antigo)',
};

const REASON_FILTERS = ['avariados', 'vencidos', 'excesso_mercadoria', 'vencidos_ou_avarias'] as const;

// Foto de um item: o app envia junto com a devolucao; o servidor entrega por esta rota.
function returnPhotoUrl(sourceSessionId: string, itemId: string) {
  return withTokenQuery(
    `${getPortalAuditApiBaseUrl()}/portal/returns/${encodeURIComponent(sourceSessionId)}/items/${encodeURIComponent(itemId)}/photo`,
  );
}

function formatDateTime(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('pt-BR');
}

export const ReturnsPage: React.FC = () => {
  const [returns, setReturns] = useState<PortalReturnSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sellerSearch, setSellerSearch] = useState('');
  const [selected, setSelected] = useState<PortalReturnDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [reasonFilter, setReasonFilter] = useState<string>('todos');
  const [zoomPhoto, setZoomPhoto] = useState<{ url: string; name: string } | null>(null);
  const [view, setView] = useState<'perdas' | 'devolucoes'>('perdas');

  const load = async () => {
    setLoading(true);
    setError(null);

    try {
      setReturns(await getPortalReturns());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel carregar as devolucoes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const search = sellerSearch.trim().toLowerCase();
    return returns.filter(
      (item) =>
        (reasonFilter === 'todos' || item.reason === reasonFilter) &&
        (!search || item.seller_name.toLowerCase().includes(search)),
    );
  }, [returns, sellerSearch, reasonFilter]);

  const countByReason = useMemo(() => {
    const counts = new Map<string, number>();
    returns.forEach((item) => counts.set(item.reason, (counts.get(item.reason) ?? 0) + 1));
    return counts;
  }, [returns]);

  // Cartoes seguem o filtro de motivo (ex.: so Avariados).
  const summary = useMemo(() => {
    const total = filtered.length;
    const totalItems = filtered.reduce((sum, item) => sum + item.total_items, 0);
    const totalQuantity = filtered.reduce((sum, item) => sum + Number(item.total_quantity), 0);
    return { total, totalItems, totalQuantity };
  }, [filtered]);

  const openDetail = async (sourceSessionId: string) => {
    setLoadingDetail(true);
    try {
      setSelected(await getPortalReturnDetail(sourceSessionId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel carregar a devolucao.');
    } finally {
      setLoadingDetail(false);
    }
  };

  const items = (selected?.payload as any)?.items ?? [];

  const header = (
    <div className="space-y-4">
      <div>
        <h2 className="text-3xl font-bold text-foreground">Devolucoes e perdas</h2>
        <p className="text-muted-foreground">Vencidos, avariados e devolucoes de mercadoria enviadas pelo app.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant={view === 'perdas' ? 'default' : 'outline'} onClick={() => setView('perdas')}>
          Painel de perdas
        </Button>
        <Button type="button" variant={view === 'devolucoes' ? 'default' : 'outline'} onClick={() => setView('devolucoes')}>
          Devolucoes recebidas
        </Button>
      </div>
    </div>
  );

  if (view === 'perdas') {
    return (
      <div className="space-y-6">
        {header}
        <LossDashboard />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}
      <div className="flex justify-end">
        <Button variant="outline" className="gap-2" onClick={() => void load()} disabled={loading}>
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
        <Card><CardContent className="p-5"><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Total de devolucoes</p><p className="mt-2 text-3xl font-bold text-foreground">{loading ? '...' : summary.total}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Itens devolvidos</p><p className="mt-2 text-3xl font-bold text-foreground">{loading ? '...' : summary.totalItems}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Quantidade total</p><p className="mt-2 text-3xl font-bold text-foreground">{loading ? '...' : summary.totalQuantity}</p></CardContent></Card>
      </div>

      <Card className="border-border/60 shadow-sm">
        <CardContent className="space-y-3 p-5">
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant={reasonFilter === 'todos' ? 'default' : 'outline'} onClick={() => setReasonFilter('todos')}>
              Todos ({returns.length})
            </Button>
            {REASON_FILTERS.filter((reason) => reason !== 'vencidos_ou_avarias' || countByReason.has(reason)).map((reason) => (
              <Button
                key={reason}
                type="button"
                size="sm"
                variant={reasonFilter === reason ? 'default' : 'outline'}
                onClick={() => setReasonFilter(reason)}
              >
                {REASON_LABELS[reason]} ({countByReason.get(reason) ?? 0})
              </Button>
            ))}
          </div>
          <Input placeholder="Filtrar por auditor" value={sellerSearch} onChange={(event) => setSellerSearch(event.target.value)} />
        </CardContent>
      </Card>

      <Card className="border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">Devolucoes recebidas</CardTitle>
          <CardDescription>Abra o detalhe para ver os itens devolvidos e as fotos anexadas.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-sm text-muted-foreground">Carregando devolucoes...</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">Nenhuma devolucao foi recebida ainda.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Auditor</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Quando</TableHead>
                  <TableHead>Itens</TableHead>
                  <TableHead className="pr-6 text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="pl-6 font-medium text-foreground">{item.seller_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{REASON_LABELS[item.reason] ?? item.reason}</Badge>
                    </TableCell>
                    <TableCell>{formatDateTime(item.finished_at)}</TableCell>
                    <TableCell>{item.total_items} ({item.total_quantity})</TableCell>
                    <TableCell className="pr-6 text-right">
                      <Button variant="outline" size="icon" onClick={() => void openDetail(item.source_session_id)} title="Ver devolucao">
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
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Devolucao</DialogTitle>
            <DialogDescription>Itens devolvidos nesta sessao.</DialogDescription>
          </DialogHeader>

          {loadingDetail ? (
            <div className="p-6 text-sm text-muted-foreground">Carregando...</div>
          ) : selected ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Auditor</p><p className="mt-1 font-semibold">{selected.seller_name}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Motivo</p><p className="mt-1 font-semibold">{REASON_LABELS[selected.reason] ?? selected.reason}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Total</p><p className="mt-1 font-semibold">{selected.total_items} itens</p></CardContent></Card>
              </div>

              <div className="space-y-2">
                {items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum item registrado.</p>
                ) : (
                  items.map((item: any, index: number) => {
                    const photoUrl = item.hasPhoto && item.id ? returnPhotoUrl(selected.source_session_id, String(item.id)) : null;
                    return (
                      <div key={index} className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-3 text-sm">
                        {photoUrl ? (
                          <button
                            type="button"
                            onClick={() => setZoomPhoto({ url: photoUrl, name: item.name })}
                            className="shrink-0 overflow-hidden rounded-md border border-border"
                            title="Ver foto"
                          >
                            <img src={photoUrl} alt={item.name} className="h-16 w-16 object-cover" loading="lazy" />
                          </button>
                        ) : (
                          <div
                            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-dashed border-border text-center text-[10px] text-muted-foreground"
                            title="Devolucoes enviadas antes desta versao do app nao trazem a foto"
                          >
                            sem foto
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-foreground">{item.name}</p>
                          <p className="text-muted-foreground">Cod {item.code}</p>
                          {(item.lot || item.expiresAt) && (
                            <p className="text-xs text-muted-foreground">
                              {[item.lot && `Lote ${item.lot}`, item.expiresAt && `Val ${String(item.expiresAt).split('-').reverse().join('/')}`, item.curve && `Curva ${item.curve}`]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                          )}
                        </div>
                        <Badge variant="outline">Qtd {item.quantity}</Badge>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!zoomPhoto} onOpenChange={(open) => !open && setZoomPhoto(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{zoomPhoto?.name}</DialogTitle>
            <DialogDescription>Foto tirada no app na hora da devolucao.</DialogDescription>
          </DialogHeader>
          {zoomPhoto && (
            <div className="space-y-3">
              <img src={zoomPhoto.url} alt={zoomPhoto.name} className="max-h-[70vh] w-full rounded-lg object-contain" />
              <a href={zoomPhoto.url} target="_blank" rel="noreferrer" className="text-sm text-primary underline">
                Abrir em tamanho original
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
