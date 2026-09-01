/**
 * Tipos para o sistema de validação de monitores.
 * Arquitetura: cada validador retorna peso 0-2.
 * Peso 2 = passou, 1 = degraded, 0 = error.
 */
export type Verdict = 'online' | 'degraded' | 'error' | 'offline'

export interface ValidationResult {
  validator: string
  verdict: Verdict
  weight: number  // 0, 1 ou 2
  message: string
  details?: Record<string, unknown>
}

export interface Validator {
  name: string
  validate(ctx: CheckContext): Promise<ValidationResult>
}

export interface CheckContext {
  url: string
  statusCode: number | null
  responseTime: number | null
  responseHeaders: Record<string, string>
  responseBody: string | null
  error: string | null
  isTimeout: boolean
  isDnsFail: boolean
  isConnectionRefused: boolean
  isSslError: boolean
  monitorId: string
  monitorName: string
  config: MonitorValidationConfig
}

export interface MonitorValidationConfig {
  // HTTP Status
  expectedStatusCodes?: number[]
  // Keyword validation
  expectedKeywords?: string[]
  forbiddenKeywords?: string[]
  // API health check
  apiHealthEnabled?: boolean
  apiHealthPath?: string
  apiHealthExpectedStatus?: number
  apiHealthExpectedBody?: string
  // SSL
  checkSsl?: boolean
  // Content structure
  contentPatternOk?: string
  contentPatternFail?: string
  requireCss?: boolean
  requireJs?: boolean
  requireHtml?: boolean
  // Thresholds
  responseTimeWarningMs?: number
  responseTimeCriticalMs?: number
  // Content size
  minContentLength?: number
  minTextLength?: number
}

export interface CheckOutcome {
  verdict: Verdict
  responseTime: number | null
  statusCode: number | null
  error: string | null
  validations: ValidationResult[]
  totalWeight: number
  maxWeight: number
  timestamp: string
}

export function calculateFinalVerdict(validations: ValidationResult[]): {
  verdict: Verdict
  totalWeight: number
  maxWeight: number
} {
  const totalWeight = validations.reduce((sum, v) => sum + v.weight, 0)
  const maxWeight = validations.length * 2
  const hasErrors = validations.some(v => v.weight === 0)
  const hasDegraded = validations.some(v => v.weight === 1)
  if (hasErrors) return { verdict: 'error', totalWeight, maxWeight }
  if (hasDegraded) return { verdict: 'degraded', totalWeight, maxWeight }
  return { verdict: 'online', totalWeight, maxWeight }
}
