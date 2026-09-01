/**
 * Middleware de autenticação.
 *
 * Lê o JWT do cookie `auth_token` (HttpOnly, SameSite=Strict).
 * Aceita também Authorization: Bearer <token> como fallback (compat).
 *
 * O refresh token (silent refresh) é tratado em uma rota separada:
 * POST /api/auth/refresh
 */

import type { Request, Response, NextFunction } from 'express'
import { verifyToken } from '../lib/auth.js'

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email: string; role: string }
    }
  }
}

/**
 * Middleware padrão para rotas autenticadas.
 * Valida access token (não refresh token).
 *
 * Uso:
 *   app.get('/api/monitors', authenticateToken, async (req, res) => { ... })
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // 1. Tenta ler do cookie
  let token = req.cookies?.auth_token

  // 2. Fallback: Authorization header (compatibilidade)
  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.slice(7)
  }

  if (!token) {
    res.status(401).json({ error: 'Token requerido' })
    return
  }

  const payload = verifyToken(token)
  if (!payload) {
    res.status(401).json({ error: 'Token inválido' })
    return
  }

  // Refresh tokens não devem chegar aqui via middleware normal
  if (payload.type === 'refresh') {
    res.status(401).json({ error: 'Use POST /api/auth/refresh para trocar tokens' })
    return
  }

  req.user = { id: payload.id, email: payload.email, role: payload.role }
  next()
}
