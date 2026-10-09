import React, { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { OperationalCountAlert } from '@/features/operational-alerts/types';

interface OperationalCountAlertsTableProps {
  loading: boolean;
  alerts: OperationalCountAlert[];
  onCancel: (alertId: string) => Promise<void>;
}

function formatStatus(status: OperationalCountAlert['status']) {
  if (status === 'pendente') return 'Pendente';
  if (status === 'em_andamento') return 'Em andamento';
  if (status === 'concluido') return 'Concluido';
  if (status === 'cancelado') return 'Excluido';
  return 'Vencido';
}

function statusVariant(status: OperationalCountAlert['status']) {
  if (status === 'pendente') return 'outline';
  if (status === 'em_andamento') return 'secondary';
  if (status === 'concluido') return 'default';
  if (status === 'cancelado') return 'outline';
  return 'destructive';
}

// O app lista apenas avisos 'pendente'. 'em_andamento' = a filial ja abriu a contagem.
function appVisibility(status: OperationalCountAlert['status']) {
  if (status === 'pendente') return { label: 'Aparece no app', tone: 'text-emerald-600', dot: 'bg-emerald-500' };
  if (status === 'em_andamento') return { label: 'Em contagem no app', tone: 'text-amber-600', dot: 'bg-amber-500' };
  return { label: 'Nao aparece', tone: 'text-muted-foreground', dot: 'bg-muted-foreground/40' };
}

const isOpen = (status: OperationalCountAlert['status']) => status === 'pendente' || status === 'em_andamento';

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export const OperationalCountAlertsTable: React.FC<OperationalCountAlertsTableProps> = ({ loading, alerts, onCancel }) => {
  const [view, setView] = useState<'app' | 'todos'>('app');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);

  const openCount = useMemo(() => alerts.filter((alert) => isOpen(alert.status)).length, [alerts]);
  const visibleAlerts = useMemo(
    () => (view === 'app' ? alerts.filter((alert) => isOpen(alert.status)) : alerts),
    [alerts, view],
  );

  const handleCancel = async (alert: OperationalCountAlert) => {
    const confirmed = window.confirm(
      `Excluir o aviso "${alert.title}" da filial ${alert.unitName}?\n\nEle sai do aplicativo na hora e fica no historico como "Excluido".`,
    );
    if (!confirmed) return;
    setCancelingId(alert.id);
    try {
      await onCancel(alert.id);
    } finally {
      setCancelingId(null);
    }
  };

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="gap-3">
        <div>
          <CardTitle className="text-xl">Avisos gerados</CardTitle>
          <CardDescription>
            O app mostra so os avisos <strong>pendentes</strong>. Excluir um aviso tira ele do app na hora (fica no historico como
            Excluido).
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant={view === 'app' ? 'default' : 'outline'} onClick={() => setView('app')}>
            No app agora ({openCount})
          </Button>
          <Button type="button" size="sm" variant={view === 'todos' ? 'default' : 'outline'} onClick={() => setView('todos')}>
            Todos ({alerts.length})
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : visibleAlerts.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-lg font-semibold text-foreground">
              {view === 'app' ? 'Nenhum aviso aparecendo no app agora' : 'Nenhum aviso gerado'}
            </p>
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Aviso</TableHead>
                  <TableHead>Filial</TableHead>
                  <TableHead>Responsavel</TableHead>
                  <TableHead>Gerado em</TableHead>
                  <TableHead>Prazo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>No app</TableHead>
                  <TableHead className="pr-6 text-right">Acao</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleAlerts.map((alert) => {
                  const visibility = appVisibility(alert.status);
                  const expanded = expandedId === alert.id;
                  return (
                    <React.Fragment key={alert.id}>
                      <TableRow>
                        <TableCell className="max-w-64 pl-6">
                          <p className="truncate font-semibold text-foreground" title={alert.title}>
                            {alert.title}
                          </p>
                          <button
                            type="button"
                            className="text-xs text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-primary"
                            onClick={() => setExpandedId(expanded ? null : alert.id)}
                          >
                            {expanded ? 'ocultar produtos' : `${alert.items.length} produto(s)`}
                          </button>
                        </TableCell>
                        <TableCell className="max-w-48 truncate">{alert.unitName}</TableCell>
                        <TableCell>{alert.responsibleUserName || 'Qualquer usuario da filial'}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{formatDateTime(alert.scheduledAt)}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{formatDateTime(alert.dueAt)}</TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(alert.status)}>{formatStatus(alert.status)}</Badge>
                        </TableCell>
                        <TableCell>
                          <span className={`flex items-center gap-1.5 whitespace-nowrap text-xs ${visibility.tone}`}>
                            <span className={`h-2 w-2 rounded-full ${visibility.dot}`} />
                            {visibility.label}
                          </span>
                        </TableCell>
                        <TableCell className="pr-6 text-right">
                          {isOpen(alert.status) && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="text-rose-600"
                              disabled={cancelingId === alert.id}
                              onClick={() => void handleCancel(alert)}
                              title="Excluir aviso (sai do app)"
                            >
                              <Trash2 className="mr-1 h-3.5 w-3.5" />
                              {cancelingId === alert.id ? 'Excluindo...' : 'Excluir'}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                      {expanded && (
                        <TableRow>
                          <TableCell colSpan={8} className="bg-muted/20 px-6 py-2">
                            <div className="max-h-48 overflow-y-auto">
                              {alert.items.map((item, index) => (
                                <div key={`${item.productId}-${index}`} className="flex gap-3 py-0.5 text-xs">
                                  <span className="flex-1 truncate text-foreground">{item.productName}</span>
                                  <span className="font-mono text-muted-foreground">{item.barcode}</span>
                                </div>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
