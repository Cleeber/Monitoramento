/**
 * Utilitários para requisições à API
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
}

/**
 * Função para fazer requisições à API com tratamento consistente de erros
 */
export async function apiRequest<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const token = localStorage.getItem('auth_token');
    
    const defaultHeaders: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };

    const response = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    });

    // Verificar se a resposta é JSON válido
    const contentType = response.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');

    if (!response.ok) {
      let errorMessage = `Erro ${response.status}`;
      
      if (isJson) {
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          // Se não conseguir fazer parse do JSON, usar mensagem padrão
        }
      } else {
        // Se a resposta não é JSON, pode ser uma página de erro HTML
        const textResponse = await response.text();
        if (textResponse.includes('<!DOCTYPE') || textResponse.includes('<html')) {
          errorMessage = 'Erro de conexão com o servidor. Verifique se o backend está rodando.';
        } else {
          errorMessage = textResponse || errorMessage;
        }
      }

      return {
        success: false,
        error: errorMessage,
        status: response.status,
      };
    }

    // Resposta bem-sucedida
    if (isJson) {
      try {
        const data = await response.json();
        return {
          success: true,
          data,
          status: response.status,
        };
      } catch (error) {
        return {
          success: false,
          error: 'Erro ao processar resposta do servidor',
          status: response.status,
        };
      }
    } else {
      // Resposta não-JSON (ex: texto simples, arquivo, etc.)
      const text = await response.text();
      return {
        success: true,
        data: text as T,
        status: response.status,
      };
    }
  } catch (error) {
    console.error('Erro na requisição:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro de conexão',
    };
  }
}

/**
 * Função específica para requisições GET
 */
export async function apiGet<T = any>(url: string): Promise<ApiResponse<T>> {
  return apiRequest<T>(url, { method: 'GET' });
}

/**
 * Função específica para requisições POST
 */
export async function apiPost<T = any>(
  url: string,
  data?: any
): Promise<ApiResponse<T>> {
  return apiRequest<T>(url, {
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * Função específica para requisições PUT
 */
export async function apiPut<T = any>(
  url: string,
  data?: any
): Promise<ApiResponse<T>> {
  return apiRequest<T>(url, {
    method: 'PUT',
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * Função específica para requisições DELETE
 */
export async function apiDelete<T = any>(url: string): Promise<ApiResponse<T>> {
  return apiRequest<T>(url, { method: 'DELETE' });
}

/**
 * Função específica para upload de arquivos
 */
export async function apiUpload<T = any>(url: string, formData: FormData): Promise<ApiResponse<T>> {
  const token = localStorage.getItem('auth_token');
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` })
      },
      body: formData
    });

    if (response.ok) {
      const data = await response.json();
      return { success: true, data };
    } else {
      const errorText = await response.text();
      let error = 'Erro na requisição';
      
      try {
        const errorData = JSON.parse(errorText);
        error = errorData.error || errorData.message || error;
      } catch {
        error = errorText || error;
      }
      
      return { success: false, error };
    }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro de conexão' 
    };
  }
}