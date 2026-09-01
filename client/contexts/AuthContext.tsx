import React, { createContext, useContext, useEffect, useState } from 'react'
// Removido import não utilizado: supabase
// import { supabase } from '../lib/supabase'

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
  logout: () => void
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

  // Função para verificar se o token é válido
  const isTokenValid = (token: string): boolean => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      const now = Math.floor(Date.now() / 1000)
      return payload.exp > now
    } catch (error) {
      console.error('Erro ao validar token:', error)
      return false
    }
  }

  useEffect(() => {
    // Verificar se há um token salvo no localStorage
    const token = localStorage.getItem('auth_token')
    const userData = localStorage.getItem('user_data')
    
    if (token && userData) {
      // Verificar se o token ainda é válido
      if (isTokenValid(token)) {
        try {
          const parsedUser = JSON.parse(userData)
          setUser(parsedUser)
          console.log('Token válido encontrado, usuário autenticado:', parsedUser.email)
        } catch (error) {
          console.error('Erro ao parsear dados do usuário:', error)
          localStorage.removeItem('auth_token')
          localStorage.removeItem('user_data')
        }
      } else {
        console.log('Token expirado, removendo do localStorage')
        localStorage.removeItem('auth_token')
        localStorage.removeItem('user_data')
      }
    } else {
      console.log('Nenhum token encontrado no localStorage')
    }
    
    setLoading(false)
  }, [])

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setLoading(true)
      
      console.log('Fazendo login para:', email)
      console.log('URL da API:', `/api/auth/login`)
      
      // Fazer requisição para o backend para autenticação
      const response = await fetch(`/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      console.log('Status da resposta:', response.status)
      console.log('Headers da resposta:', response.headers)
      
      // Verificar se a resposta é válida antes de tentar fazer parse
      const responseText = await response.text()
      console.log('Resposta raw:', responseText)
      
      let data
      try {
        data = JSON.parse(responseText)
      } catch (parseError) {
        console.error('Erro ao fazer parse do JSON:', parseError)
        console.error('Resposta recebida:', responseText)
        return { success: false, error: 'Resposta inválida do servidor' }
      }

      if (!response.ok) {
        return { success: false, error: data.message || data.error || 'Erro ao fazer login' }
      }

      // Salvar token e dados do usuário
      localStorage.setItem('auth_token', data.token)
      localStorage.setItem('user_data', JSON.stringify(data.user))
      setUser(data.user)

      return { success: true }
    } catch (error) {
      console.error('Erro no login:', error)
      return { success: false, error: 'Erro de conexão com o servidor' }
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user_data')
    setUser(null)
  }

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