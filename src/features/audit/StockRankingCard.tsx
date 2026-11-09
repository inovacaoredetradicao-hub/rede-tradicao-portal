import React, { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StockRankingRow, getStockRanking } from '@/services/portalAuditApi';

// Ranking das filiais pela organizacao do estoque (fotos avaliadas como curva A, B ou C).

const PERIODS = [30, 90, 365] as const;
const TOP = 10;

const CURVE_CLASS: Record<string, string> = {
  A: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  B: 'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  C: 'border-rose-500/50 bg-rose-500/10 text-rose-700 dark:text-rose-400',
};

const score = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

export const StockRankingCard: React.FC = () => {
  const [days, setDays] = useState<number>(90);
  const [rows, setRows] = useState<StockRankingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    getStockRanking(days)
      .then((result) => active && setRows(result.rows))
      .catch((loadError) => active && setError(loadError instanceof Error ? loadError.message : 'Falha ao carregar o ranking.'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [days]);

  const visible = showAll ? rows : rows.slice(0, TOP);

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Trophy className="h-5 w-5 text-amber-500" aria-hidden />
            Ranking de organizacao do estoque
          </CardTitle>
          <CardDescription>
            Pontuacao de 0 a 100: media das fotos avaliadas (curva A = 100, B = 50, C = 0) nos ultimos {days} dias.
          </CardDescription>
        </div>
        <div className="flex gap-2">
          {PERIODS.map((period) => (
            <Button key={period} type="button" size="sm" variant={days === period ? 'default' : 'outline'} onClick={() => setDays(period)}>
              {period === 365 ? '12 meses' : `${period} dias`}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-sm text-rose-600">{error}</p>
        ) : loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma foto de estoque avaliada neste periodo. Solicite e avalie as fotos em Checklist &gt; Organizacao de estoque.
          </p>
        ) : (
          <div className="space-y-1">
            <div className="hidden grid-cols-[3rem_1fr_minmax(8rem,14rem)_9rem_5rem] gap-3 px-2 pb-1 text-xs uppercase text-muted-foreground md:grid">
              <span>Pos.</span>
              <span>Filial</span>
              <span>Pontuacao</span>
              <span>Curvas (A / B / C)</span>
              <span>Ultima</span>
            </div>
            {visible.map((row) => (
              <div
                key={row.unit_id}
                className="grid grid-cols-[3rem_1fr_5rem] items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/60 md:grid-cols-[3rem_1fr_minmax(8rem,14rem)_9rem_5rem]"
              >
                <span className={`text-lg font-bold tabular-nums ${row.position <= 3 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                  {row.position}º
                </span>
                <span className="truncate font-medium text-foreground" title={row.unit_name ?? row.unit_id}>
                  {row.unit_name ?? row.unit_id}
                  <span className="block text-xs font-normal text-muted-foreground">{row.evaluations} avaliacao(oes)</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="hidden h-2 flex-1 overflow-hidden rounded bg-muted md:block">
                    <span className="block h-full rounded" style={{ width: `${row.score}%`, background: 'var(--viz-series-1)' }} />
                  </span>
                  <span className="w-12 text-right font-semibold tabular-nums text-foreground">{score.format(row.score)}</span>
                </span>
                <span className="hidden tabular-nums text-sm text-muted-foreground md:block">
                  {row.count_a} / {row.count_b} / {row.count_c}
                </span>
                <span className="hidden md:block">
                  {row.last_rating ? (
                    <Badge variant="outline" className={CURVE_CLASS[row.last_rating]}>
                      {row.last_rating}
                    </Badge>
                  ) : (
                    '-'
                  )}
                </span>
              </div>
            ))}
            {rows.length > TOP && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowAll((value) => !value)}>
                {showAll ? 'Mostrar so as 10 primeiras' : `Ver todas as ${rows.length} filiais`}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
