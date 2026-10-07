import React from 'react';
import { Inbox } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PortalAuditUnitMetrics } from '@/types';

interface OperationalAuditUnitTableProps {
  loading: boolean;
  rows: PortalAuditUnitMetrics[];
}

function formatPercentage(value: number) {
  return `${value.toFixed(1)}%`;
}

export const OperationalAuditUnitTable: React.FC<OperationalAuditUnitTableProps> = ({ loading, rows }) => {
  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl">Visão Por Filial</CardTitle>
        <CardDescription>Indicadores consolidados por filial com base no backend do app de auditoria.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-muted-foreground">
              <Inbox className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-foreground">Nenhum dado disponível</p>
              <p className="text-sm text-muted-foreground">Quando o backend receber sessões finalizadas, os resultados por filial aparecerão aqui.</p>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Filial</TableHead>
                <TableHead>Auditorias</TableHead>
                <TableHead>Checklists</TableHead>
                <TableHead>Devoluções</TableHead>
                <TableHead>Acuracidade média</TableHead>
                <TableHead>Score médio</TableHead>
                <TableHead className="pr-6">Itens devolvidos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.unitId}>
                  <TableCell className="pl-6 font-semibold text-foreground">{row.unitName}</TableCell>
                  <TableCell>{row.totalAudits}</TableCell>
                  <TableCell>{row.totalChecklists}</TableCell>
                  <TableCell>{row.totalReturns}</TableCell>
                  <TableCell>{formatPercentage(row.avgAuditAccuracy)}</TableCell>
                  <TableCell>{formatPercentage(row.avgChecklistScore)}</TableCell>
                  <TableCell className="pr-6">{row.totalReturnedItems}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
