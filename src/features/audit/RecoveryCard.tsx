import React from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// Perda x recuperado: quanto se perdeu (vencidos/avariados) e quanto voltou com bonificacao.

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brlShort = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 });
const pct = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 });

const RECOVERED = { name: 'Recuperado (bonificacao)', color: 'var(--viz-recuperado)' };
const NOT_RECOVERED = { name: 'Nao recuperado', color: 'var(--viz-nao-recuperado)' };

export interface RecoveryMonth {
  label: string;
  recuperado: number;
  naoRecuperado: number;
}

const share = (part: number, total: number) => (total > 0 ? Math.min(part / total, 1) : 0);

// Uma linha: perda do tipo, barra dividida em recuperado / nao recuperado e os valores.
const RecoveryRow: React.FC<{ title: string; loss: number; recovered: number; strong?: boolean }> = ({ title, loss, recovered, strong }) => {
  const rec = Math.min(recovered, loss);
  const notRec = Math.max(loss - recovered, 0);
  const recShare = share(rec, loss);
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
        <span className={strong ? 'font-semibold text-foreground' : 'font-medium text-foreground'}>{title}</span>
        <span className="text-muted-foreground">
          Perda <span className="font-semibold tabular-nums text-foreground">{brl.format(loss)}</span>
          {' · '}Recuperado <span className="font-semibold tabular-nums text-foreground">{brl.format(rec)}</span> ({pct.format(recShare)})
          {' · '}Nao recuperado <span className="font-semibold tabular-nums text-foreground">{brl.format(notRec)}</span>
        </span>
      </div>
      <div
        className="flex h-3 w-full gap-[2px] overflow-hidden rounded bg-muted"
        role="img"
        aria-label={`${title}: ${pct.format(recShare)} recuperado`}
        title={`Recuperado ${brl.format(rec)} · Nao recuperado ${brl.format(notRec)}`}
      >
        {loss > 0 && rec > 0 && <div className="h-full rounded-l" style={{ width: `${recShare * 100}%`, background: RECOVERED.color }} />}
        {loss > 0 && notRec > 0 && <div className="h-full flex-1 rounded-r" style={{ background: NOT_RECOVERED.color }} />}
      </div>
    </div>
  );
};

const MonthTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as RecoveryMonth;
  const total = row.recuperado + row.naoRecuperado;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold text-foreground">{label}</p>
      <p className="text-muted-foreground">
        Perda: <span className="font-semibold text-foreground">{brl.format(total)}</span>
      </p>
      {[...payload].reverse().map((entry: any) => (
        <p key={entry.dataKey} className="flex items-center gap-2 text-muted-foreground">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: entry.color }} />
          {entry.name}: <span className="font-semibold text-foreground">{brl.format(entry.value ?? 0)}</span>
        </p>
      ))}
      {total > 0 && <p className="mt-1 text-muted-foreground">{pct.format(share(row.recuperado, total))} recuperado</p>}
    </div>
  );
};

export const RecoveryCard: React.FC<{
  year: string;
  vencido: { loss: number; recovered: number };
  avariado: { loss: number; recovered: number };
  monthly: RecoveryMonth[];
}> = ({ year, vencido, avariado, monthly }) => {
  const axisProps = { stroke: 'var(--viz-axis)', fontSize: 12, tickLine: false, axisLine: false } as const;
  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Perda x Recuperado com bonificacao</CardTitle>
        <CardDescription>Quanto foi perdido com vencidos e avariados em {year} e quanto voltou como bonificacao.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <RecoveryRow title="Vencidos" loss={vencido.loss} recovered={vencido.recovered} />
          <RecoveryRow title="Avariados" loss={avariado.loss} recovered={avariado.recovered} />
          <RecoveryRow
            title="Total"
            loss={vencido.loss + avariado.loss}
            recovered={vencido.recovered + avariado.recovered}
            strong
          />
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly} margin={{ top: 8, right: 16, bottom: 0, left: 8 }} barCategoryGap="30%">
              <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
              <XAxis dataKey="label" {...axisProps} tickFormatter={(value: string) => value.slice(0, 2)} />
              <YAxis {...axisProps} width={72} tickFormatter={(value: number) => brlShort.format(value)} />
              <Tooltip content={<MonthTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.6 }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="recuperado" name={RECOVERED.name} stackId="perda" fill={RECOVERED.color} stroke="var(--card)" strokeWidth={2} maxBarSize={28} />
              <Bar
                dataKey="naoRecuperado"
                name={NOT_RECOVERED.name}
                stackId="perda"
                fill={NOT_RECOVERED.color}
                stroke="var(--card)"
                strokeWidth={2}
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
