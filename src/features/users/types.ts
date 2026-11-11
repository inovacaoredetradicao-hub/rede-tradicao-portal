/** "admin" = Gestao (portal completo); "auditor" = Filial; "rh" = RH da matriz (no app so ve Uniformes). */
export type ManagedUserRole = 'admin' | 'auditor' | 'rh';

export interface ManagedUserUnit {
  id: string;
  name: string;
  erpCompanyId: number | null;
}

export interface ManagedUser {
  id: string;
  name: string;
  username: string;
  role: ManagedUserRole;
  isActive: boolean;
  isMaster: boolean;
  createdAt: string;
  units: ManagedUserUnit[];
}

export interface ManagedUserInput {
  name: string;
  username: string;
  password?: string;
  role: ManagedUserRole;
  unitIds: string[];
  /** Master: pode criar e gerenciar usuarios (sempre com perfil Gestao). */
  isMaster?: boolean;
}

export const ROLE_LABELS: Record<ManagedUserRole, string> = {
  admin: 'Gestao',
  auditor: 'Filial',
  rh: 'RH (Matriz)',
};
