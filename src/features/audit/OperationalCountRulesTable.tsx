import React from 'react';
import { Edit2, Play, Power, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { OperationalRuleListItem } from '@/features/operational-alerts/types';

interface OperationalCountRulesTableProps {
  loading: boolean;
  rules: OperationalRuleListItem[];
  onEdit: (rule: OperationalRuleListItem) => void;
  onToggle: (ruleIds: string[]) => Promise<void>;
  onDelete: (ruleIds: string[]) => Promise<void>;
  onRunScheduler: () => Promise<void>;
}

function formatFrequency(value: OperationalRuleListItem['frequency']) {
  if (value === 'unica') return 'Unica';
  if (value === 'diario') return 'Diario';
  if (value === 'quinzenal') return 'Quinzenal';
  return 'Mensal';
}

// A tabela so identifica o disparo; os produtos de um lote aparecem no "Editar".
function describeRule(rule: OperationalRuleListItem) {
  if (rule.type === 'classification') {
    return { title: rule.title, detail: `Classificacao · ${rule.productCount} produtos` };
  }
  if (rule.productCount > 1) {
    return { title: `Lote de ${rule.productCount} produtos`, detail: 'Produtos especificos' };
  }
  return { title: rule.title, detail: null };
}

export const OperationalCountRulesTable: React.FC<OperationalCountRulesTableProps> = ({
  loading,
  rules,
  onEdit,
  onToggle,
  onDelete,
  onRunScheduler,
}) => {
  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl">Regras cadastradas</CardTitle>
        <CardDescription>Edite rapidamente as regras e use o disparo manual para testar o fluxo com o app mobile.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : rules.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-lg font-semibold text-foreground">Nenhuma regra cadastrada</p>
            <p className="mt-2 text-sm text-muted-foreground">Crie a primeira contagem operacional para começar a disparar alertas ao app.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Disparo</TableHead>
                <TableHead>Filial</TableHead>
                <TableHead>Frequencia</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead>Responsavel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[160px] pr-4 text-left">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => {
                const description = describeRule(rule);
                return (
                <TableRow key={rule.id}>
                  <TableCell className="max-w-72 pl-6">
                    <div className="space-y-0.5">
                      <p className="truncate font-semibold text-foreground" title={description.title}>
                        {description.title}
                      </p>
                      {description.detail && <p className="text-xs text-muted-foreground">{description.detail}</p>}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-52 truncate">{rule.unitName}</TableCell>
                  <TableCell>{formatFrequency(rule.frequency)}</TableCell>
                  <TableCell>{rule.executionDeadlineMinutes} min</TableCell>
                  <TableCell>{rule.responsibleUserName || 'Nao definido'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${rule.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      <span className="text-sm text-muted-foreground">{rule.isActive ? 'Ativo' : 'Inativo'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="pr-4">
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => onEdit(rule)}
                        title={rule.ruleIds.length > 1 ? 'Editar lote (ver produtos)' : 'Editar regra'}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => void onToggle(rule.ruleIds)}
                        title={rule.isActive ? 'Desativar regra' : 'Ativar regra'}
                      >
                        <Power className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="text-rose-600"
                        onClick={() => void onDelete(rule.ruleIds)}
                        title={rule.type === 'classification' ? 'Excluir lote de classificacao' : 'Excluir regra'}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Button size="icon" onClick={() => void onRunScheduler()} title="Disparar teste">
                        <Play className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
