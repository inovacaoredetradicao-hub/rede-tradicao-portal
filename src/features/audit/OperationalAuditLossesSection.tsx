import React from 'react';
import { PackageMinus, PackagePlus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PortalAuditUnitLosses } from '@/types';

interface OperationalAuditLossesSectionProps {
  loading: boolean;
  topShortageUnits: PortalAuditUnitLosses[];
  topSurplusUnits: PortalAuditUnitLosses[];
}

function RankingList({
  rows,
  emptyLabel,
  quantityKey,
  itemsKey,
  tone,
}: {
  rows: PortalAuditUnitLosses[];
  emptyLabel: string;
  quantityKey: 'shortageQty' | 'surplusQty';
  itemsKey: 'shortageItems' | 'surplusItems';
  tone: 'rose' | 'amber';
}) {
  if (rows.length === 0) {
    return <p className="px-6 py-8 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  const toneClasses = tone === 'rose' ? 'bg-rose-500/10 text-rose-600' : 'bg-amber-500/10 text-amber-600';

  return (
    <div className="divide-y divide-border/60">
      {rows.map((row, index) => (
        <div key={row.unitId} className="flex items-center justify-between gap-3 px-6 py-3">
          <div className="flex items-center gap-3">
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${toneClasses}`}>
              {index + 1}
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">{row.unitName}</p>
              <p className="text-xs text-muted-foreground">{row[itemsKey]} item(ns) com divergencia</p>
            </div>
          </div>
          <p className={`text-lg font-bold ${tone === 'rose' ? 'text-rose-600' : 'text-amber-600'}`}>
            {row[quantityKey]}
          </p>
        </div>
      ))}
    </div>
  );
}

export const OperationalAuditLossesSection: React.FC<OperationalAuditLossesSectionProps> = ({
  loading,
  topShortageUnits,
  topSurplusUnits,
}) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {[0, 1].map((key) => (
          <Card key={key} className="border-border/60 shadow-sm">
            <CardHeader>
              <Skeleton className="h-5 w-48" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card className="border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <PackageMinus className="h-5 w-5 text-rose-600" />
            Top filiais - mais perdas (falta)
          </CardTitle>
          <CardDescription>Ranking por quantidade de itens faltando nas contagens do app.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <RankingList
            rows={topShortageUnits}
            emptyLabel="Nenhuma falta registrada ate agora."
            quantityKey="shortageQty"
            itemsKey="shortageItems"
            tone="rose"
          />
        </CardContent>
      </Card>

      <Card className="border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <PackagePlus className="h-5 w-5 text-amber-600" />
            Top filiais - mais sobras
          </CardTitle>
          <CardDescription>Ranking por quantidade de itens a mais nas contagens do app.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <RankingList
            rows={topSurplusUnits}
            emptyLabel="Nenhuma sobra registrada ate agora."
            quantityKey="surplusQty"
            itemsKey="surplusItems"
            tone="amber"
          />
        </CardContent>
      </Card>
    </div>
  );
};
