/** "admin" = Gestao (portal completo); "auditor" = Filial. */
export type ManagedUserRole = 'admin' | 'auditor';

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
}

export const ROLE_LABELS: Record<ManagedUserRole, string> = {
  admin: 'Gestao',
  auditor: 'Filial',
};
