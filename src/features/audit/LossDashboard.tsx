import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ImageIcon, RefreshCcw } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getOperationalUnits } from '@/features/operational-alerts/api';
import { LossBreakdownRow, LossDashboard as LossDashboardData, LossItem, getLossDashboard, getLossItems } from '@/services/portalAuditApi';

// Painel de perdas (vencidos e avariados) montado a partir das devolucoes do app.

const CURVE_LABELS: Record<string, string> = { A: 'Curva A', B: 'Curva B', C: 'Curva C' };
const PROMOTION_LABELS: Record<string, string> = { true: 'Sim', false: 'Nao' };
const ORIGIN_LABELS: Record<string, string> = { cd_logistica: 'CD / Logistica', fornecedor_externo: 'Fornecedor externo' };
const LOSS_TYPE_LABELS: Record<string, string> = { vencido: 'Vencido', avariado: 'Avariado' };
const LOSS_REASON_LABELS: Record<string, string> = {
  falha_equipamento: 'Falha de equipamento',
  armazenamento_inadequado: 'Armazenamento inadequado',
  avaria_manuseio: 'Avaria no manuseio',
  avaria_recebimento: 'Avaria no recebimento',
  recebido_proximo_vencimento: 'Recebido proximo ao vencimento',
  falha_controle_validade: 'Falha no controle de validade',
  excesso_estoque: 'Excesso de estoque',
  baixo_giro: 'Baixo giro',
};
const NOT_INFORMED = 'Nao informado';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brlShort = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 });
const qty = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 });

function label(map: Record<string, string>, key: string | null | undefined) {
  if (!key || key === 'nao_informado') return NOT_INFORMED;
  return map[key] ?? key;
}

