/**
 * Executa uma função com retry exponencial.
 * Não faz retry em erros 4xx (exceto 429) — são erros de cliente.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number
    baseDelay?: number
    maxDelay?: number
    onRetry?: (attempt: number, error: unknown) => void
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelay = 500,
    maxDelay = 5000,
    onRetry,
  } = options

  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err: unknown) {
      lastError = err

      // Não retry em erros 4xx (exceto 429 rate limit)
      const status = (err as any)?.status
      if (status >= 400 && status < 500 && status !== 429) {
        throw err
      }

      if (attempt < maxAttempts) {
        const delay = Math.min(
          baseDelay * 2 ** (attempt - 1) + Math.random() * 100,
          maxDelay
        )
        onRetry?.(attempt, err)
        await new Promise(r => setTimeout(r, delay))
      }
    }
  }

  throw lastError
}
