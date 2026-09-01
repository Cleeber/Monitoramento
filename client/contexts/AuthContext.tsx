/**
 * Auth Context — gerencia autenticação do usuário.
 *
 * O JWT é armazenado em cookie HttpOnly (via backend).
 * Este contexto mantém o estado do usuário em memória.
 *
 * Na inicialização, tenta validar a sessão chamando /api/auth/me
 * (o cookie é enviado automaticamente pelo browser).
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { onAuthFailure } from '../utils/apiUtils'

interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'user'
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // ── Registra callback de falha de auth (para o interceptor) ───────────────
  useEffect(() => {
    const unsubscribe = onAuthFailure(() => {
      setUser(null)
    })
    return unsubscribe
  }, [])

  // ── Na inicialização: valida sessão via /api/auth/me ────────────────────
  useEffect(() => {
    async function validateSession() {
      try {
        const response = await fetch('/api/auth/me', {
          method: 'GET',
          credentials: 'same-origin', // ← envia o cookie HttpOnly
        })

        if (response.ok) {
          const data = await response.json()
          if (data.user) {
            setUser(data.user)
          } else {
            setUser(null)
          }
        } else {
          setUser(null)
        }
      } catch {
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    validateSession()
  }, [])

  // ── Login ───────────────────────────────────────────────────────────────
  const login = useCallback(async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      setLoading(true)

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'same-origin', // ← recebe o cookie
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        return { success: false, error: errorData.error || 'Erro ao fazer login' }
      }

      const data = await response.json()
      if (data.user) {
        setUser(data.user)
      }

      return { success: true }
    } catch (error) {
      console.error('[AUTH] Login error:', error)
      return { success: false, error: 'Erro de conexão com o servidor' }
    } finally {
      setLoading(false)
    }
  }, [])

  // ── Logout ─────────────────────────────────────────────────────────────
  const logout = useCallback(async (): Promise<void> => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
      })
    } catch (error) {
      console.error('[AUTH] Logout error:', error)
    } finally {
      setUser(null)
    }
  }, [])

  const value: AuthContextType = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
