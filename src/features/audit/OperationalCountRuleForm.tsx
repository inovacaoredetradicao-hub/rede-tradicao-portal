import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Layers3, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  getProductsByClassification,
  getUsersByUnit,
  searchOperationalProducts,
} from '@/features/operational-alerts/api';
import {
  CountFrequency,
  OperationalClassificationOption,
  OperationalCountRule,
  OperationalProductOption,
  OperationalRulePayload,
  OperationalRuleSubmitInput,
  OperationalRuleSubmitResult,
  OperationalUnitOption,
  OperationalUserOption,
} from '@/features/operational-alerts/types';

// crypto.randomUUID() so exige em contexto seguro (https ou localhost) e falha
// silenciosamente (TypeError) quando o portal e acessado pelo IP da rede local
// em http simples. crypto.getRandomValues nao tem essa restricao.
function generateGroupId(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

interface OperationalCountRuleFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: OperationalRuleSubmitInput, editingRuleId?: string | null) => Promise<OperationalRuleSubmitResult>;
  saving: boolean;
  classificationOptions: OperationalClassificationOption[];
  units: OperationalUnitOption[];
  users: OperationalUserOption[];
  editingRule?: OperationalCountRule | null;
}

interface RuleFormState {
  targetMode: 'product' | 'classification';
  classificationKey: string;
  productId: string;
  barcode: string;
  productName: string;
  selectedProductIds: string[];
  unitId: string;
  unitName: string;
  frequency: CountFrequency;
  executionDeadlineMinutes: string;
  isActive: boolean;
  startDate: string;
  endDate: string;
  selectedUserIds: string[];
  productSearch: string;
  unitSearch: string;
}

const EMPTY_FORM: RuleFormState = {
  targetMode: 'product',
  classificationKey: '',
  productId: '',
  barcode: '',
  productName: '',
  selectedProductIds: [],
  unitId: '',
  unitName: '',
  frequency: 'diario',
  executionDeadlineMinutes: '60',
  isActive: true,
  startDate: new Date().toISOString().slice(0, 10),
  endDate: '',
  selectedUserIds: [],
  productSearch: '',
  unitSearch: '',
};

