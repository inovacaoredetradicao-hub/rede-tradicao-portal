import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, Download, RefreshCcw, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getOperationalUnits } from '../operational-alerts/api';
import { OperationalUnitOption } from '../operational-alerts/types';
import { cancelUniformShipment, getUniformShipments, receiveUniformShipment } from './api';
import { UniformShipment, UniformShipmentStatus } from './types';

const STATUS_LABELS: Record<UniformShipmentStatus, string> = {
  em_transito: 'Em transito',
  recebido: 'Recebido',
  cancelado: 'Cancelado',
};

const STATUS_CLASSES: Record<UniformShipmentStatus, string> = {
  em_transito: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  recebido: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  cancelado: 'border-border bg-muted text-muted-foreground',
};

const formatDateTime = (value: string | null) => (value ? new Date(value).toLocaleString('pt-BR') : '-');
const toInputDate = (date: Date) => date.toISOString().slice(0, 10);

function daysSince(value: string) {
  return Math.floor((Date.now() - new Date(value).getTime()) / 86400000);
}

function exportCsv(rows: UniformShipment[]) {
  const header = [
    'Remessa',
    'Status',
    'Enviada em',
    'Enviada por',
    'Origem',
    'Destino',
    'Uniforme',
    'Tamanho',
    'Etiqueta',
    'Quantidade',
    'Recebida em',
    'Recebida por',
    'Confirmada via',
  ];
  const lines = [header];
  for (const row of rows) {
    for (const item of row.items) {
      lines.push([
        row.code,
        STATUS_LABELS[row.status],
        formatDateTime(row.createdAt),
        row.createdByName ?? '',
        row.fromUnitName,
        row.toUnitName,
        item.uniformName,
        item.uniformSize,
        item.tagId,
        String(item.quantity),
        formatDateTime(row.receivedAt),
        row.receivedByName ?? '',
        row.receivedVia === 'portal' ? 'Portal' : row.receivedVia === 'app' ? 'App' : '',
      ]);
    }
  }
  const csv = lines.map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `remessas-uniformes-${toInputDate(new Date())}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// Relatorio das remessas de uniformes: lote gerado (em transito), confirmado pela filial ou cancelado.
export const ShipmentsTab: React.FC = () => {
  const [rows, setRows] = useState<UniformShipment[]>([]);
  const [units, setUnits] = useState<OperationalUnitOption[]>([]);
  const [status, setStatus] = useState('');
  const [unitId, setUnitId] = useState('');
  const [from, setFrom] = useState(() => toInputDate(new Date(Date.now() - 30 * 86400000)));
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [receivingId, setReceivingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await getUniformShipments({ status, unitId, from, to }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel carregar as remessas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getOperationalUnits()
      .then(setUnits)
      .catch(() => setUnits([]));
  }, []);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, unitId, from, to]);

  const summary = useMemo(() => {
    const result = {
      em_transito: { count: 0, pieces: 0 },
      recebido: { count: 0, pieces: 0 },
      cancelado: { count: 0, pieces: 0 },
    };
    for (const row of rows) {
      result[row.status].count += 1;
      result[row.status].pieces += row.totalQuantity;
    }
    return result;
  }, [rows]);

  const handleReceive = async (row: UniformShipment) => {
    if (
      !window.confirm(
        `Confirmar o recebimento da remessa ${row.code}?\n\n${row.totalQuantity} peca(s) vao entrar no estoque de ${row.toUnitName}.`,
      )
    )
      return;
    setReceivingId(row.id);
    try {
      await receiveUniformShipment(row.id);
      toast.success(`Remessa ${row.code} recebida. ${row.totalQuantity} peca(s) no estoque de ${row.toUnitName}.`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel confirmar o recebimento.');
    } finally {
      setReceivingId(null);
    }
  };

  const handleCancel = async (row: UniformShipment) => {
    if (!window.confirm(`Cancelar a remessa ${row.code} para ${row.toUnitName}? As pecas voltam a ficar disponiveis no estoque de origem.`)) return;
    setCancellingId(row.id);
    try {
      await cancelUniformShipment(row.id);
      toast.success(`Remessa ${row.code} cancelada.`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel cancelar a remessa.');
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {(['em_transito', 'recebido', 'cancelado'] as UniformShipmentStatus[]).map((key) => (
          <Card key={key} className="border-border/60 shadow-sm">
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{STATUS_LABELS[key]}</p>
              <p className="text-3xl font-bold text-foreground">{summary[key].count}</p>
              <p className="text-xs text-muted-foreground">
                {summary[key].count === 1 ? 'remessa' : 'remessas'} · {summary[key].pieces} peca(s)
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/60 shadow-sm">
        <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="shipment-status">Status</Label>
            <select
              id="shipment-status"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm lg:w-48"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">Todos</option>
              <option value="em_transito">Em transito</option>
              <option value="recebido">Recebido</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="shipment-unit">Filial (origem ou destino)</Label>
            <select
              id="shipment-unit"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={unitId}
              onChange={(event) => setUnitId(event.target.value)}
            >
              <option value="">Todas as filiais</option>
              {[...units]
                .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
                .map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="shipment-from">Enviadas de</Label>
            <Input id="shipment-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="lg:w-40" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="shipment-to">ate</Label>
            <Input id="shipment-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} className="lg:w-40" />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => void load()} disabled={loading}>
              <RefreshCcw className="h-4 w-4" />
              Atualizar
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => exportCsv(rows)} disabled={!rows.length}>
              <Download className="h-4 w-4" />
              Exportar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">Remessas</CardTitle>
          <CardDescription>
            Lotes separados e enviados pelo RH. As pecas saem do estoque da matriz no envio e entram no estoque da filial quando o
            recebimento e confirmado (pelo app da filial ou aqui no portal). Se a remessa for cancelada, as pecas voltam para a origem.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-sm text-muted-foreground">Carregando...</div>
          ) : rows.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">Nenhuma remessa no periodo.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8 pl-6" />
                  <TableHead>Remessa</TableHead>
                  <TableHead>Enviada</TableHead>
                  <TableHead>Origem → Destino</TableHead>
                  <TableHead className="text-right">Pecas</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Recebimento</TableHead>
                  <TableHead className="pr-6 text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const isOpen = expanded === row.id;
                  const transitDays = row.status === 'em_transito' ? daysSince(row.createdAt) : 0;
                  return (
                    <React.Fragment key={row.id}>
                      <TableRow className="cursor-pointer" onClick={() => setExpanded(isOpen ? null : row.id)}>
                        <TableCell className="pl-6">
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </TableCell>
                        <TableCell className="font-mono font-semibold text-foreground">{row.code}</TableCell>
                        <TableCell className="text-sm">
                          <div>{formatDateTime(row.createdAt)}</div>
                          <div className="text-xs text-muted-foreground">{row.createdByName ?? '-'}</div>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="text-muted-foreground">{row.fromUnitName}</div>
                          <div className="font-medium text-foreground">→ {row.toUnitName}</div>
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{row.totalQuantity}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={STATUS_CLASSES[row.status]}>
                            {STATUS_LABELS[row.status]}
                          </Badge>
                          {row.status === 'em_transito' && transitDays > 0 ? (
                            <div className="mt-1 text-xs text-muted-foreground">ha {transitDays} dia(s)</div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-sm">
                          {row.status === 'recebido' ? (
                            <>
                              <div>{formatDateTime(row.receivedAt)}</div>
                              <div className="text-xs text-muted-foreground">
                                {row.receivedByName ?? '-'}
                                {row.receivedVia === 'portal' ? ' · pelo portal' : row.receivedVia === 'app' ? ' · pelo app' : ''}
                              </div>
                            </>
                          ) : row.status === 'cancelado' ? (
                            <>
                              <div>{formatDateTime(row.cancelledAt)}</div>
                              <div className="text-xs text-muted-foreground">cancelada por {row.cancelledByName ?? '-'}</div>
                            </>
                          ) : (
                            <span className="text-muted-foreground">Aguardando a filial</span>
                          )}
                        </TableCell>
                        <TableCell className="pr-6 text-right">
                          {row.status === 'em_transito' ? (
                            <div className="flex justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              disabled={receivingId === row.id || cancellingId === row.id}
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleReceive(row);
                              }}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              {receivingId === row.id ? 'Confirmando...' : 'Confirmar recebimento'}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1 text-destructive hover:text-destructive"
                              disabled={cancellingId === row.id}
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleCancel(row);
                              }}
                            >
                              <XCircle className="h-4 w-4" />
                              {cancellingId === row.id ? 'Cancelando...' : 'Cancelar'}
                            </Button>
                            </div>
                          ) : null}
                        </TableCell>
                      </TableRow>
                      {isOpen ? (
                        <TableRow className="bg-muted/20 hover:bg-muted/20">
                          <TableCell />
                          <TableCell colSpan={7} className="pr-6">
                            <div className="space-y-2 py-2">
                              {row.note ? <p className="text-sm text-muted-foreground">Observacao: {row.note}</p> : null}
                              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                {row.items.map((item) => (
                                  <div
                                    key={item.tagId}
                                    className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm"
                                  >
                                    <div>
                                      <div className="font-medium text-foreground">
                                        {item.uniformName} {item.uniformSize}
                                      </div>
                                      <div className="font-mono text-xs text-muted-foreground">{item.tagId}</div>
                                    </div>
                                    <Badge variant="outline">{item.quantity}</Badge>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
