// Sessao do portal: o AuthContext grava o perfil (com o token) aqui no localStorage, e
// todas as chamadas a API leem o token daqui. Toda a API exige login, inclusive o
// backend de alertas (4001), que valida o mesmo token emitido no login (4000).
export const SESSION_STORAGE_KEY = 'portal-auditoria:session';
export const UNAUTHORIZED_EVENT = 'portal:unauthorized';

export function getSessionToken(): string | undefined {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? ((JSON.parse(raw) as { token?: string }).token ?? undefined) : undefined;
  } catch {
    return undefined;
  }
}

export function authHeaders(): Record<string, string> {
  const token = getSessionToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Avisa o AuthContext que a sessao expirou (resposta 401), para voltar ao login. */
export function notifyIfUnauthorized(response: Response) {
  if (response.status === 401) {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }
  return response;
}

/** Para links abertos direto no navegador (ex.: PDF), que nao conseguem mandar header. */
export function withTokenQuery(url: string) {
  const token = getSessionToken();
  if (!token) return url;
  return `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
}
