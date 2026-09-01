import type { CheckContext, ValidationResult, Validator } from './types.js'

export const contentValidator: Validator = {
  name: 'content',
  async validate(ctx: CheckContext): Promise<ValidationResult> {
    const body = ctx.responseBody

    if (!body) {
      return { validator: 'content', verdict: 'error', weight: 0, message: 'Sem corpo de resposta para validar' }
    }

    const failures: string[] = []
    const warnings: string[] = []

    // Estrutura HTML mínima
    if (ctx.config.requireHtml !== false) {
      const hasDoctype = /^<!doctype\s+html/i.test(body)
      const hasHtmlTag = /<(?:html|head|body)/i.test(body)
      if (!hasDoctype && !hasHtmlTag) {
        failures.push('HTML sem DOCTYPE nem tags estruturais (<html>, <head>, <body>)')
      }
    }

    // CSS
    if (ctx.config.requireCss) {
      const hasStylesheet = /<link[^>]+rel=["']stylesheet["'][^>]*>/i.test(body)
      const hasInlineStyle = /<style[^>]*>/i.test(body)
      if (!hasStylesheet && !hasInlineStyle) {
        warnings.push('CSS: sem <link rel="stylesheet"> nem <style>')
      }
    }

    // JavaScript
    if (ctx.config.requireJs) {
      const hasScript = /<script[^>]*>/i.test(body)
      if (!hasScript) {
        warnings.push('JavaScript: sem <script>')
      }
    }

    // Tamanho mínimo de conteúdo
    const minContent = ctx.config.minContentLength ?? 1000
    if (body.length < minContent) {
      failures.push(`Conteúdo curto: ${body.length} chars (mín: ${minContent})`)
    }

    // Texto mínimo (HTML stripado)
    const minText = ctx.config.minTextLength ?? 100
    const textOnly = body.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
    if (textOnly.length < minText) {
      failures.push(`Texto curto: ${textOnly.length} chars (mín: ${minText})`)
    }

    // Pattern OK (regex que DEVE casar)
    if (ctx.config.contentPatternOk) {
      try {
        if (!new RegExp(ctx.config.contentPatternOk).test(body)) {
          failures.push(`Pattern OK '${ctx.config.contentPatternOk}' não encontrado`)
        }
      } catch { /* regex inválido */ }
    }

    // Pattern FAIL (regex que NÃO DEVE casar)
    if (ctx.config.contentPatternFail) {
      try {
        if (new RegExp(ctx.config.contentPatternFail).test(body)) {
          failures.push(`Pattern FAIL '${ctx.config.contentPatternFail}' encontrado`)
        }
      } catch { /* regex inválido */ }
    }

    if (failures.length > 0) {
      return {
        validator: 'content',
        verdict: 'error',
        weight: 0,
        message: `Validação falhou: ${failures.join('; ')}`,
        details: { failures, bodyLength: body.length, textLength: textOnly.length },
      }
    }

    if (warnings.length > 0) {
      return {
        validator: 'content',
        verdict: 'degraded',
        weight: 1,
        message: `Conteúdo válido com avisos: ${warnings.join('; ')}`,
        details: { warnings, bodyLength: body.length, textLength: textOnly.length },
      }
    }

    return {
      validator: 'content',
      verdict: 'online',
      weight: 2,
      message: `Conteúdo OK (${body.length} chars, ${textOnly.length} texto)`,
      details: { bodyLength: body.length, textLength: textOnly.length },
    }
  },
}
