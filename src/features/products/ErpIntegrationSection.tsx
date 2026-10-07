import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Plug, RefreshCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getArgoCompanies,
  getErpSyncStatus,
  getUnitsErpMapping,
  setUnitErpCompanyId,
  triggerErpSync,
} from "./api";
import { ArgoCompanyOption, ErpSyncStatus, UnitErpMapping } from "./types";

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR");
}

export const ErpIntegrationSection: React.FC = () => {
  const [status, setStatus] = useState<ErpSyncStatus | null>(null);
  const [units, setUnits] = useState<UnitErpMapping[]>([]);
  const [companies, setCompanies] = useState<ArgoCompanyOption[]>([]);
  const [companiesError, setCompaniesError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [savingUnitId, setSavingUnitId] = useState<string | null>(null);
  const [manualInputs, setManualInputs] = useState<Record<string, string>>({});
  const [unitSearch, setUnitSearch] = useState("");
  // A tabela de vinculos (e a consulta de empresas na Argo) so carrega quando aberta.
  const [mappingOpen, setMappingOpen] = useState(false);
  const [mappingLoaded, setMappingLoaded] = useState(false);
  const [mappingLoading, setMappingLoading] = useState(false);

  // Sem vinculo primeiro (e o que precisa de acao), depois pelo codigo da Argo.
  const visibleUnits = useMemo(() => {
    const term = unitSearch.trim().toLowerCase();
    return units
      .filter(
        (unit) =>
          !term ||
          unit.name.toLowerCase().includes(term) ||
          unit.code.toLowerCase().includes(term) ||
          String(unit.erpCompanyId ?? "").includes(term),
      )
      .sort((a, b) => {
        if ((a.erpCompanyId === null) !== (b.erpCompanyId === null))
          return a.erpCompanyId === null ? -1 : 1;
        return (
          (a.erpCompanyId ?? 0) - (b.erpCompanyId ?? 0) ||
          a.name.localeCompare(b.name)
        );
      });
  }, [units, unitSearch]);
  const linkedCount = units.filter((unit) => unit.erpCompanyId !== null).length;

  const loadStatus = async () => {
    setLoading(true);
    try {
      setStatus(await getErpSyncStatus());
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Nao foi possivel carregar o status da integracao ERP.",
      );
    } finally {
      setLoading(false);
    }
  };

  const loadMappings = async () => {
    setMappingLoading(true);
    try {
      setUnits(await getUnitsErpMapping());
      setMappingLoaded(true);
      if (status?.configured) {
        try {
          setCompanies(await getArgoCompanies());
          setCompaniesError(null);
        } catch (error) {
          setCompaniesError(
            error instanceof Error
              ? error.message
              : "Nao foi possivel listar as empresas da Argo.",
          );
        }
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Nao foi possivel carregar as filiais.",
      );
    } finally {
      setMappingLoading(false);
    }
  };

  const toggleMapping = () => {
    const next = !mappingOpen;
    setMappingOpen(next);
    if (next && !mappingLoaded) void loadMappings();
  };

  // A sincronizacao leva alguns minutos e roda em segundo plano no servidor: o botao so a
  // inicia e a tela acompanha o status ate terminar (sem esperar a resposta por minutos).
  const waitForSyncToFinish = async () => {
    setSyncing(true);
    try {
      const deadline = Date.now() + 20 * 60 * 1000;
      while (Date.now() < deadline) {
        await new Promise((resolve) => window.setTimeout(resolve, 10000));
        let current: ErpSyncStatus;
        try {
          current = await getErpSyncStatus();
        } catch {
          continue; // falha momentanea de rede: tenta de novo no proximo ciclo
        }
        setStatus(current);
        const run = current.lastRun;
        if (run && run.status !== "em_andamento") {
          if (run.status === "sucesso") {
            toast.success(
              `Sincronizado: ${run.products_created} criado(s), ${run.products_updated} atualizado(s), ${run.stock_updated} saldo(s) de estoque.`,
            );
          } else {
            toast.error(`Sincronizacao terminou com erro: ${run.error_message ?? "veja o detalhe na tela."}`);
          }
          return;
        }
      }
      toast.info("A sincronizacao ainda esta rodando. Recarregue a pagina mais tarde para ver o resultado.");
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    void (async () => {
      await loadStatus();
    })();
  }, []);

  // Se a pagina abrir com uma sincronizacao em andamento, acompanha ate terminar.
  useEffect(() => {
    if (status?.lastRun?.status === "em_andamento" && !syncing) {
      void waitForSyncToFinish();
    }
  }, [status?.lastRun?.id]);

  const handleSync = async () => {
    // Marca como sincronizando antes de recarregar o status, para o acompanhamento
    // automatico (useEffect acima) nao abrir um segundo ciclo em paralelo.
    setSyncing(true);
    try {
      await triggerErpSync();
      toast.info("Sincronizacao iniciada. Leva alguns minutos; o resultado aparece aqui quando terminar.");
    } catch (error) {
      // 409: ja existe uma rodando (ex.: a automatica). Acompanha a que esta em andamento.
      const message = error instanceof Error ? error.message : "Nao foi possivel sincronizar com a Argo.";
      if (!/andamento/i.test(message)) {
        toast.error(message);
        setSyncing(false);
        return;
      }
      toast.info(message);
    }
    await loadStatus();
    await waitForSyncToFinish();
  };

  const handleSaveMapping = async (
    unitId: string,
    erpCompanyId: number | null,
  ) => {
    setSavingUnitId(unitId);
    try {
      await setUnitErpCompanyId(unitId, erpCompanyId);
      toast.success("Vinculo com a filial da Argo atualizado.");
      setUnits((current) =>
        current.map((unit) =>
          unit.id === unitId ? { ...unit, erpCompanyId } : unit,
        ),
      );
      setManualInputs((current) => {
        const { [unitId]: _saved, ...rest } = current;
        return rest;
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Nao foi possivel salvar o vinculo.",
      );
    } finally {
      setSavingUnitId(null);
    }
  };

  const lastRun = status?.lastRun ?? null;

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Plug className="h-4.5 w-4.5" />
            </div>
            <div>
              <CardTitle className="text-xl">
                Integracao com ERP (Argo)
              </CardTitle>
              <CardDescription>
                Traz codigo, descricao e estoque real das mercadorias direto do
                sistema da loja.
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!loading && (
              <Badge
                variant={status?.configured ? "default" : "outline"}
                className="gap-1.5"
              >
                {status?.configured ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5" />
                )}
                {status?.configured ? "Conectado" : "Nao configurado"}
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => void handleSync()}
              disabled={syncing || !status?.configured}
            >
              <RefreshCcw
                className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`}
              />
              {syncing ? "Sincronizando..." : "Sincronizar agora"}
            </Button>
          </div>
        </div>

        {!loading && !status?.configured && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-700">
            Credenciais da Argo ainda nao configuradas no backend
            (ARGO_API_BASE_URL / ARGO_LOGIN / ARGO_PASSWORD no .env). Solicite
            os dados de acesso e preencha o .env para habilitar a sincronizacao.
          </div>
        )}

        {!loading && lastRun && (
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-border/60 bg-muted/20 p-4 text-sm md:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">
                Ultima sincronizacao
              </p>
              <p className="font-semibold text-foreground">
                {formatDateTime(lastRun.finished_at ?? lastRun.started_at)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <p className="font-semibold text-foreground capitalize">
                {lastRun.status.replace("_", " ")}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                Produtos criados/atualizados
              </p>
              <p className="font-semibold text-foreground">
                {lastRun.products_created} / {lastRun.products_updated}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                Saldos de estoque atualizados
              </p>
              <p className="font-semibold text-foreground">
                {lastRun.stock_updated}
              </p>
            </div>
            {lastRun.skipped_no_unit_mapping > 0 && (
              <div className="col-span-2 md:col-span-4">
                <p className="text-xs text-amber-600">
                  {lastRun.skipped_no_unit_mapping} saldo(s) de estoque
                  ignorado(s) por falta de filial vinculada abaixo.
                </p>
              </div>
            )}
            {lastRun.error_message && (
              <div className="col-span-2 md:col-span-4">
                <p
                  className={`text-xs ${lastRun.status === "erro" ? "text-rose-600" : "text-amber-600"}`}
                >
                  {lastRun.error_message}
                </p>
              </div>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={toggleMapping}
        >
          {mappingOpen
            ? "Ocultar vinculos das filiais"
            : "Gerenciar vinculos das filiais"}
        </Button>

        {mappingOpen && mappingLoading && (
          <p className="text-sm text-muted-foreground">Carregando filiais...</p>
        )}

        {mappingOpen && mappingLoaded && (
          <>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                Vincular filiais a Argo
              </p>
              <p className="text-xs text-muted-foreground">
                O ERP Argo identifica cada loja por um numero (o{" "}
                <strong>codigo da empresa</strong>). Para o estoque que vem da
                Argo cair na filial certa, cada filial do sistema precisa estar
                ligada ao numero dela na Argo. Filial sem codigo nao recebe
                estoque.
              </p>
            </div>

            {companiesError && (
              <div className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                {companiesError} Voce ainda pode digitar o codigo manualmente
                abaixo.
              </div>
            )}

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Input
                className="h-9 sm:max-w-xs"
                placeholder="Buscar filial ou codigo"
                value={unitSearch}
                onChange={(event) => setUnitSearch(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {linkedCount} de {units.length} filiais vinculadas
              </p>
            </div>

            <div className="max-h-[480px] overflow-y-auto rounded-xl border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">
                      Filial (nome no sistema)
                    </TableHead>
                    <TableHead>Codigo no sistema</TableHead>
                    <TableHead>Codigo da empresa na Argo</TableHead>
                    <TableHead className="pr-4 text-right">Situacao</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleUnits.map((unit) => (
                    <TableRow key={unit.id}>
                      <TableCell className="pl-4 font-medium text-foreground">
                        {unit.name}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {unit.code}
                      </TableCell>
                      <TableCell>
                        {companies.length > 0 ? (
                          <select
                            className="flex h-9 w-full min-w-[220px] rounded-md border border-input bg-background px-2 text-sm"
                            value={unit.erpCompanyId ?? ""}
                            onChange={(event) =>
                              void handleSaveMapping(
                                unit.id,
                                event.target.value
                                  ? Number(event.target.value)
                                  : null,
                              )
                            }
                            disabled={savingUnitId === unit.id}
                          >
                            <option value="">Nao vinculado</option>
                            {companies.map((company) => (
                              <option
                                key={company.idempresa}
                                value={company.idempresa}
                              >
                                {company.idempresa} -{" "}
                                {company.nomefantasia || company.razaosocial}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              className="h-9 w-28"
                              placeholder="ex.: 5"
                              value={
                                manualInputs[unit.id] ?? unit.erpCompanyId ?? ""
                              }
                              onChange={(event) =>
                                setManualInputs((current) => ({
                                  ...current,
                                  [unit.id]: event.target.value,
                                }))
                              }
                            />
                            {manualInputs[unit.id] !== undefined &&
                              manualInputs[unit.id] !==
                                String(unit.erpCompanyId ?? "") && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={savingUnitId === unit.id}
                                  onClick={() => {
                                    const raw = manualInputs[unit.id];
                                    void handleSaveMapping(
                                      unit.id,
                                      raw ? Number(raw) : null,
                                    );
                                  }}
                                >
                                  Salvar
                                </Button>
                              )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        {unit.erpCompanyId !== null ? (
                          <Badge
                            variant="outline"
                            className="border-emerald-500/40 text-emerald-600"
                          >
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Recebe estoque
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-amber-500/40 text-amber-600"
                          >
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            Sem vinculo
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