export const OperationalCountRuleForm: React.FC<OperationalCountRuleFormProps> = ({
  open,
  onOpenChange,
  onSubmit,
  saving,
  classificationOptions,
  units,
  users,
  editingRule,
}) => {
  const [form, setForm] = useState<RuleFormState>(EMPTY_FORM);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [usersForUnit, setUsersForUnit] = useState<OperationalUserOption[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  // Busca de produtos sob demanda (botao/Enter) - nao ha mais catalogo inteiro em memoria.
  const [selectedProducts, setSelectedProducts] = useState<OperationalProductOption[]>([]);
  const [productResults, setProductResults] = useState<OperationalProductOption[]>([]);
  const [productResultsTotal, setProductResultsTotal] = useState(0);
  const [searchingProducts, setSearchingProducts] = useState(false);
  const [productsSearched, setProductsSearched] = useState(false);
  const [classificationProducts, setClassificationProducts] = useState<OperationalProductOption[]>([]);
  const [loadingClassification, setLoadingClassification] = useState(false);

  const runProductSearch = async () => {
    setSearchingProducts(true);
    try {
      const result = await searchOperationalProducts(form.productSearch, 50);
      setProductResults(result.items);
      setProductResultsTotal(result.total);
      setProductsSearched(true);
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : 'Nao foi possivel buscar produtos.');
    } finally {
      setSearchingProducts(false);
    }
  };

  useEffect(() => {
    setSelectedProducts([]);
    setProductResults([]);
    setProductResultsTotal(0);
    setProductsSearched(false);
    setClassificationProducts([]);

    if (!editingRule) {
      setForm(EMPTY_FORM);
      setValidationError(null);
      return;
    }

    setForm({
      targetMode: 'product',
      classificationKey: '',
      productId: editingRule.productId,
      barcode: editingRule.barcode,
      productName: editingRule.productName,
      selectedProductIds: [],
      unitId: editingRule.unitId,
      unitName: editingRule.unitName,
      frequency: editingRule.frequency,
      executionDeadlineMinutes: String(editingRule.executionDeadlineMinutes),
      isActive: editingRule.isActive,
      startDate: editingRule.startDate,
      endDate: editingRule.endDate || '',
      selectedUserIds: editingRule.responsibleUserId ? [editingRule.responsibleUserId] : [],
      productSearch: '',
      unitSearch: editingRule.unitName,
    });
    setValidationError(null);
  }, [editingRule]);

  useEffect(() => {
    if (!form.unitId) {
      setUsersForUnit([]);
      return;
    }

    let cancelled = false;
    setLoadingUsers(true);
    getUsersByUnit(form.unitId)
      .then((result) => {
        if (!cancelled) setUsersForUnit(result);
      })
      .catch(() => {
        if (!cancelled) setUsersForUnit([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingUsers(false);
      });

    return () => {
      cancelled = true;
    };
  }, [form.unitId]);

  const unitMap = useMemo(() => {
    return new Map(units.map((unit) => [unit.id, unit]));
  }, [units]);

  const availableUsers = usersForUnit.length > 0 ? usersForUnit : users;

  const selectedClassification = useMemo(() => {
    return classificationOptions.find((option) => option.key === form.classificationKey) ?? null;
  }, [classificationOptions, form.classificationKey]);

  useEffect(() => {
    if (!selectedClassification) {
      setClassificationProducts([]);
      return;
    }

    let cancelled = false;
    setLoadingClassification(true);
    getProductsByClassification(selectedClassification.label)
      .then((result) => {
        if (!cancelled) setClassificationProducts(result);
      })
      .catch(() => {
        if (!cancelled) setClassificationProducts([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingClassification(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedClassification]);

  const previewClassificationProducts = classificationProducts.slice(0, 8);

  const handleProductSelection = (selectedProduct: OperationalProductOption) => {
    setForm((current) => ({
      ...current,
      productId: selectedProduct.id,
      barcode: selectedProduct.barcode,
      productName: selectedProduct.name,
    }));
  };

  const toggleProductSelection = (product: OperationalProductOption) => {
    setSelectedProducts((current) =>
      current.some((item) => item.id === product.id)
        ? current.filter((item) => item.id !== product.id)
        : [...current, product],
    );
  };

  const selectedProductsPreview = selectedProducts;

  const handleUnitSelection = (unitId: string) => {
    const selectedUnit = unitMap.get(unitId);
    setForm((current) => ({
      ...current,
      unitId: selectedUnit?.id ?? '',
      unitName: selectedUnit?.name ?? '',
      unitSearch: selectedUnit?.displayLabel ?? '',
      selectedUserIds: [],
    }));
  };

  const toggleUser = (userId: string) => {
    setForm((current) => {
      const isEditingSingle = Boolean(editingRule);
      if (isEditingSingle) {
        return { ...current, selectedUserIds: [userId] };
      }

      const isSelected = current.selectedUserIds.includes(userId);
      return {
        ...current,
        selectedUserIds: isSelected
          ? current.selectedUserIds.filter((id) => id !== userId)
          : [...current.selectedUserIds, userId],
      };
    });
  };

  const selectAllUsers = () => {
    setForm((current) => ({ ...current, selectedUserIds: availableUsers.map((user) => user.id) }));
  };

  const clearUsers = () => {
    setForm((current) => ({ ...current, selectedUserIds: [] }));
  };

  const buildBasePayload = (overrides: Partial<OperationalRulePayload> = {}) => ({
    productId: form.productId,
    barcode: form.barcode,
    productName: form.productName,
    unitId: form.unitId,
    unitName: form.unitName,
    frequency: form.frequency,
    executionDeadlineMinutes: Number(form.executionDeadlineMinutes),
    isActive: form.isActive,
    startDate: form.startDate,
    endDate: form.endDate || null,
    responsibleUserId: null as string | null,
    responsibleUserName: null as string | null,
    ...overrides,
  });

  const handleSave = async () => {
    try {
      await handleSaveInternal();
    } catch (error) {
      // onSubmit ja mostra um toast com o erro; aqui so garantimos que o formulario
      // nunca fique "sem reacao" se algo inesperado quebrar antes de chegar la.
      setValidationError(error instanceof Error ? error.message : 'Nao foi possivel salvar a regra.');
    }
  };

  const handleSaveInternal = async () => {
    setValidationError(null);

    if (!form.unitId || !form.unitName || !form.startDate) {
      setValidationError('Selecione a filial e a data inicial.');
      return;
    }

    if (!form.executionDeadlineMinutes || Number(form.executionDeadlineMinutes) <= 0) {
      setValidationError('Informe um prazo valido em minutos.');
      return;
    }

    if (form.selectedUserIds.length === 0) {
      setValidationError('Selecione ao menos um usuario desta filial para receber o disparo.');
      return;
    }

    const selectedUsers = form.selectedUserIds
      .map((id) => availableUsers.find((user) => user.id === id))
      .filter((user): user is OperationalUserOption => Boolean(user));

    if (editingRule) {
      const user = selectedUsers[0];
      await onSubmit(
        {
          mode: 'edit',
          payload: buildBasePayload({
            responsibleUserId: user?.id ?? null,
            responsibleUserName: user?.name ?? null,
          }),
        },
        editingRule.id,
      );
      onOpenChange(false);
      return;
    }

    if (form.targetMode === 'classification') {
      if (!selectedClassification || classificationProducts.length === 0) {
        setValidationError(
          loadingClassification
            ? 'Aguarde carregar os produtos da classificacao.'
            : 'Selecione uma classificacao com produtos disponiveis para disparo.',
        );
        return;
      }

      const payloads = classificationProducts.flatMap((product) =>
        selectedUsers.map((user) =>
          buildBasePayload({
            productId: product.id,
            barcode: product.barcode,
            productName: product.name,
            responsibleUserId: user.id,
            responsibleUserName: user.name,
          }),
        ),
      );

      await onSubmit(
        { mode: 'classification', classificationKey: selectedClassification.key, classificationLabel: selectedClassification.label, payloads },
        null,
      );
      onOpenChange(false);
      return;
    }

    {
      if (selectedProducts.length === 0) {
        setValidationError('Busque e selecione ao menos um produto para contar.');
        return;
      }

      const groupId = selectedProducts.length > 1 ? generateGroupId() : undefined;

      const payloads = selectedProducts.flatMap((product) =>
        selectedUsers.map((user) =>
          buildBasePayload({
            productId: product.id,
            barcode: product.barcode,
            productName: product.name,
            responsibleUserId: user.id,
            responsibleUserName: user.name,
            groupId,
          }),
        ),
      );

      await onSubmit({ mode: 'product', payloads }, null);
      onOpenChange(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{editingRule ? 'Editar disparo' : 'Novo disparo'}</SheetTitle>
          <SheetDescription>Escolha a filial, depois quem vai receber o disparo, e por fim o que sera contado.</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="unit-select">1. Filial</Label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <select
                id="unit-select"
                className="flex h-11 w-full rounded-md border border-input bg-background pl-10 pr-3 text-sm"
                value={form.unitId}
                onChange={(event) => handleUnitSelection(event.target.value)}
              >
                <option value="">Selecione a filial para disparar</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-border/60 p-4">
            <div className="flex items-center justify-between gap-2">
              <Label>2. Usuarios desta filial que vao receber o disparo</Label>
              {!editingRule && availableUsers.length > 0 && (
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={selectAllUsers}>
                    Todos
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={clearUsers}>
                    Limpar
                  </Button>
                </div>
              )}
            </div>

            {!form.unitId ? (
              <p className="text-sm text-muted-foreground">Selecione uma filial primeiro.</p>
            ) : loadingUsers ? (
              <p className="text-sm text-muted-foreground">Carregando usuarios da filial...</p>
            ) : availableUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum usuario vinculado a esta filial ainda. Use "Usuarios por filial" para vincular antes de disparar.
              </p>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {availableUsers.map((user) => (
                  <label
                    key={user.id}
                    className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  >
                    <Checkbox checked={form.selectedUserIds.includes(user.id)} onCheckedChange={() => toggleUser(user.id)} />
                    <span className="text-foreground">
                      {user.name} <span className="text-xs text-muted-foreground">({user.role})</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label className="mb-2 block">3. O que contar</Label>
            {!editingRule && (
              <div className="grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, targetMode: 'product', classificationKey: '' }))}
                  className={`rounded-xl border p-4 text-left transition-colors ${form.targetMode === 'product' ? 'border-primary bg-primary/5' : 'border-border bg-background'}`}
                >
                  <p className="font-semibold text-foreground">Produtos especificos</p>
                  <p className="mt-1 text-sm text-muted-foreground">Escolha um ou mais produtos. Se escolher mais de um, todos caem juntos numa unica conferencia.</p>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      targetMode: 'classification',
                      productId: '',
                      barcode: '',
                      productName: '',
                      selectedProductIds: [],
                    }))
                  }
                  className={`rounded-xl border p-4 text-left transition-colors ${form.targetMode === 'classification' ? 'border-primary bg-primary/5' : 'border-border bg-background'}`}
                >
                  <p className="font-semibold text-foreground">Classificacao inteira</p>
                  <p className="mt-1 text-sm text-muted-foreground">Dispare em lote todos os produtos de uma classificacao, como Conveniencia.</p>
                </button>
              </div>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {editingRule ? (
              <>
                <div className="space-y-2 md:col-span-2">
                  <Label>Trocar produto (opcional)</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        className="pl-10"
                        placeholder="Nome, codigo de barras ou codigo do produto"
                        value={form.productSearch}
                        onChange={(event) => setForm((current) => ({ ...current, productSearch: event.target.value }))}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            void runProductSearch();
                          }
                        }}
                      />
                    </div>
                    <Button type="button" variant="outline" onClick={() => void runProductSearch()} disabled={searchingProducts}>
                      {searchingProducts ? 'Buscando...' : 'Buscar'}
                    </Button>
                  </div>
                  <div className="max-h-56 overflow-y-auto rounded-xl border border-border">
                    {!productsSearched ? (
                      <p className="p-3 text-sm text-muted-foreground">Digite e clique em Buscar (ou Enter) para listar produtos.</p>
                    ) : productResults.length === 0 ? (
                      <p className="p-3 text-sm text-muted-foreground">Nenhum produto encontrado.</p>
                    ) : (
                      <>
                        {productResults.map((product) => (
                          <button
                            type="button"
                            key={product.id}
                            onClick={() => handleProductSelection(product)}
                            className={`flex w-full items-center gap-2 border-b border-border/40 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted/30 ${
                              form.productId === product.id ? 'bg-primary/10 font-medium' : ''
                            }`}
                          >
                            <span className="text-foreground">{product.displayLabel}</span>
                          </button>
                        ))}
                        {productResultsTotal > productResults.length && (
                          <p className="px-3 py-2 text-xs text-muted-foreground">
                            Mostrando {productResults.length} de {productResultsTotal}. Refine a busca para encontrar outros.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="barcode">Codigo de barras</Label>
                  <Input
                    id="barcode"
                    value={form.barcode}
                    onChange={(event) => setForm((current) => ({ ...current, barcode: event.target.value }))}
                    placeholder="1000001"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="product-name">Nome do produto</Label>
                  <Input
                    id="product-name"
                    value={form.productName}
                    onChange={(event) => setForm((current) => ({ ...current, productName: event.target.value }))}
                    placeholder="Agua Mineral 500ml"
                  />
                </div>
              </>
            ) : form.targetMode === 'product' ? (
                <div className="space-y-3 md:col-span-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label>Produtos para contar</Label>
                    {selectedProducts.length > 0 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedProducts([])}>
                        Limpar selecao
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        className="pl-10"
                        placeholder="Nome, codigo de barras ou codigo do produto"
                        value={form.productSearch}
                        onChange={(event) => setForm((current) => ({ ...current, productSearch: event.target.value }))}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            void runProductSearch();
                          }
                        }}
                      />
                    </div>
                    <Button type="button" variant="outline" onClick={() => void runProductSearch()} disabled={searchingProducts}>
                      {searchingProducts ? 'Buscando...' : 'Buscar'}
                    </Button>
                  </div>
                  <div className="max-h-56 overflow-y-auto rounded-xl border border-border">
                    {!productsSearched ? (
                      <p className="p-3 text-sm text-muted-foreground">Digite e clique em Buscar (ou Enter) para listar produtos.</p>
                    ) : productResults.length === 0 ? (
                      <p className="p-3 text-sm text-muted-foreground">Nenhum produto encontrado.</p>
                    ) : (
                      <>
                        {productResults.map((product) => (
                          <label
                            key={product.id}
                            className="flex items-center gap-2 border-b border-border/40 px-3 py-2 text-sm last:border-b-0 hover:bg-muted/30"
                          >
                            <Checkbox
                              checked={selectedProducts.some((item) => item.id === product.id)}
                              onCheckedChange={() => toggleProductSelection(product)}
                            />
                            <span className="text-foreground">{product.displayLabel}</span>
                          </label>
                        ))}
                        {productResultsTotal > productResults.length && (
                          <p className="px-3 py-2 text-xs text-muted-foreground">
                            Mostrando {productResults.length} de {productResultsTotal}. Refine a busca para encontrar outros.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                  {selectedProductsPreview.length > 0 && (
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                      <p className="text-sm font-semibold text-foreground">
                        {selectedProductsPreview.length} produto(s) selecionado(s)
                        {selectedProductsPreview.length > 1 ? ' - contados juntos numa unica conferencia' : ''}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {selectedProductsPreview.map((product) => (
                          <span
                            key={product.id}
                            className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground"
                          >
                            {product.name}
                            <button
                              type="button"
                              onClick={() => toggleProductSelection(product)}
                              className="text-muted-foreground hover:text-rose-500"
                            >
                              x
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
            ) : (
              <div className="space-y-4 md:col-span-2">
                <div className="space-y-2">
                  <Label htmlFor="classification-select">Classificacao para disparo em lote</Label>
                  <div className="relative">
                    <Layers3 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <select
                      id="classification-select"
                      className="flex h-11 w-full rounded-md border border-input bg-background pl-10 pr-3 text-sm"
                      value={form.classificationKey}
                      onChange={(event) => setForm((current) => ({ ...current, classificationKey: event.target.value }))}
                    >
                      <option value="">Selecione uma classificacao</option>
                      {classificationOptions.map((classification) => (
                        <option key={classification.key} value={classification.key}>
                          {classification.label} ({classification.productCount} produtos)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-foreground">
                        {selectedClassification ? selectedClassification.label : 'Nenhuma classificacao selecionada'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {!selectedClassification
                          ? 'Selecione uma classificacao para visualizar o lote de produtos.'
                          : loadingClassification
                            ? 'Carregando produtos da classificacao...'
                            : `${selectedClassification.productCount} produto(s) x ${form.selectedUserIds.length} usuario(s) selecionado(s).`}
                      </p>
                    </div>
                    {selectedClassification && (
                      <div className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                        {selectedClassification.productCount} itens
                      </div>
                    )}
                  </div>

                  {selectedClassification && (
                    <div className="mt-4 grid gap-2 md:grid-cols-2">
                      {previewClassificationProducts.map((product) => (
                        <div key={product.id} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
                          <p className="font-medium text-foreground">{product.name}</p>
                          <p className="text-xs text-muted-foreground">{product.barcode || product.productCode || product.id}</p>
                        </div>
                      ))}
                      {selectedClassification.productCount > previewClassificationProducts.length && (
                        <div className="rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
                          +{selectedClassification.productCount - previewClassificationProducts.length} produto(s) no mesmo disparo
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="frequency">Frequencia</Label>
              <select
                id="frequency"
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.frequency}
                onChange={(event) => setForm((current) => ({ ...current, frequency: event.target.value as CountFrequency }))}
              >
                <option value="unica">Unica (nao repete)</option>
                <option value="diario">Diario</option>
                <option value="quinzenal">Quinzenal</option>
                <option value="mensal">Mensal</option>
              </select>
              {form.frequency === 'unica' && (
                <p className="text-xs text-muted-foreground">
                  Dispara uma vez na data inicial e a regra e desativada automaticamente depois.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="deadline">Prazo em minutos</Label>
              <Input
                id="deadline"
                type="number"
                min="1"
                value={form.executionDeadlineMinutes}
                onChange={(event) => setForm((current) => ({ ...current, executionDeadlineMinutes: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="start-date">Data inicial</Label>
              <Input
                id="start-date"
                type="date"
                value={form.startDate}
                onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end-date">Data final</Label>
              <Input
                id="end-date"
                type="date"
                value={form.endDate}
                onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))}
              />
            </div>

            <div className="rounded-xl border border-border p-4 md:col-span-2">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-foreground">Regra ativa</p>
                  <p className="text-sm text-muted-foreground">Quando ativa, a regra entra no scheduler e pode gerar alertas automaticamente.</p>
                </div>
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(checked) => setForm((current) => ({ ...current, isActive: checked }))}
                />
              </div>
            </div>
          </div>

          {validationError && (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-sm text-rose-600">
              {validationError}
            </div>
          )}
        </div>

        <SheetFooter className="mt-8">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar regra'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
