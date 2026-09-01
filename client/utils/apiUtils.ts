/**
 * Utilitários para requisições à API.
 *
 * O token JWT é armazenado em cookie HttpOnly (enviado automaticamente pelo browser).
 * Este módulo NÃO precisa adicionar header Authorization.
 *
 * Se uma requisição receber 401, o interceptor tenta silent refresh automaticamente.
 * Se o refresh falhar, redireciona para /login.
 */

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  status?: number
}

let logoutCallback: (() => void) | null = null

/** Registra a função de logout para ser chamada quando o token expirar. */
export function onAuthFailure(callback: () => void): void {
  logoutCallback = callback
}

// ─── Interceptor de 401 — silent refresh ────────────────────────────────────

let isRefreshing = false
let refreshQueue: Array<{
  resolve: (token: string) => void
  reject: (err: unknown) => void
}> = []

async function trySilentRefresh(): Promise<string | null> {
  if (isRefreshing) {
    // Já há um refresh em andamento — espera na fila
    return new Promise((resolve, reject) => {
      refreshQueue.push({ resolve, reject })
    })
  }

  isRefreshing = true

  try {
    // Chama o endpoint de refresh (o cookie é enviado automaticamente)
    // Não adiciona Authorization header — usa só o cookie HttpOnly
    const response = await fetch('/api/auth/me', {
      method: 'GET',
      credentials: 'same-origin', // ← envia cookies para mesma origem
    })

    if (response.ok) {
      const data = await response.json()
      isRefreshing = false

      // Notifica todos os requests que estavam na fila
      refreshQueue.forEach(({ resolve }) => resolve(data.token || ''))
      refreshQueue = []

      return data.token || null
    }

    // Refresh falhou
    isRefreshing = false
    refreshQueue.forEach(({ reject }) => reject(new Error('Refresh failed')))
    refreshQueue = []
    return null
  } catch {
    isRefreshing = false
    refreshQueue.forEach(({ reject }) => reject(new Error('Refresh failed')))
    refreshQueue = []
    return null
  }
}

// ─── Fetch principal ─────────────────────────────────────────────────────────

export async function apiRequest<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  // Normaliza URL
  const apiUrl = url.startsWith('/api') ? url : `/api${url}`

  const doFetch = async (): Promise<Response> => {
    return fetch(apiUrl, {
      ...options,
      credentials: 'same-origin', // ← CRÍTICO: envia cookies HttpOnly
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        ...options.headers,
      },
      cache: 'no-store',
    })
  }

  try {
    let response = await doFetch()

    // ── 401: tenta silent refresh e retry ─────────────────────────────────
    if (response.status === 401) {
      const newToken = await trySilentRefresh()

      if (newToken) {
        // Retry com novo token (via cookie — o browser já vai enviar automaticamente)
        response = await doFetch()
      } else {
        // Refresh falhou — deslogar
        logoutCallback?.()
        return { success: false, error: 'Sessão expirada. Faça login novamente.', status: 401 }
      }
    }

    // ── Parse da resposta ────────────────────────────────────────────────
    const contentType = response.headers.get('content-type')
    const isJson = contentType?.includes('application/json')

    if (!response.ok) {
      let errorMessage = `Erro ${response.status}`

      if (isJson) {
        try {
          const errorData = await response.clone().json()
          errorMessage = errorData.message || errorData.error || errorMessage
        } catch {
          // ignora
        }
      } else {
        const text = await response.clone().text()
        if (text.includes('<!DOCTYPE') || text.includes('<html')) {
          errorMessage = 'Erro de conexão com o servidor.'
        }
      }

      return { success: false, error: errorMessage, status: response.status }
    }

    if (isJson) {
      const data = await response.json()
      return { success: true, data, status: response.status }
    }

    const text = await response.text()
    return { success: true, data: text as T, status: response.status }

  } catch (error) {
    console.error('Erro na requisição:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro de conexão',
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export async function apiGet<T = any>(url: string): Promise<ApiResponse<T>> {
  return apiRequest<T>(url, { method: 'GET' })
}

export async function apiPost<T = any>(
  url: string,
  data?: unknown
): Promise<ApiResponse<T>> {
  return apiRequest<T>(url, {
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  })
}

export async function apiPut<T = any>(
  url: string,
  data?: unknown
): Promise<ApiResponse<T>> {
  return apiRequest<T>(url, {
    method: 'PUT',
    body: data ? JSON.stringify(data) : undefined,
  })
}

export async function apiDelete<T = any>(url: string): Promise<ApiResponse<T>> {
  return apiRequest<T>(url, { method: 'DELETE' })
}

export async function apiUpload<T = any>(
  url: string,
  formData: FormData
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(url.startsWith('/api') ? url : `/api${url}`, {
      method: 'POST',
      credentials: 'same-origin',
      body: formData,
    })

    if (response.ok) {
      const data = await response.json()
      return { success: true, data }
    }

    const text = await response.text()
    let error = 'Erro na requisição'
    try {
      const parsed = JSON.parse(text)
      error = parsed.error || parsed.message || error
    } catch {
      error = text || error
    }

    return { success: false, error }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro de conexão',
    }
  }
}
