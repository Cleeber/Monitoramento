import type { CheckContext, ValidationResult, Validator } from './types.js'

export const httpStatusValidator: Validator = {
  name: 'http_status',
  async validate(ctx: CheckContext): Promise<ValidationResult> {
    const status = ctx.statusCode

    if (status === null || status === undefined) {
      return {
        validator: 'http_status',
        verdict: 'error',
        weight: 0,
        message: ctx.error || 'Sem resposta HTTP',
      }
    }

    // Se o monitor configura códigos de status esperados, usa ele
    if (ctx.config.expectedStatusCodes && ctx.config.expectedStatusCodes.length > 0) {
      if (ctx.config.expectedStatusCodes.includes(status)) {
        return {
          validator: 'http_status',
          verdict: 'online',
          weight: 2,
          message: `Status HTTP ${status} na lista esperada [${ctx.config.expectedStatusCodes.join(', ')}]`,
          details: { status },
        }
      }
      return {
        validator: 'http_status',
        verdict: 'error',
        weight: 0,
        message: `Status HTTP ${status} fora da lista esperada [${ctx.config.expectedStatusCodes.join(', ')}]`,
        details: { status, expected: ctx.config.expectedStatusCodes },
      }
    }

    // Lógica padrão
    if (status >= 200 && status < 400) {
      return { validator: 'http_status', verdict: 'online', weight: 2, message: `HTTP ${status}`, details: { status } }
    }
    if (status === 403 || status === 401) {
      // WAF ou auth — site está no ar, só bloqueando
      return { validator: 'http_status', verdict: 'online', weight: 2, message: `HTTP ${status} - site online, acesso bloqueado`, details: { status } }
    }
    if (status >= 400 && status < 500) {
      return { validator: 'http_status', verdict: 'error', weight: 0, message: `HTTP ${status} - erro de cliente (recurso não encontrado)`, details: { status } }
    }
    return { validator: 'http_status', verdict: 'error', weight: 0, message: `HTTP ${status} - erro de servidor`, details: { status } }
  },
}
