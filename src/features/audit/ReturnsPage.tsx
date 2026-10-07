import React, { useEffect, useMemo, useState } from 'react';
import { Eye, RefreshCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getPortalReturnDetail, getPortalReturns } from '@/services/portalAuditApi';
import { PortalReturnDetail, PortalReturnSummary } from '@/types';

const REASON_LABELS: Record<string, string> = {
  vencidos_ou_avarias: 'Vencidos ou avarias',
  excesso_mercadoria: 'Excesso de mercadoria',
};

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
    if (!search) return returns;
    return returns.filter((item) => item.seller_name.toLowerCase().includes(search));
  }, [returns, sellerSearch]);

  const summary = useMemo(() => {
    const total = returns.length;
    const totalItems = returns.reduce((sum, item) => sum + item.total_items, 0);
    const totalQuantity = returns.reduce((sum, item) => sum + Number(item.total_quantity), 0);
    return { total, totalItems, totalQuantity };
  }, [returns]);

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Devolucoes</h2>
          <p className="text-muted-foreground">Devolucoes de mercadoria finalizadas e enviadas pelo app.</p>
        </div>
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
        <CardContent className="p-5">
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
                  items.map((item: any, index: number) => (
                    <div key={index} className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-3 text-sm">
                      <div>
                        <p className="font-medium text-foreground">{item.name}</p>
                        <p className="text-muted-foreground">Cod {item.code}</p>
                      </div>
                      <Badge variant="outline">Qtd {item.quantity}</Badge>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};
