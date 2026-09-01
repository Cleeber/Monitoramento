import type { CheckContext, ValidationResult, Validator } from './types.js'

export const keywordValidator: Validator = {
  name: 'keywords',
  async validate(ctx: CheckContext): Promise<ValidationResult> {
    const body = ctx.responseBody ?? ''
    const cfg = ctx.config

    const hasExpected = cfg.expectedKeywords && cfg.expectedKeywords.length > 0
    const hasForbidden = cfg.forbiddenKeywords && cfg.forbiddenKeywords.length > 0

    if (!hasExpected && !hasForbidden) {
      return { validator: 'keywords', verdict: 'online', weight: 2, message: 'Keywords não configuradas' }
    }

    const failures: string[] = []

    if (hasExpected) {
      for (const kw of cfg.expectedKeywords!) {
        if (!body.includes(kw)) {
          failures.push(`Esperada: "${kw}"`)
        }
      }
    }

    if (hasForbidden) {
      for (const kw of cfg.forbiddenKeywords!) {
        if (body.includes(kw)) {
          failures.push(`Proibida: "${kw}"`)
        }
      }
    }

    if (failures.length > 0) {
      return {
        validator: 'keywords',
        verdict: 'error',
        weight: 0,
        message: `Keywords: ${failures.join('; ')}`,
        details: { failures },
      }
    }

    const found = hasExpected
      ? cfg.expectedKeywords!.filter(k => body.includes(k))
      : []

    return {
      validator: 'keywords',
      verdict: 'online',
      weight: 2,
      message: found.length > 0
        ? `Keywords: ${found.map(k => `"${k}"`).join(', ')}`
        : 'Keywords verificadas - OK',
      details: { found },
    }
  },
}
