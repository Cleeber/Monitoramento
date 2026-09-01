import type { CheckContext, ValidationResult, Validator } from './types.js'

export const responseTimeValidator: Validator = {
  name: 'response_time',
  async validate(ctx: CheckContext): Promise<ValidationResult> {
    const rt = ctx.responseTime

    if (rt === null || rt === undefined) {
      return { validator: 'response_time', verdict: 'degraded', weight: 1, message: 'Tempo de resposta indisponível' }
    }

    const critical = ctx.config.responseTimeCriticalMs ?? 30000
    const warning = ctx.config.responseTimeWarningMs ?? 5000

    if (rt >= critical) {
      return { validator: 'response_time', verdict: 'error', weight: 0, message: `Tempo crítico: ${rt}ms (>${critical}ms)`, details: { rt, critical } }
    }

    if (rt >= warning) {
      return { validator: 'response_time', verdict: 'degraded', weight: 1, message: `Tempo elevado: ${rt}ms (>${warning}ms)`, details: { rt, warning } }
    }

    return { validator: 'response_time', verdict: 'online', weight: 2, message: `Tempo OK: ${rt}ms`, details: { rt } }
  },
}
