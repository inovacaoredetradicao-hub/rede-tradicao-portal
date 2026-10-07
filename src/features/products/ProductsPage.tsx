import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Barcode, ChevronDown, ChevronLeft, ChevronRight, Pencil, RefreshCcw, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  addProductBarcode,
  getProductStockByUnit,
  getUnitsErpMapping,
  removeProductBarcode,
  searchProducts,
  updateProductBarcode,
} from './api';
import { ErpIntegrationSection } from './ErpIntegrationSection';
import { ProductCatalogItem, ProductSearchFilters, ProductUnitStock, UnitErpMapping } from './types';

const stockFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 });
const PAGE_SIZE = 100;

const unitLabel = (unit: UnitErpMapping) =>
  unit.erpCompanyId !== null ? `${String(unit.erpCompanyId).padStart(2, '0')} - ${unit.name}` : unit.name;

// A tela nao carrega nada ao abrir: os filtros sao so rascunho ate o usuario clicar em
// "Atualizar" (ou Enter na busca). A busca roda no backend e volta uma pagina por vez,
// em vez de baixar o catalogo inteiro (~20 mil produtos) e filtrar no navegador.
export const ProductsPage: React.FC = () => {
  const [products, setProducts] = useState<ProductCatalogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<ProductSearchFilters | null>(null);

  const [search, setSearch] = useState('');
  const [onlyWithStock, setOnlyWithStock] = useState(false);
  const [draftUnitIds, setDraftUnitIds] = useState<string[]>([]);

  const [units, setUnits] = useState<UnitErpMapping[]>([]);
  const [unitsLoaded, setUnitsLoaded] = useState(false);
  const [unitPickerOpen, setUnitPickerOpen] = useState(false);
  const [unitPickerSearch, setUnitPickerSearch] = useState('');

  const [editingProduct, setEditingProduct] = useState<ProductCatalogItem | null>(null);
  const [barcodeDraft, setBarcodeDraft] = useState('');
  const [newExtraBarcode, setNewExtraBarcode] = useState('');
  const [saving, setSaving] = useState(false);
  const [stockProduct, setStockProduct] = useState<ProductCatalogItem | null>(null);
  const [stockRows, setStockRows] = useState<ProductUnitStock[]>([]);
  const [stockLoading, setStockLoading] = useState(false);

  const runSearch = async (filters: ProductSearchFilters, pageOffset: number) => {
    setLoading(true);
    try {
      const result = await searchProducts(filters, PAGE_SIZE, pageOffset);
      setProducts(result.items);
      setTotal(result.total);
      setOffset(pageOffset);
      setAppliedFilters(filters);
      return result.items;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel buscar os produtos.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    setUnitPickerOpen(false);
    void runSearch({ term: search.trim(), unitIds: draftUnitIds, onlyWithStock }, 0);
  };

  // Recarrega a pagina atual (apos editar codigos de barras) e devolve o produto atualizado.
  const refreshCurrentPage = async (productId: string) => {
    if (!appliedFilters) return;
    const items = await runSearch(appliedFilters, offset);
    const refreshed = items?.find((product) => product.id === productId);
    if (refreshed) setEditingProduct(refreshed);
  };

  const openUnitPicker = async () => {
    setUnitPickerOpen((open) => !open);
    if (unitsLoaded) return;
    try {
      const rows = await getUnitsErpMapping();
      setUnits(
        [...rows].sort(
          (a, b) => (a.erpCompanyId ?? Infinity) - (b.erpCompanyId ?? Infinity) || a.name.localeCompare(b.name),
        ),
      );
      setUnitsLoaded(true);
    } catch {
      toast.error('Nao foi possivel carregar a lista de filiais.');
    }
  };

  const pickerUnits = useMemo(() => {
    const term = unitPickerSearch.trim().toLowerCase();
    return term ? units.filter((unit) => unitLabel(unit).toLowerCase().includes(term)) : units;
  }, [units, unitPickerSearch]);

  const toggleDraftUnit = (unitId: string) =>
    setDraftUnitIds((current) =>
      current.includes(unitId) ? current.filter((id) => id !== unitId) : [...current, unitId],
    );

  const appliedUnitsText = (() => {
    const ids = appliedFilters?.unitIds ?? [];
    if (ids.length === 0) return 'todas as filiais';
    if (ids.length > 3) return `${ids.length} filiais`;
    return units
      .filter((unit) => ids.includes(unit.id))
      .map(unitLabel)
      .join(', ');
  })();

  const openStockDialog = async (product: ProductCatalogItem) => {
    setStockProduct(product);
    setStockRows([]);
    setStockLoading(true);
    try {
      setStockRows(await getProductStockByUnit(product.id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel carregar o estoque por filial.');
    } finally {
      setStockLoading(false);
    }
  };

  const openEditDialog = (product: ProductCatalogItem) => {
    setEditingProduct(product);
    setBarcodeDraft(product.barcode);
    setNewExtraBarcode('');
  };

  const closeEditDialog = () => {
    setEditingProduct(null);
    setBarcodeDraft('');
    setNewExtraBarcode('');
  };

  const handleSavePrimaryBarcode = async () => {
    if (!editingProduct) return;
    const trimmed = barcodeDraft.trim();
    if (!trimmed) {
      toast.error('Informe um codigo de barras valido.');
      return;
    }

    setSaving(true);
    try {
      await updateProductBarcode(editingProduct.id, trimmed);
      toast.success('Codigo de barras atualizado. O app vai puxar o novo codigo na proxima sincronizacao.');
      await refreshCurrentPage(editingProduct.id);
      closeEditDialog();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel atualizar o codigo de barras.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddExtraBarcode = async () => {
    if (!editingProduct) return;
    const trimmed = newExtraBarcode.trim();
    if (!trimmed) return;

    setSaving(true);
    try {
      await addProductBarcode(editingProduct.id, trimmed);
      toast.success('Codigo de barras adicional cadastrado.');
      setNewExtraBarcode('');
      await refreshCurrentPage(editingProduct.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel adicionar o codigo de barras.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveExtraBarcode = async (barcode: string) => {
    if (!editingProduct) return;
    setSaving(true);
    try {
      await removeProductBarcode(editingProduct.id, barcode);
      toast.success('Codigo de barras removido.');
      await refreshCurrentPage(editingProduct.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel remover o codigo de barras.');
    } finally {
      setSaving(false);
    }
  };

  const extraBarcodes = editingProduct
    ? editingProduct.barcodes.filter((barcode) => barcode !== editingProduct.barcode)
    : [];

  const pageEnd = Math.min(offset + products.length, total);
  const stockRowsTotal = stockRows.reduce((sum, row) => sum + row.quantity, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Produtos</h1>
        <p className="text-sm text-muted-foreground">
          Ajuste o codigo de barras de uma mercadoria. Assim que o app mobile sincronizar as bases, o novo codigo passa a
          valer nas contagens.
        </p>
      </div>

      <ErpIntegrationSection />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        <div className="relative w-full lg:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-10"
            placeholder="Nome, codigo de barras ou codigo do produto"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleApply();
            }}
          />
        </div>

        <div className="relative">
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between gap-2 lg:w-72"
            onClick={() => void openUnitPicker()}
          >
            <span className="truncate">
              {draftUnitIds.length === 0 ? 'Estoque: todas as filiais' : `Estoque: ${draftUnitIds.length} filial(is)`}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0" />
          </Button>

          {unitPickerOpen && (
            <div className="absolute left-0 z-20 mt-2 w-full rounded-lg border border-border bg-popover p-2 shadow-lg lg:w-80">
              <Input
                className="mb-2 h-8"
                placeholder="Buscar filial (ex.: 01, Matriz)"
                value={unitPickerSearch}
                onChange={(event) => setUnitPickerSearch(event.target.value)}
              />
              <div className="max-h-64 overflow-y-auto">
                {!unitsLoaded ? (
                  <p className="px-2 py-1.5 text-xs text-muted-foreground">Carregando filiais...</p>
                ) : pickerUnits.length === 0 ? (
                  <p className="px-2 py-1.5 text-xs text-muted-foreground">Nenhuma filial.</p>
                ) : (
                  pickerUnits.map((unit) => (
                    <label
                      key={unit.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={draftUnitIds.includes(unit.id)}
                        onChange={() => toggleDraftUnit(unit.id)}
                      />
                      <span className="truncate">{unitLabel(unit)}</span>
                    </label>
                  ))
                )}
              </div>
              <div className="mt-2 flex justify-between border-t border-border pt-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setDraftUnitIds([])}>
                  Limpar (todas)
                </Button>
                <Button type="button" size="sm" onClick={handleApply}>
                  Aplicar
                </Button>
              </div>
            </div>
          )}
        </div>

        <label className="flex items-center gap-2 self-center text-sm text-muted-foreground">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={onlyWithStock}
            onChange={(event) => setOnlyWithStock(event.target.checked)}
          />
          So com estoque
        </label>

        <Button type="button" onClick={handleApply} disabled={loading}>
          <RefreshCcw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Buscando...' : 'Atualizar'}
        </Button>
      </div>

      {appliedFilters && (
        <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            Estoque de <span className="font-medium text-foreground">{appliedUnitsText}</span>
            {appliedFilters.term && (
              <>
                {' '}
                - busca "<span className="font-medium text-foreground">{appliedFilters.term}</span>"
              </>
            )}{' '}
            - {total.toLocaleString('pt-BR')} produto(s)
          </p>
          {total > PAGE_SIZE && (
            <div className="flex items-center gap-2">
              <span>
                {(offset + 1).toLocaleString('pt-BR')}-{pageEnd.toLocaleString('pt-BR')} de {total.toLocaleString('pt-BR')}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loading || offset === 0}
                onClick={() => void runSearch(appliedFilters, Math.max(offset - PAGE_SIZE, 0))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loading || pageEnd >= total}
                onClick={() => void runSearch(appliedFilters, offset + PAGE_SIZE)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border border-border/60">
        {!appliedFilters && !loading ? (
          <p className="p-6 text-sm text-muted-foreground">
            Escolha os filtros e clique em <span className="font-medium text-foreground">Atualizar</span> para carregar os
            produtos. Deixe tudo em branco para ver todos.
          </p>
        ) : loading && products.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Buscando produtos...</p>
        ) : products.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Nenhum produto encontrado.</p>
        ) : (
          <Table className={loading ? 'opacity-60' : ''}>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Produto</TableHead>
                <TableHead>Codigo de barras</TableHead>
                <TableHead>Codigo do produto</TableHead>
                <TableHead>Outros codigos</TableHead>
                <TableHead className="text-right" title={`Somando: ${appliedUnitsText}`}>
                  Estoque{(appliedFilters?.unitIds.length ?? 0) > 0 ? ' (filtro)' : ''}
                </TableHead>
                <TableHead className="pr-4 text-right">Acao</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => {
                const extras = product.barcodes.filter((barcode) => barcode !== product.barcode);
                const stock = product.stockTotal ?? 0;
                return (
                  <TableRow key={product.id}>
                    <TableCell className="pl-4 font-medium text-foreground">{product.name}</TableCell>
                    <TableCell className="font-mono text-sm">{product.barcode || '-'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{product.productCode || '-'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {extras.length > 0 ? `${extras.length} codigo(s) extra(s)` : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <button
                        type="button"
                        className={`font-mono text-sm underline decoration-dotted underline-offset-4 hover:text-primary ${
                          stock < 0 ? 'text-rose-600' : ''
                        }`}
                        title="Ver estoque por filial"
                        onClick={() => void openStockDialog(product)}
                      >
                        {stockFormatter.format(stock)}
                      </button>
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <Button type="button" variant="outline" size="sm" onClick={() => openEditDialog(product)}>
                        <Pencil className="mr-1 h-3.5 w-3.5" />
                        Editar codigo
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={!!editingProduct} onOpenChange={(open) => !open && closeEditDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Barcode className="h-5 w-5" />
              Ajustar codigo de barras
            </DialogTitle>
            <DialogDescription>{editingProduct?.name}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="primary-barcode">Codigo de barras principal</Label>
              <Input
                id="primary-barcode"
                value={barcodeDraft}
                onChange={(event) => setBarcodeDraft(event.target.value)}
                placeholder="Digite o codigo correto"
              />
            </div>

            <div className="space-y-2 rounded-xl border border-border/60 p-3">
              <Label>Codigos de barras adicionais</Label>
              <p className="text-xs text-muted-foreground">
                Use isso quando o produto tem mais de um codigo valido (ex.: embalagem antiga e nova).
              </p>
              {extraBarcodes.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {extraBarcodes.map((barcode) => (
                    <span
                      key={barcode}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs font-mono text-foreground"
                    >
                      {barcode}
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void handleRemoveExtraBarcode(barcode)}
                        className="text-muted-foreground hover:text-rose-500"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <Input
                  value={newExtraBarcode}
                  onChange={(event) => setNewExtraBarcode(event.target.value)}
                  placeholder="Adicionar outro codigo"
                />
                <Button type="button" variant="outline" disabled={saving || !newExtraBarcode.trim()} onClick={() => void handleAddExtraBarcode()}>
                  Adicionar
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeEditDialog} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={() => void handleSavePrimaryBarcode()} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar codigo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!stockProduct} onOpenChange={(open) => !open && setStockProduct(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Estoque por filial</DialogTitle>
            <DialogDescription>
              {stockProduct?.name}
              {!stockLoading && ` - total em todas as filiais: ${stockFormatter.format(stockRowsTotal)}`}
            </DialogDescription>
          </DialogHeader>

          {stockLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : stockRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma filial com saldo para este produto.</p>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Filial</TableHead>
                    <TableHead>Cod. Argo</TableHead>
                    <TableHead className="pr-4 text-right">Estoque</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockRows.map((row) => (
                    <TableRow key={row.unitId}>
                      <TableCell className="pl-4 text-sm">{row.unitName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{row.erpCompanyId ?? '-'}</TableCell>
                      <TableCell
                        className={`pr-4 text-right font-mono text-sm ${row.quantity < 0 ? 'text-rose-600' : ''}`}
                      >
                        {stockFormatter.format(row.quantity)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
