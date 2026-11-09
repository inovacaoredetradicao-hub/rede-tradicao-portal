import React, { useEffect, useMemo, useState } from 'react';
import { Camera, Eye, RefreshCcw, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  StockPhotoRequest,
  StockRating,
  cancelStockPhotoRequest,
  createStockPhotoRequests,
  evaluateStockPhotoRequest,
  getStockPhotoRequests,
  stockPhotoUrl,
} from '@/services/portalAuditApi';
import { getOperationalUnits } from '@/features/operational-alerts/api';
import { OperationalUnitOption } from '@/features/operational-alerts/types';

const STATUS_LABELS: Record<string, string> = {
  pendente: 'Aguardando foto',
  enviado: 'Aguardando avaliacao',
  avaliado: 'Avaliado',
};

const RATING_OPTIONS: { value: StockRating; label: string; className: string }[] = [
  { value: 'organizado', label: 'Organizado', className: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
  { value: 'parcial', label: 'Parcialmente organizado', className: 'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400' },
  { value: 'desorganizado', label: 'Desorganizado', className: 'border-rose-500/50 bg-rose-500/10 text-rose-700 dark:text-rose-400' },
];
const ratingOption = (rating: string | null) => RATING_OPTIONS.find((option) => option.value === rating);

function formatDateTime(value: string | null) {
  return value ? new Date(value).toLocaleString('pt-BR') : '-';
}

const isOverdue = (request: StockPhotoRequest) =>
  request.status === 'pendente' && request.due_at !== null && new Date(request.due_at).getTime() < Date.now();

// Organizacao de estoque: o portal solicita foto do estoque da filial, o app envia e aqui se avalia.
export const StockOrganizationPage: React.FC = () => {
  const [requests, setRequests] = useState<StockPhotoRequest[]>([]);
  const [units, setUnits] = useState<OperationalUnitOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [unitFilter, setUnitFilter] = useState('');

  // Nova solicitacao
  const [selectedUnits, setSelectedUnits] = useState<Set<string>>(new Set());
  const [unitSearch, setUnitSearch] = useState('');
  const [instructions, setInstructions] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [creating, setCreating] = useState(false);

  // Avaliacao
  const [selected, setSelected] = useState<StockPhotoRequest | null>(null);
  const [rating, setRating] = useState<StockRating | null>(null);
  const [evaluationNote, setEvaluationNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setRequests(await getStockPhotoRequests());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Falha ao carregar as solicitacoes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    getOperationalUnits()
      .then(setUnits)
      .catch(() => setUnits([]));
  }, []);

  const filteredUnits = useMemo(
    () => units.filter((unit) => unit.displayLabel.toLowerCase().includes(unitSearch.trim().toLowerCase())),
    [units, unitSearch],
  );

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    requests.forEach((request) => map.set(request.status, (map.get(request.status) ?? 0) + 1));
    return map;
  }, [requests]);

  const filtered = useMemo(
    () =>
      requests.filter(
        (request) =>
          (statusFilter === 'todos' || request.status === statusFilter) &&
          (!unitFilter ||
            `${request.unit_name ?? ''} ${request.unit_id}`.toLowerCase().includes(unitFilter.trim().toLowerCase())),
      ),
    [requests, statusFilter, unitFilter],
  );

  const toggleUnit = (unitId: string) =>
    setSelectedUnits((current) => {
      const next = new Set(current);
      if (next.has(unitId)) next.delete(unitId);
      else next.add(unitId);
      return next;
    });

  const createRequests = async () => {
    if (!selectedUnits.size) {
      toast.error('Escolha ao menos uma filial.');
      return;
    }
    setCreating(true);
    try {
      const result = await createStockPhotoRequests({
        unitIds: [...selectedUnits],
        instructions: instructions.trim() || undefined,
        dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
      });
      toast.success(result.created === 1 ? 'Foto solicitada para 1 filial.' : `Foto solicitada para ${result.created} filiais.`);
      setSelectedUnits(new Set());
      setInstructions('');
      setDueAt('');
      await load();
    } catch (createError) {
      toast.error(createError instanceof Error ? createError.message : 'Nao foi possivel solicitar a foto.');
    } finally {
      setCreating(false);
    }
  };

  const openRequest = (request: StockPhotoRequest) => {
    setSelected(request);
    setRating(request.rating);
    setEvaluationNote(request.evaluation_note ?? '');
  };

  const saveEvaluation = async () => {
    if (!selected || !rating) {
      toast.error('Escolha a avaliacao.');
      return;
    }
    setSaving(true);
    try {
      await evaluateStockPhotoRequest(selected.id, rating, evaluationNote);
      toast.success('Avaliacao salva.');
      setSelected(null);
      await load();
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : 'Nao foi possivel salvar a avaliacao.');
    } finally {
      setSaving(false);
    }
  };

  const cancelRequest = async (request: StockPhotoRequest) => {
    if (!window.confirm(`Cancelar a solicitacao de foto para ${request.unit_name ?? request.unit_id}?`)) return;
    try {
      await cancelStockPhotoRequest(request.id);
      toast.success('Solicitacao cancelada.');
      await load();
    } catch (cancelError) {
      toast.error(cancelError instanceof Error ? cancelError.message : 'Nao foi possivel cancelar.');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" aria-hidden />
            Solicitar foto do estoque
          </CardTitle>
          <CardDescription>A solicitacao aparece no app, em Checklist &gt; Organizacao de estoque, para a filial tirar e enviar as fotos.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Filiais ({selectedUnits.size} selecionada(s))</p>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedUnits(new Set(filteredUnits.map((unit) => unit.id)))}>
                  Marcar todas
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedUnits(new Set())}>
                  Limpar
                </Button>
              </div>
            </div>
            <Input value={unitSearch} onChange={(event) => setUnitSearch(event.target.value)} placeholder="Buscar filial" />
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-2">
              {filteredUnits.length === 0 ? (
                <p className="p-2 text-sm text-muted-foreground">Nenhuma filial encontrada.</p>
              ) : (
                filteredUnits.map((unit) => (
                  <label key={unit.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted">
                    <input type="checkbox" className="h-4 w-4 accent-primary" checked={selectedUnits.has(unit.id)} onChange={() => toggleUnit(unit.id)} />
                    {unit.displayLabel}
                  </label>
                ))
              )}
            </div>
          </div>
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-medium">O que fotografar (opcional)</p>
              <Textarea
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
                placeholder="Ex.: foto geral do deposito e das prateleiras de bebidas"
                rows={4}
              />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Prazo (opcional)</p>
              <Input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
            </div>
            <Button type="button" onClick={() => void createRequests()} disabled={creating || !selectedUnits.size}>
              <Send className="mr-2 h-4 w-4" aria-hidden />
              {creating ? 'Solicitando...' : 'Solicitar foto'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Solicitacoes</CardTitle>
            <CardDescription>Acompanhe as fotos pedidas e avalie a organizacao de cada filial.</CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCcw className="mr-2 h-4 w-4" aria-hidden />
            Atualizar
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {(['todos', 'pendente', 'enviado', 'avaliado'] as const).map((status) => (
              <Button
                key={status}
                type="button"
                size="sm"
                variant={statusFilter === status ? 'default' : 'outline'}
                onClick={() => setStatusFilter(status)}
              >
                {status === 'todos' ? `Todas (${requests.length})` : `${STATUS_LABELS[status]} (${counts.get(status) ?? 0})`}
              </Button>
            ))}
            <Input className="ml-auto max-w-xs" value={unitFilter} onChange={(event) => setUnitFilter(event.target.value)} placeholder="Filtrar por filial" />
          </div>

          {error && <p className="text-sm text-rose-600">{error}</p>}
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma solicitacao.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Filial</TableHead>
                    <TableHead>Solicitado</TableHead>
                    <TableHead>Prazo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Avaliacao</TableHead>
                    <TableHead className="text-right">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((request) => {
                    const option = ratingOption(request.rating);
                    return (
                      <TableRow key={request.id}>
                        <TableCell className="font-medium text-foreground">{request.unit_name ?? request.unit_id}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatDateTime(request.requested_at)}
                          {request.requested_by_name && <span className="block text-xs text-muted-foreground">por {request.requested_by_name}</span>}
                        </TableCell>
                        <TableCell className={`whitespace-nowrap ${isOverdue(request) ? 'font-semibold text-rose-600' : ''}`}>
                          {formatDateTime(request.due_at)}
                          {isOverdue(request) && <span className="block text-xs">atrasado</span>}
                        </TableCell>
                        <TableCell>
                          <Badge variant={request.status === 'enviado' ? 'default' : 'outline'}>{STATUS_LABELS[request.status] ?? request.status}</Badge>
                        </TableCell>
                        <TableCell>
                          {option ? (
                            <Badge variant="outline" className={option.className}>
                              {option.label}
                            </Badge>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {request.status === 'pendente' ? (
                              <Button variant="outline" size="icon" onClick={() => void cancelRequest(request)} title="Cancelar solicitacao">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button
                                variant={request.status === 'enviado' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => openRequest(request)}
                              >
                                <Eye className="mr-1.5 h-4 w-4" aria-hidden />
                                {request.status === 'enviado' ? 'Avaliar' : 'Ver'}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Estoque - {selected?.unit_name ?? selected?.unit_id}</DialogTitle>
            <DialogDescription>
              Enviado em {formatDateTime(selected?.sent_at ?? null)}
              {selected?.sent_by_name ? ` por ${selected.sent_by_name}` : ''}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              {selected.instructions && (
                <p className="text-sm">
                  <span className="text-muted-foreground">Pedido: </span>
                  {selected.instructions}
                </p>
              )}
              {selected.sent_note && (
                <p className="text-sm">
                  <span className="text-muted-foreground">Observacao da filial: </span>
                  {selected.sent_note}
                </p>
              )}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {Array.from({ length: selected.photo_count }, (_, position) => (
                  <a key={position} href={stockPhotoUrl(selected.id, position)} target="_blank" rel="noreferrer" title="Abrir foto em tamanho real">
                    <img
                      src={stockPhotoUrl(selected.id, position)}
                      alt={`Foto ${position + 1} do estoque`}
                      className="aspect-square w-full rounded-lg border object-cover"
                    />
                  </a>
                ))}
              </div>

              <div className="space-y-2 rounded-lg border p-4">
                <p className="text-sm font-medium">Avaliacao da organizacao</p>
                <div className="flex flex-wrap gap-2">
                  {RATING_OPTIONS.map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      variant="outline"
                      className={rating === option.value ? `${option.className} ring-2 ring-offset-1 ring-current` : undefined}
                      onClick={() => setRating(option.value)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
                <Textarea
                  value={evaluationNote}
                  onChange={(event) => setEvaluationNote(event.target.value)}
                  placeholder="Comentario para a filial (opcional): o que esta bom e o que melhorar"
                  rows={3}
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    {selected.evaluated_at ? `Avaliado em ${formatDateTime(selected.evaluated_at)} por ${selected.evaluated_by_name ?? '-'}` : 'A filial ve a avaliacao no app.'}
                  </span>
                  <Button type="button" onClick={() => void saveEvaluation()} disabled={saving || !rating}>
                    {saving ? 'Salvando...' : 'Salvar avaliacao'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
