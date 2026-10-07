import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { OperationalCountAlert } from '@/features/operational-alerts/types';

interface OperationalCountAlertsTableProps {
  loading: boolean;
  alerts: OperationalCountAlert[];
}

function formatStatus(status: OperationalCountAlert['status']) {
  if (status === 'pendente') return 'Pendente';
  if (status === 'em_andamento') return 'Em andamento';
  if (status === 'concluido') return 'Concluido';
  return 'Vencido';
}

function statusVariant(status: OperationalCountAlert['status']) {
  if (status === 'pendente') return 'outline';
  if (status === 'em_andamento') return 'secondary';
  if (status === 'concluido') return 'default';
  return 'destructive';
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('pt-BR');
}

export const OperationalCountAlertsTable: React.FC<OperationalCountAlertsTableProps> = ({ loading, alerts }) => {
  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl">Alertas gerados</CardTitle>
        <CardDescription>Visao dos disparos entregues ao app mobile, com status e vinculo da auditoria quando houver.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-lg font-semibold text-foreground">Nenhum alerta gerado</p>
            <p className="mt-2 text-sm text-muted-foreground">Use o botao Disparar agora para testar a geracao de alertas operacionais.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Produto</TableHead>
                <TableHead>Filial</TableHead>
                <TableHead>Responsavel</TableHead>
                <TableHead>ScheduledAt</TableHead>
                <TableHead>DueAt</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-6">Auditoria vinculada</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alerts.map((alert) => (
                <TableRow key={alert.id}>
                  <TableCell className="pl-6 font-semibold text-foreground">{alert.productName}</TableCell>
                  <TableCell>{alert.unitName}</TableCell>
                  <TableCell>{alert.responsibleUserName || 'Nao definido'}</TableCell>
                  <TableCell>{formatDateTime(alert.scheduledAt)}</TableCell>
                  <TableCell>{formatDateTime(alert.dueAt)}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(alert.status)}>{formatStatus(alert.status)}</Badge>
                  </TableCell>
                  <TableCell className="pr-6">{alert.linkedAuditSessionId || 'Sem vinculo'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
