import React, { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, Plus, RefreshCcw, Shirt } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { getOperationalUnits } from '../operational-alerts/api';
import { OperationalUnitOption } from '../operational-alerts/types';
import {
  createUniformItem,
  generateUniformTags,
  getUniformItems,
  getUniformStock,
  getUniformStockByUnit,
  getUniformTags,
} from './api';
import { UniformItem, UniformStockRow, UniformTag, UniformUnitStockRow } from './types';

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('pt-BR');
}

const StockTab: React.FC = () => {
  const [rows, setRows] = useState<UniformStockRow[]>([]);
  const [units, setUnits] = useState<OperationalUnitOption[]>([]);
  const [unitId, setUnitId] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async (filterUnitId: string) => {
    setLoading(true);
    try {
      const [stock, unitOptions] = await Promise.all([getUniformStock(filterUnitId || undefined), getOperationalUnits()]);
      setRows(stock);
      setUnits(unitOptions);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel carregar o estoque.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(unitId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <Card className="border-border/60 shadow-sm">
        <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Label htmlFor="unit-filter" className="text-sm text-muted-foreground">
              Filtrar por unidade
            </Label>
            <select
              id="unit-filter"
              className="flex h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={unitId}
              onChange={(event) => {
                setUnitId(event.target.value);
                void load(event.target.value);
              }}
            >
              <option value="">Todas as unidades</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
          </div>
          <Button variant="outline" className="gap-2" onClick={() => void load(unitId)} disabled={loading}>
            <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">Estoque por etiqueta e local</CardTitle>
          <CardDescription>Cada linha e uma etiqueta em uso, com a quantidade e o local exatos onde ela esta guardada.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-sm text-muted-foreground">Carregando...</div>
          ) : rows.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">Nenhum uniforme em estoque ainda.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Uniforme</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead>Local</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead className="pr-6">Etiqueta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={`${row.unitId}:${row.uniformItemId}`}>
                    <TableCell className="pl-6 font-medium text-foreground">
                      {row.uniformName} {row.uniformSize}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{row.quantity}</Badge>
                    </TableCell>
                    <TableCell>{row.locationLabel || 'Sem local especifico (recebido por transferencia)'}</TableCell>
                    <TableCell>{row.unitName}</TableCell>
                    <TableCell className="pr-6 font-mono text-xs text-muted-foreground">
                      {row.tagIds && row.tagIds.length > 0 ? row.tagIds.join(', ') : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const StockByUnitTab: React.FC = () => {
  const [rows, setRows] = useState<UniformUnitStockRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await getUniformStockByUnit());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel carregar o estoque por filial.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const groupedByUnit = useMemo(() => {
    const groups = new Map<string, { unitName: string; items: UniformUnitStockRow[] }>();
    rows.forEach((row) => {
      const current = groups.get(row.unitId) ?? { unitName: row.unitName, items: [] };
      current.items.push(row);
      groups.set(row.unitId, current);
    });
    return Array.from(groups.entries());
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button variant="outline" className="gap-2" onClick={() => void load()} disabled={loading}>
          <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {loading ? (
        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-6 text-sm text-muted-foreground">Carregando...</CardContent>
        </Card>
      ) : groupedByUnit.length === 0 ? (
        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-6 text-sm text-muted-foreground">Nenhum estoque registrado ainda.</CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groupedByUnit.map(([unitId, group]) => (
            <Card key={unitId} className="border-border/60 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">{group.unitName}</CardTitle>
                <CardDescription>{group.items.length} modelo(s) em estoque</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {group.items.map((item) => (
                  <div
                    key={item.uniformItemId}
                    className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm"
                  >
                    <span className="font-medium text-foreground">
                      {item.uniformName} {item.uniformSize}
                    </span>
                    <Badge variant="outline">{item.quantity}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

const LabelsTab: React.FC = () => {
  const [quantity, setQuantity] = useState('10');
  const [batchLabel, setBatchLabel] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedTags, setGeneratedTags] = useState<UniformTag[]>([]);

  const handleGenerate = async () => {
    const parsedQuantity = Number(quantity);
    if (!parsedQuantity || parsedQuantity < 1) {
      toast.error('Informe uma quantidade valida de etiquetas.');
      return;
    }

    setGenerating(true);
    try {
      const tags = await generateUniformTags({ quantity: parsedQuantity, batchLabel: batchLabel || null });
      setGeneratedTags(tags);
      toast.success(`${tags.length} etiqueta(s) gerada(s).`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel gerar as etiquetas.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-border/60 shadow-sm print:hidden">
        <CardHeader>
          <CardTitle className="text-xl">Gerar etiquetas para um novo lote</CardTitle>
          <CardDescription>
            Gere os QR codes antes de receber a mercadoria. Cole uma etiqueta em cada uniforme (ou lote) e use o app para dar entrada.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 md:flex-row md:items-end">
          <div className="space-y-2">
            <Label htmlFor="qty">Quantidade de etiquetas</Label>
            <Input id="qty" type="number" min="1" max="500" value={quantity} onChange={(event) => setQuantity(event.target.value)} className="w-40" />
          </div>
          <div className="flex-1 space-y-2">
            <Label htmlFor="batch">Identificacao do lote (opcional)</Label>
            <Input id="batch" placeholder="Ex: Lote Inverno 2026" value={batchLabel} onChange={(event) => setBatchLabel(event.target.value)} />
          </div>
          <Button className="gap-2" onClick={() => void handleGenerate()} disabled={generating}>
            <Plus className="h-4 w-4" />
            {generating ? 'Gerando...' : 'Gerar etiquetas'}
          </Button>
          {generatedTags.length > 0 && (
            <Button variant="outline" className="gap-2" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              Imprimir
            </Button>
          )}
        </CardContent>
      </Card>

      {generatedTags.length > 0 && (
        <div className="grid grid-cols-2 gap-4 rounded-xl border border-border/60 bg-card p-6 shadow-sm print:grid-cols-3 print:gap-6 print:border-none print:shadow-none md:grid-cols-4 xl:grid-cols-5">
          {generatedTags.map((tag) => (
            <div key={tag.id} className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-4 text-center">
              <QRCodeSVG value={tag.id} size={120} />
              <p className="font-mono text-xs font-semibold text-foreground">{tag.id}</p>
              {tag.batchLabel && <p className="text-[10px] text-muted-foreground">{tag.batchLabel}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const CatalogTab: React.FC = () => {
  const [items, setItems] = useState<UniformItem[]>([]);
  const [name, setName] = useState('');
  const [size, setSize] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setItems(await getUniformItems());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel carregar o catalogo.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleCreate = async () => {
    if (!name.trim() || !size.trim()) {
      toast.error('Informe o nome e o tamanho.');
      return;
    }

    setSaving(true);
    try {
      await createUniformItem({ name: name.trim(), size: size.trim() });
      setName('');
      setSize('');
      toast.success('Modelo cadastrado.');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel cadastrar o modelo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">Novo modelo de uniforme</CardTitle>
          <CardDescription>Cadastre cada combinacao de peca e tamanho, ex: Jaqueta + P.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 md:flex-row md:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="uniform-name">Peca</Label>
            <Input id="uniform-name" placeholder="Jaqueta" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="uniform-size">Tamanho</Label>
            <Input id="uniform-size" placeholder="P" value={size} onChange={(event) => setSize(event.target.value)} className="w-32" />
          </div>
          <Button className="gap-2" onClick={() => void handleCreate()} disabled={saving}>
            <Plus className="h-4 w-4" />
            {saving ? 'Salvando...' : 'Cadastrar'}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">Catalogo</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-sm text-muted-foreground">Carregando...</div>
          ) : items.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">Nenhum modelo cadastrado ainda.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Peca</TableHead>
                  <TableHead className="pr-6">Tamanho</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="pl-6 font-medium text-foreground">{item.name}</TableCell>
                    <TableCell className="pr-6">{item.size}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export const UniformsPage: React.FC = () => {
  const [tab, setTab] = useState('stock');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600">
          <Shirt className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-3xl font-bold text-foreground">Inventario de Uniformes</h2>
          <p className="text-muted-foreground">Etiquetas, entradas, saidas e estoque por unidade.</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="stock">Estoque</TabsTrigger>
          <TabsTrigger value="by-unit">Por filial</TabsTrigger>
          <TabsTrigger value="labels">Etiquetas</TabsTrigger>
          <TabsTrigger value="catalog">Catalogo</TabsTrigger>
        </TabsList>
        <TabsContent value="stock">
          <StockTab />
        </TabsContent>
        <TabsContent value="by-unit">
          <StockByUnitTab />
        </TabsContent>
        <TabsContent value="labels">
          <LabelsTab />
        </TabsContent>
        <TabsContent value="catalog">
          <CatalogTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};
