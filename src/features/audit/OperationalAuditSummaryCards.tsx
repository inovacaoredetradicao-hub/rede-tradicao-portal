import React from 'react';
import { ClipboardList, PackageSearch, RotateCcw, ShieldCheck, TrendingUp, Undo2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PortalAuditDashboardSummary } from '@/types';

interface OperationalAuditSummaryCardsProps {
  loading: boolean;
  summary: PortalAuditDashboardSummary | null;
}

function formatPercentage(value: number) {
  return `${value.toFixed(1)}%`;
}

export const OperationalAuditSummaryCards: React.FC<OperationalAuditSummaryCardsProps> = ({ loading, summary }) => {
  const items = [
    {
      label: 'Auditorias',
      value: summary?.totalAudits ?? 0,
      icon: PackageSearch,
      tone: 'text-blue-600 bg-blue-500/10',
    },
    {
      label: 'Checklists',
      value: summary?.totalChecklists ?? 0,
      icon: ClipboardList,
      tone: 'text-emerald-600 bg-emerald-500/10',
    },
    {
      label: 'Devoluções',
      value: summary?.totalReturns ?? 0,
      icon: RotateCcw,
      tone: 'text-amber-600 bg-amber-500/10',
    },
    {
      label: 'Acuracidade média',
      value: formatPercentage(summary?.avgAuditAccuracy ?? 0),
      icon: TrendingUp,
      tone: 'text-violet-600 bg-violet-500/10',
    },
    {
      label: 'Score médio checklist',
      value: formatPercentage(summary?.avgChecklistScore ?? 0),
      icon: ShieldCheck,
      tone: 'text-cyan-600 bg-cyan-500/10',
    },
    {
      label: 'Itens devolvidos',
      value: summary?.totalReturnedItems ?? 0,
      icon: Undo2,
      tone: 'text-rose-600 bg-rose-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <Card key={item.label} className="border-border/60 shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${item.tone}`}>
              <item.icon className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{item.label}</p>
              {loading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <p className="text-3xl font-bold text-foreground">{item.value}</p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
