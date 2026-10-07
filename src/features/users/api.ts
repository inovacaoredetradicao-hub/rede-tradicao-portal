import { ManagedUser, ManagedUserInput } from './types';

const DEFAULT_API_BASE_URL = 'http://localhost:4000';
const REQUEST_TIMEOUT_MS = 15000;

function getApiBaseUrl() {
  return (((import.meta as any).env?.VITE_PORTAL_API_BASE_URL as string | undefined) || DEFAULT_API_BASE_URL).replace(/\/$/, '');
}

/** Erro com status HTTP, para a tela tratar sessao expirada (401) separadamente. */
export class UsersApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

// Todas as rotas /admin/users exigem o token da conta master (validado no backend).
async function request<T>(token: string | undefined, path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token ?? ''}`,
        ...init?.headers,
      },
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      throw new UsersApiError(payload.error || `Falha na requisicao (${response.status}).`, response.status);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new UsersApiError('O servidor demorou demais para responder.', 0);
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function listUsers(token: string | undefined) {
  return request<ManagedUser[]>(token, '/admin/users');
}

export function createUser(token: string | undefined, input: ManagedUserInput) {
  return request<ManagedUser>(token, '/admin/users', { method: 'POST', body: JSON.stringify(input) });
}

export function updateUser(token: string | undefined, userId: string, input: Partial<ManagedUserInput> & { isActive?: boolean }) {
  return request<ManagedUser>(token, `/admin/users/${userId}`, { method: 'PATCH', body: JSON.stringify(input) });
}

/** Senha aleatoria legivel (sem 0/O, 1/l/I) para entregar ao usuario. */
export function generatePassword(length = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => chars[byte % chars.length]).join('');
}