function toBrDate(value: string | null) {
  if (!value) return '-';
  const [y, m, d] = value.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

const StatTile: React.FC<{ title: string; value: string; hint?: string; tone?: 'warning'; loading: boolean }> = ({
  title,
  value,
  hint,
  tone,
  loading,
}) => (
  <Card className={tone === 'warning' ? 'border-amber-500/40 bg-amber-500/5' : undefined}>
    <CardContent className="p-5">
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        {tone === 'warning' && <AlertTriangle className="h-3.5 w-3.5 text-amber-600" aria-hidden />}
        {title}
      </p>
      <p className="mt-2 text-2xl font-bold text-foreground">{loading ? '...' : value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </CardContent>
  </Card>
);

// Barras horizontais de participacao (% do valor perdido), com o valor escrito ao lado.
const ShareBars: React.FC<{
  rows: LossBreakdownRow[];
  labels: Record<string, string>;
  order?: string[];
  colorFor?: (key: string) => string;
}> = ({ rows, labels, order, colorFor }) => {
  const total = rows.reduce((sum, row) => sum + row.total_cost, 0);
  const sorted = order
    ? [...rows].sort((a, b) => {
        const ia = order.indexOf(a.key);
        const ib = order.indexOf(b.key);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      })
    : rows;

  if (rows.length === 0 || total <= 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Sem perdas no periodo.</p>;
  }

  return (
    <ul className="space-y-3">
      {sorted.map((row) => {
        const share = row.total_cost / total;
        const muted = row.key === 'nao_informado';
        return (
          <li
            key={row.key}
            className="group"
            title={`${label(labels, row.key)}: ${brl.format(row.total_cost)} · ${qty.format(row.quantity)} un. · ${row.items} lancamento(s)`}
          >
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className={muted ? 'text-muted-foreground' : 'text-foreground'}>{label(labels, row.key)}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                <span className="font-semibold text-foreground">{(share * 100).toFixed(1).replace('.', ',')}%</span> · {brl.format(row.total_cost)}
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-muted">
              <div
                className="h-2.5 rounded-full transition-opacity group-hover:opacity-80"
                style={{
                  width: `${Math.max(share * 100, 1)}%`,
                  background: muted ? 'var(--viz-axis)' : colorFor?.(row.key) ?? 'var(--viz-series-1)',
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
};

const lossTypeColor = (key: string) => (key === 'vencido' ? 'var(--viz-vencido)' : key === 'avariado' ? 'var(--viz-avariado)' : 'var(--viz-series-1)');

const ChartTooltip: React.FC<any> = ({ active, payload, label: month }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold text-foreground">{month}</p>
      {payload.map((entry: any) => (
        <p key={entry.dataKey} className="flex items-center gap-2 text-muted-foreground">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: entry.color }} />
          {entry.name}: <span className="font-semibold text-foreground">{brl.format(entry.value ?? 0)}</span>
        </p>
      ))}
    </div>
  );
};

const axisProps = { stroke: 'var(--viz-axis)', fontSize: 12, tickLine: false, axisLine: false } as const;

export const LossDashboard: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const [units, setUnits] = useState<{ id: string; name: string }[]>([]);
  const [unitId, setUnitId] = useState('all');
  const [year, setYear] = useState(String(currentYear));
  const [data, setData] = useState<LossDashboardData | null>(null);
  const [items, setItems] = useState<LossItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('todos');

  useEffect(() => {
    getOperationalUnits()
      .then((list) => setUnits(list.map((unit: any) => ({ id: String(unit.id), name: String(unit.name) }))))
      .catch(() => undefined);
  }, []);

  const load = async () => {
    setLoading(true);
    setError(null);
    const filters = { unitId: unitId === 'all' ? undefined : unitId, year };
    try {
      const [dashboard, list] = await Promise.all([getLossDashboard(filters), getLossItems(filters)]);
      setData(dashboard);
      setItems(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel carregar o painel de perdas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitId, year]);

  // Os 12 meses do ano aparecem sempre, mesmo sem perda (linha em zero).
  const monthly = useMemo(() => {
    const byMonth = new Map((data?.monthly ?? []).map((row) => [row.month, row]));
    return Array.from({ length: 12 }, (_, index) => {
      const row = byMonth.get(index + 1);
      return {
        label: `${String(index + 1).padStart(2, '0')}-${year}`,
        total: row?.total_cost ?? 0,
        vencido: row?.vencidos_cost ?? 0,
        avariado: row?.avariados_cost ?? 0,
      };
    });
  }, [data, year]);

  // Lote repetido: mesmo produto + lote em mais de uma devolucao (destaca na tabela).
  const repeatedLotKeys = useMemo(() => {
    const sessions = new Map<string, Set<string>>();
    items.forEach((item) => {
      if (!item.lot) return;
      const key = `${item.code}|${item.lot}`;
      if (!sessions.has(key)) sessions.set(key, new Set());
      sessions.get(key)!.add(item.source_session_id);
    });
    return new Set([...sessions].filter(([, set]) => set.size > 1).map(([key]) => key));
  }, [items]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter(
      (item) =>
        (typeFilter === 'todos' || (typeFilter === 'repetidos' ? repeatedLotKeys.has(`${item.code}|${item.lot}`) : item.loss_type === typeFilter)) &&
        (!term ||
          [item.code, item.name, item.lot, item.unit_name, item.seller_name].some((value) => value?.toLowerCase().includes(term))),
    );
  }, [items, search, typeFilter, repeatedLotKeys]);

  const kpis = data?.kpis;
  const years = [currentYear, currentYear - 1, currentYear - 2].map(String);

  return (
    <div className="space-y-6">
      <Card className="border-border/60 shadow-sm">
        <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center">
          <div className="md:w-72">
            <Select value={unitId} onValueChange={setUnitId}>
              <SelectTrigger>
                <SelectValue placeholder="Todas as filiais" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as filiais</SelectItem>
                {units.map((unit) => (
                  <SelectItem key={unit.id} value={unit.id}>
                    {unit.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:w-36">
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger>
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                {years.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" className="gap-2 md:ml-auto" onClick={() => void load()} disabled={loading}>
            <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-rose-500/20 bg-rose-500/5">
          <CardContent className="p-5 text-sm text-rose-600">{error}</CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile loading={loading} title="Perda acumulada" value={brl.format(kpis?.total_cost ?? 0)} hint={`${kpis?.items ?? 0} lancamento(s)`} />
        <StatTile loading={loading} title="Vencidos" value={brl.format(kpis?.vencidos_cost ?? 0)} />
        <StatTile loading={loading} title="Avariados" value={brl.format(kpis?.avariados_cost ?? 0)} />
        <StatTile loading={loading} title="Qtd perdida" value={qty.format(kpis?.quantity ?? 0)} hint="unidades" />
        <StatTile
          loading={loading}
          title="Lotes repetidos"
          value={String(kpis?.repeated_lots ?? 0)}
          hint="mesmo produto e lote em mais de uma devolucao"
          tone={(kpis?.repeated_lots ?? 0) > 0 ? 'warning' : undefined}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { title: 'Curva ABC', rows: data?.byCurve ?? [], labels: CURVE_LABELS, order: ['A', 'B', 'C'] },
          { title: 'Promocao', rows: data?.byPromotion ?? [], labels: PROMOTION_LABELS, order: ['true', 'false'] },
          { title: 'Origem do produto', rows: data?.byOrigin ?? [], labels: ORIGIN_LABELS, order: ['cd_logistica', 'fornecedor_externo'] },
          { title: 'Tipo de perda', rows: data?.byLossType ?? [], labels: LOSS_TYPE_LABELS, order: ['vencido', 'avariado'], colorFor: lossTypeColor },
        ].map((panel) => (
          <Card key={panel.title} className="border-border/60 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{panel.title}</CardTitle>
              <CardDescription>% do valor perdido</CardDescription>
            </CardHeader>
            <CardContent>
              <ShareBars rows={panel.rows} labels={panel.labels} order={panel.order} colorFor={panel.colorFor} />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Motivos da perda</CardTitle>
          <CardDescription>% do valor perdido por motivo informado no app</CardDescription>
        </CardHeader>
        <CardContent>
          <ShareBars rows={data?.byReason ?? []} labels={LOSS_REASON_LABELS} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Tendencia mensal da perda</CardTitle>
            <CardDescription>Valor perdido por mes em {year}</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthly} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
                <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
                <XAxis dataKey="label" {...axisProps} tickFormatter={(value: string) => value.slice(0, 2)} />
                <YAxis {...axisProps} width={72} tickFormatter={(value: number) => brlShort.format(value)} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--viz-axis)', strokeDasharray: '3 3' }} />
                <Line
                  type="monotone"
                  dataKey="total"
                  name="Perda total"
                  stroke="var(--viz-series-1)"
                  strokeWidth={2}
                  dot={{ r: 4, strokeWidth: 2, fill: 'var(--card)' }}
                  activeDot={{ r: 6, strokeWidth: 2, stroke: 'var(--card)' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Vencidos x Avariados por mes</CardTitle>
            <CardDescription>Valor perdido em {year}</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly} margin={{ top: 8, right: 16, bottom: 0, left: 8 }} barGap={2} barCategoryGap="25%">
                <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
                <XAxis dataKey="label" {...axisProps} tickFormatter={(value: string) => value.slice(0, 2)} />
                <YAxis {...axisProps} width={72} tickFormatter={(value: number) => brlShort.format(value)} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.6 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="vencido" name="Vencidos" fill="var(--viz-vencido)" radius={[4, 4, 0, 0]} maxBarSize={18} />
                <Bar dataKey="avariado" name="Avariados" fill="var(--viz-avariado)" radius={[4, 4, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60 shadow-sm">
        <CardHeader className="space-y-3">
          <div>
            <CardTitle className="text-xl">Itens perdidos</CardTitle>
            <CardDescription>Cada produto lancado nas devolucoes de vencidos e avariados.</CardDescription>
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <div className="flex flex-wrap gap-2">
              {[
                ['todos', 'Todos'],
                ['vencido', 'Vencidos'],
                ['avariado', 'Avariados'],
                ['repetidos', 'Lotes repetidos'],
              ].map(([value, text]) => (
                <Button key={value} type="button" size="sm" variant={typeFilter === value ? 'default' : 'outline'} onClick={() => setTypeFilter(value)}>
                  {text}
                </Button>
              ))}
            </div>
            <Input
              className="md:ml-auto md:w-72"
              placeholder="Buscar codigo, produto, lote, filial..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-sm text-muted-foreground">Carregando...</div>
          ) : filteredItems.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">Nenhum item perdido no periodo.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Codigo</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Filial</TableHead>
                    <TableHead>Lote</TableHead>
                    <TableHead>Curva</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Fabricacao</TableHead>
                    <TableHead>Validade</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Custo unit.</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Promocao</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead className="pr-6">Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => {
                    const repeated = item.lot && repeatedLotKeys.has(`${item.code}|${item.lot}`);
                    return (
                      <TableRow key={`${item.source_session_id}-${item.item_id}`}>
                        <TableCell className="pl-6 tabular-nums">{item.code ?? '-'}</TableCell>
                        <TableCell className="max-w-[240px]">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate font-medium text-foreground" title={item.name ?? ''}>
                              {item.name ?? '-'}
                            </span>
                            {item.has_photo && <ImageIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Tem foto" />}
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{item.unit_name ?? '-'}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {item.lot ?? '-'}
                          {repeated && (
                            <Badge variant="outline" className="ml-1.5 border-amber-500/50 text-amber-700 dark:text-amber-400" title="Mesmo lote em mais de uma devolucao">
                              <AlertTriangle className="mr-1 h-3 w-3" aria-hidden />
                              repetido
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{item.curve ?? '-'}</TableCell>
                        <TableCell className="whitespace-nowrap">{item.origin ? label(ORIGIN_LABELS, item.origin) : '-'}</TableCell>
                        <TableCell className="tabular-nums">{toBrDate(item.manufactured_at)}</TableCell>
                        <TableCell className="tabular-nums">{toBrDate(item.expires_at)}</TableCell>
                        <TableCell>
                          {item.loss_type ? (
                            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                              <span className="h-2 w-2 rounded-full" style={{ background: lossTypeColor(item.loss_type) }} />
                              {label(LOSS_TYPE_LABELS, item.loss_type)}
                            </span>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{qty.format(item.quantity)}</TableCell>
                        <TableCell className="text-right tabular-nums">{brl.format(item.unit_cost)}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{brl.format(item.total_cost)}</TableCell>
                        <TableCell>{item.promotion === null ? '-' : item.promotion ? 'Sim' : 'Nao'}</TableCell>
                        <TableCell className="whitespace-nowrap">{item.loss_reason ? label(LOSS_REASON_LABELS, item.loss_reason) : '-'}</TableCell>
                        <TableCell className="whitespace-nowrap pr-6 tabular-nums">
                          {item.finished_at ? new Date(item.finished_at).toLocaleDateString('pt-BR') : '-'}
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
    </div>
  );
};
