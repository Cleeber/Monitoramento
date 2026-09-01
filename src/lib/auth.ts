/**
 * Auth utilities — JWT, cookies e refresh tokens.
 *
 * Estratégia:
 * - Access token JWT: 15min, armazenado em cookie HttpOnly (mesma origem)
 * - Refresh token: UUID aleatório com hash no banco, cookie HttpOnly, 7 dias
 * - Cookie flags: httpOnly, sameSite: 'strict', secure (produção)
 */

import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import type { Response } from 'express'

// ─── Config ──────────────────────────────────────────────────────────────────

export const ACCESS_TOKEN_TTL = '15m'
export const REFRESH_TOKEN_TTL_DAYS = 7
export const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined
export const COOKIE_SECURE = process.env.NODE_ENV === 'production'

// ─── JWT ──────────────────────────────────────────────────────────────────────

export interface JwtPayload {
  id: string
  email: string
  role: string
  type: 'access' | 'refresh'
}

export function signAccessToken(payload: Omit<JwtPayload, 'type'>): string {
  return jwt.sign(
    { ...payload, type: 'access' },
    process.env.JWT_SECRET!,
    { expiresIn: ACCESS_TOKEN_TTL }
  )
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload
  } catch {
    return null
  }
}

// ─── Refresh Token hashing ────────────────────────────────────────────────────

/** Hash SHA-256 do refresh token (armazenado no banco, nunca o token em si) */
export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

/** Gera um UUID-like refresh token seguro */
export function generateRefreshToken(): string {
  return `${crypto.randomUUID()}-${crypto.randomUUID()}`
}

// ─── Refresh Token no banco ──────────────────────────────────────────────────

export interface RefreshTokenRow {
  id: string
  user_id: string
  token_hash: string
  expires_at: string
  created_at: string
}

export async function storeRefreshToken(
  supabase: import('@supabase/supabase-js').SupabaseClient<any>,
  userId: string,
  token: string
): Promise<void> {
  const hash = hashRefreshToken(token)
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS)

  await supabase
    .from('refresh_tokens')
    .insert({
      user_id: userId,
      token_hash: hash,
      expires_at: expiresAt.toISOString(),
    })
}

export async function validateRefreshToken(
  supabase: import('@supabase/supabase-js').SupabaseClient<any>,
  token: string
): Promise<{ userId: string; email: string; role: string } | null> {
  const hash = hashRefreshToken(token)

  // 1. Busca o refresh token pelo hash
  const { data: refreshData, error: refreshError } = await supabase
    .from('refresh_tokens')
    .select('user_id, expires_at')
    .eq('token_hash', hash)
    .single()

  if (refreshError || !refreshData) return null

  // 2. Verifica expiração
  if (new Date(refreshData.expires_at) < new Date()) return null

  // 3. Busca dados do usuário
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('id, email, role')
    .eq('id', refreshData.user_id)
    .single()

  if (userError || !userData) return null

  return {
    userId: userData.id,
    email: userData.email,
    role: userData.role,
  }
}

export async function revokeRefreshToken(
  supabase: import('@supabase/supabase-js').SupabaseClient<any>,
  token: string
): Promise<void> {
  const hash = hashRefreshToken(token)
  await supabase.from('refresh_tokens').delete().eq('token_hash', hash)
}

export async function revokeAllUserRefreshTokens(
  supabase: import('@supabase/supabase-js').SupabaseClient<any>,
  userId: string
): Promise<void> {
  await supabase.from('refresh_tokens').delete().eq('user_id', userId)
}

export async function cleanupExpiredRefreshTokens(
  supabase: import('@supabase/supabase-js').SupabaseClient<any>
): Promise<void> {
  await supabase.from('refresh_tokens').delete().lt('expires_at', new Date().toISOString())
}

// ─── Cookie helpers ──────────────────────────────────────────────────────────

/** Seta o cookie HttpOnly com o access token. */
export function setAccessCookie(res: import('express').Response, token: string): void {
  res.cookie('auth_token', token, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000, // 15 minutes
    path: '/',
    domain: COOKIE_DOMAIN,
  })
}

/** Limpa o cookie de access token (logout). */
export function clearAccessCookie(res: import('express').Response): void {
  res.clearCookie('auth_token', {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: 'strict',
    path: '/',
    domain: COOKIE_DOMAIN,
  })
}
