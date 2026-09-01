import type { CheckContext, ValidationResult, Validator } from './types.js'
import axios from 'axios'

export const apiHealthValidator: Validator = {
  name: 'api_health',
  async validate(ctx: CheckContext): Promise<ValidationResult> {
    const cfg = ctx.config

    if (!cfg.apiHealthEnabled || !cfg.apiHealthPath) {
      return { validator: 'api_health', verdict: 'online', weight: 2, message: 'Health check não configurado' }
    }

    try {
      const baseUrl = new URL(ctx.url).origin
      const healthUrl = `${baseUrl}${cfg.apiHealthPath}`

      const response = await axios.get(healthUrl, {
        timeout: cfg.responseTimeCriticalMs ?? 30000,
        validateStatus: () => true,
      })

      const expectedStatus = cfg.apiHealthExpectedStatus ?? 200

      if (response.status !== expectedStatus) {
        return {
          validator: 'api_health',
          verdict: 'error',
          weight: 0,
          message: `Health retornou ${response.status}, esperado ${expectedStatus}`,
          details: { status: response.status, expected: expectedStatus },
        }
      }

      if (cfg.apiHealthExpectedBody) {
        const body = typeof response.data === 'string' ? response.data : JSON.stringify(response.data)
        if (!body.includes(cfg.apiHealthExpectedBody)) {
          return {
            validator: 'api_health',
            verdict: 'error',
            weight: 0,
            message: `Health body sem "${cfg.apiHealthExpectedBody}"`,
            details: { expectedBody: cfg.apiHealthExpectedBody },
          }
        }
      }

      return { validator: 'api_health', verdict: 'online', weight: 2, message: `Health OK: ${healthUrl}`, details: { status: response.status } }
    } catch (err) {
      return { validator: 'api_health', verdict: 'error', weight: 0, message: `Health falhou: ${err instanceof Error ? err.message : String(err)}` }
    }
  },
}
