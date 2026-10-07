import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Copy, KeyRound, Pencil, Search, ShieldCheck, UserPlus } from 'lucide-react';
import { useAuth } from '@/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getUnitsErpMapping } from '@/features/products/api';
import { UnitErpMapping } from '@/features/products/types';
import { createUser, generatePassword, listUsers, updateUser, UsersApiError } from './api';
import { ManagedUser, ManagedUserRole, ROLE_LABELS } from './types';

const unitLabel = (unit: { name: string; erpCompanyId: number | null }) =>
  unit.erpCompanyId !== null ? `${String(unit.erpCompanyId).padStart(2, '0')} - ${unit.name}` : unit.name;

interface FormState {
  name: string;
  username: string;
  password: string;
  role: ManagedUserRole;
  unitIds: string[];
  isActive: boolean;
}

const EMPTY_FORM: FormState = { name: '', username: '', password: '', role: 'auditor', unitIds: [], isActive: true };

export const UsersAdminPage: React.FC = () => {
  const { profile, logout } = useAuth();
  const token = profile?.token;

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [units, setUnits] = useState<UnitErpMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'todos' | ManagedUserRole>('todos');
  const [showInactive, setShowInactive] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [unitSearch, setUnitSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [credentials, setCredentials] = useState<{ username: string; password: string } | null>(null);

  const handleError = (error: unknown, fallback: string) => {
    if (error instanceof UsersApiError && error.status === 401) {
      toast.error('Sua sessao expirou. Entre novamente no portal.');
      logout();
      return;
    }
    toast.error(error instanceof Error ? error.message : fallback);
  };

  const load = async () => {
    setLoading(true);
    try {
      const [userRows, unitRows] = await Promise.all([listUsers(token), getUnitsErpMapping()]);
      setUsers(userRows);
      setUnits(
        [...unitRows].sort(
          (a, b) => (a.erpCompanyId ?? Infinity) - (b.erpCompanyId ?? Infinity) || a.name.localeCompare(b.name),
        ),
      );
    } catch (error) {
      handleError(error, 'Nao foi possivel carregar os usuarios.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const visibleUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter(
      (user) =>
        (showInactive || user.isActive) &&
        (roleFilter === 'todos' || user.role === roleFilter) &&
        (!term ||
          user.name.toLowerCase().includes(term) ||
          user.username.toLowerCase().includes(term) ||
          user.units.some((unit) => unitLabel(unit).toLowerCase().includes(term))),
    );
  }, [users, search, roleFilter, showInactive]);

  const pickerUnits = useMemo(() => {
    const term = unitSearch.trim().toLowerCase();
    return term ? units.filter((unit) => unitLabel(unit).toLowerCase().includes(term)) : units;
  }, [units, unitSearch]);

  const openCreate = () => {
    setEditingUser(null);
    setForm({ ...EMPTY_FORM, password: generatePassword() });
    setUnitSearch('');
    setDialogOpen(true);
  };

  const openEdit = (user: ManagedUser) => {
    setEditingUser(user);
    setForm({
      name: user.name,
      username: user.username,
      password: '',
      role: user.role,
      unitIds: user.units.map((unit) => unit.id),
      isActive: user.isActive,
    });
    setUnitSearch('');
    setDialogOpen(true);
  };

  const toggleUnit = (unitId: string) =>
    setForm((current) => ({
      ...current,
      unitIds: current.unitIds.includes(unitId)
        ? current.unitIds.filter((id) => id !== unitId)
        : [...current.unitIds, unitId],
    }));

  const handleSave = async () => {
    if (!form.name.trim() || !form.username.trim()) {
      toast.error('Preencha nome e login.');
      return;
    }
    if (!editingUser && form.password.trim().length < 6) {
      toast.error('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    if (form.role === 'auditor' && form.unitIds.length === 0) {
      toast.error('Usuario de filial precisa ter ao menos uma filial marcada.');
      return;
    }

    setSaving(true);
    try {
      const password = form.password.trim();
      if (editingUser) {
        await updateUser(token, editingUser.id, {
          name: form.name.trim(),
          role: form.role,
          unitIds: form.unitIds,
          ...(editingUser.isMaster ? {} : { isActive: form.isActive }),
          ...(password ? { password } : {}),
        });
        toast.success('Usuario atualizado.');
      } else {
        await createUser(token, {
          name: form.name.trim(),
          username: form.username.trim().toLowerCase(),
          password,
          role: form.role,
          unitIds: form.unitIds,
        });
        toast.success('Usuario criado.');
      }

      setDialogOpen(false);
      if (password) {
        setCredentials({ username: (editingUser?.username ?? form.username).trim().toLowerCase(), password });
      }
      await load();
    } catch (error) {
      handleError(error, 'Nao foi possivel salvar o usuario.');
    } finally {
      setSaving(false);
    }
  };

  const copyCredentials = async () => {
    if (!credentials) return;
    const text = `Login: ${credentials.username}\nSenha: ${credentials.password}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Login e senha copiados.');
    } catch {
      toast.error('Nao foi possivel copiar. Selecione e copie manualmente.');
    }
  };

  const activeCount = users.filter((user) => user.isActive).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Usuarios</h1>
          <p className="text-sm text-muted-foreground">
            Crie e gerencie os acessos ao app e ao portal. <strong>Gestao</strong> acessa o portal completo;{' '}
            <strong>Filial</strong> acessa as filiais marcadas.
          </p>
        </div>
        <Button type="button" onClick={openCreate}>
          <UserPlus className="mr-2 h-4 w-4" />
          Novo usuario
        </Button>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative w-full lg:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-10"
            placeholder="Buscar por nome, login ou filial"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={roleFilter}
          onChange={(event) => setRoleFilter(event.target.value as 'todos' | ManagedUserRole)}
        >
          <option value="todos">Todos os perfis</option>
          <option value="admin">Gestao</option>
          <option value="auditor">Filial</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={showInactive}
            onChange={(event) => setShowInactive(event.target.checked)}
          />
          Mostrar inativos
        </label>
        <p className="text-xs text-muted-foreground lg:ml-auto">
          {activeCount} ativo(s) de {users.length}
        </p>
      </div>

      <div className="rounded-xl border border-border/60">
        {loading ? (
          <p className="p-6 text-sm text-muted-foreground">Carregando usuarios...</p>
        ) : visibleUsers.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Nenhum usuario encontrado.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Nome</TableHead>
                <TableHead>Login</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Filiais</TableHead>
                <TableHead>Situacao</TableHead>
                <TableHead className="pr-4 text-right">Acao</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleUsers.map((user) => (
                <TableRow key={user.id} className={user.isActive ? '' : 'opacity-60'}>
                  <TableCell className="pl-4 font-medium text-foreground">{user.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{user.username}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline">{ROLE_LABELS[user.role] ?? user.role}</Badge>
                      {user.isMaster && (
                        <Badge variant="outline" className="border-primary/40 text-primary">
                          <ShieldCheck className="mr-1 h-3 w-3" />
                          Master
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[280px] text-xs text-muted-foreground">
                    {user.units.length === 0
                      ? user.role === 'admin'
                        ? 'Todas (Gestao)'
                        : 'Nenhuma'
                      : user.units.length <= 3
                        ? user.units.map(unitLabel).join(', ')
                        : `${user.units.slice(0, 2).map(unitLabel).join(', ')} e mais ${user.units.length - 2}`}
                  </TableCell>
                  <TableCell>
                    {user.isActive ? (
                      <Badge variant="outline" className="border-emerald-500/40 text-emerald-600">
                        Ativo
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Inativo
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <Button type="button" variant="outline" size="sm" onClick={() => openEdit(user)}>
                      <Pencil className="mr-1 h-3.5 w-3.5" />
                      Editar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => !saving && setDialogOpen(open)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Editar usuario' : 'Novo usuario'}</DialogTitle>
            <DialogDescription>
              {editingUser ? editingUser.username : 'O login e a senha sao usados tanto no app quanto no portal.'}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="user-name">Nome</Label>
                <Input
                  id="user-name"
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Ex.: Maria Souza"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="user-login">Login</Label>
                <Input
                  id="user-login"
                  value={form.username}
                  disabled={Boolean(editingUser)}
                  onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
                  placeholder="Ex.: maria.filial05 ou e-mail"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="user-password">{editingUser ? 'Nova senha (deixe em branco para manter)' : 'Senha'}</Label>
              <div className="flex gap-2">
                <Input
                  id="user-password"
                  value={form.password}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                  placeholder={editingUser ? 'Manter a senha atual' : 'Minimo 6 caracteres'}
                  className="font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setForm((current) => ({ ...current, password: generatePassword() }))}
                >
                  <KeyRound className="mr-1 h-4 w-4" />
                  Gerar
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Perfil</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {(['auditor', 'admin'] as ManagedUserRole[]).map((role) => (
                  <button
                    key={role}
                    type="button"
                    disabled={editingUser?.isMaster && role !== 'admin'}
                    onClick={() => setForm((current) => ({ ...current, role }))}
                    className={`rounded-lg border p-3 text-left text-sm transition-colors disabled:opacity-50 ${
                      form.role === role ? 'border-primary bg-primary/5' : 'border-border bg-background'
                    }`}
                  >
                    <p className="font-semibold text-foreground">{ROLE_LABELS[role]}</p>
                    <p className="text-xs text-muted-foreground">
                      {role === 'admin'
                        ? 'Portal completo: contagens, produtos e relatorios de todas as filiais.'
                        : 'Usa o app e recebe disparos das filiais marcadas abaixo.'}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label>
                  Filiais {form.role === 'admin' && <span className="font-normal text-muted-foreground">(opcional para Gestao)</span>}
                </Label>
                <span className="text-xs text-muted-foreground">{form.unitIds.length} marcada(s)</span>
              </div>
              <div className="flex gap-2">
                <Input
                  className="h-8"
                  placeholder="Buscar filial (ex.: 05, Matriz)"
                  value={unitSearch}
                  onChange={(event) => setUnitSearch(event.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      unitIds: Array.from(new Set([...current.unitIds, ...pickerUnits.map((unit) => unit.id)])),
                    }))
                  }
                >
                  Marcar {unitSearch ? 'filtradas' : 'todas'}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setForm((current) => ({ ...current, unitIds: [] }))}>
                  Limpar
                </Button>
              </div>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-border">
                {pickerUnits.map((unit) => (
                  <label
                    key={unit.id}
                    className="flex cursor-pointer items-center gap-2 border-b border-border/40 px-3 py-1.5 text-sm last:border-b-0 hover:bg-muted/30"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={form.unitIds.includes(unit.id)}
                      onChange={() => toggleUnit(unit.id)}
                    />
                    <span className="truncate">{unitLabel(unit)}</span>
                  </label>
                ))}
                {pickerUnits.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">Nenhuma filial.</p>}
              </div>
            </div>

            {editingUser && !editingUser.isMaster && (
              <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Usuario ativo</p>
                  <p className="text-xs text-muted-foreground">Inativo nao consegue entrar no app nem no portal.</p>
                </div>
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(checked) => setForm((current) => ({ ...current, isActive: checked }))}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Salvando...' : editingUser ? 'Salvar alteracoes' : 'Criar usuario'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!credentials} onOpenChange={(open) => !open && setCredentials(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Acesso para entregar ao usuario</DialogTitle>
            <DialogDescription>Anote ou copie agora: por seguranca, a senha nao pode ser consultada depois.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1 rounded-lg border border-border bg-muted/30 p-3 font-mono text-sm">
            <p>Login: {credentials?.username}</p>
            <p>Senha: {credentials?.password}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => void copyCredentials()}>
              <Copy className="mr-2 h-4 w-4" />
              Copiar
            </Button>
            <Button onClick={() => setCredentials(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
