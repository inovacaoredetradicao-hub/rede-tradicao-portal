import { NextFunction, Request, Response } from 'express';
import { query } from './db.js';

const SESSION_DAYS = 30;

// O login acontece no backend do app (porta 4000), que grava a sessao na tabela
// user_sessions do mesmo banco. Aqui so validamos o token recebido.
function getRequestToken(request: Request) {
  const header = String(request.headers.authorization ?? '');
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return typeof request.query.token === 'string' ? request.query.token.trim() : '';
}

export async function requireSession(request: Request, response: Response, next: NextFunction) {
  if (request.method === 'OPTIONS') {
    next();
    return;
  }

  const token = getRequestToken(request);
  if (!token) {
    response.status(401).json({ message: 'Sessao expirada ou invalida. Entre novamente.' });
    return;
  }

  try {
    // Mesma regra de sessao deslizante do backend do app.
    const result = await query<{ id: string; name: string; username: string; role: string }>(
      `
        WITH session AS (
          UPDATE user_sessions s
          SET expires_at = CASE
            WHEN s.expires_at < NOW() + ($2 || ' days')::interval / 2 THEN NOW() + ($2 || ' days')::interval
            ELSE s.expires_at
          END
          WHERE s.token = $1 AND s.expires_at > NOW()
          RETURNING s.user_id
        )
        SELECT u.id, u.name, u.username, u.role
        FROM session
        JOIN users u ON u.id = session.user_id
        WHERE u.is_active
      `,
      [token, String(SESSION_DAYS)],
    );

    const user = result.rows[0];
    if (!user) {
      response.status(401).json({ message: 'Sessao expirada ou invalida. Entre novamente.' });
      return;
    }

    response.locals.sessionUser = user;
    next();
  } catch (error) {
    next(error);
  }
}
