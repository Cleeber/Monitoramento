import type { CheckContext, ValidationResult, Validator } from './types.js'

// Páginas de erro padrão de servidores web e plataformas
const ERROR_PAGE_PATTERNS: Array<{ pattern: RegExp; server: string }> = [
  // Nginx
  { pattern: /<hr><center>nginx<\/center>/i, server: 'Nginx default' },
  { pattern: /<title>403 Forbidden<\/title>/i, server: 'Nginx 403' },
  { pattern: /<title>404 Not Found<\/title>/i, server: 'Nginx 404' },
  // Apache
  { pattern: /<h1>403 Forbidden<\/h1>/i, server: 'Apache 403' },
  { pattern: /<h1>404 Not Found<\/h1>/i, server: 'Apache 404' },
  // IIS
  { pattern: /403 - Forbidden: Access is denied/i, server: 'IIS 403' },
  { pattern: /The resource you are looking for has been removed/i, server: 'IIS 404' },
  // Cloudflare
  { pattern: /<title>Access denied<\/title>/i, server: 'Cloudflare WAF' },
  { pattern: /<title>Attention required! \| Cloudflare<\/title>/i, server: 'Cloudflare Challenge' },
  { pattern: /Checking your browser before accessing/i, server: 'Cloudflare DDoS' },
  { pattern: /Just a moment\.\.\.<\/title>/i, server: 'Cloudflare CAPTCHA' },
  // AWS
  { pattern: /<Title>403 ERROR<\/Title>/i, server: 'AWS CloudFront' },
  { pattern: /<Title>Access Denied<\/Title>/i, server: 'AWS S3' },
  { pattern: /<Message>Access Denied<\/Message>/i, server: 'AWS S3' },
  // Vercel
  { pattern: /<title>404: NOT_FOUND<\/title>/i, server: 'Vercel 404' },
  { pattern: /<title>Something went wrong<\/title>/i, server: 'Vercel Error' },
  // Netlify
  { pattern: /<title>Page not found<\/title>/i, server: 'Netlify 404' },
  { pattern: /<title>Not Found<\/title>/i, server: 'Netlify 404' },
  // Heroku
  { pattern: /<h1>403 Forbidden<\/h1>/i, server: 'Heroku 403' },
  { pattern: /<h1>404 Not Found<\/h1>/i, server: 'Heroku 404' },
  // WordPress
  { pattern: /<title>Error establishing a database connection<\/title>/i, server: 'WordPress DB Error' },
  // Drupal
  { pattern: /<title>The website encountered an unexpected error<\/title>/i, server: 'Drupal Error' },
  // Genéricos
  { pattern: /<title>Internal Server Error<\/title>/i, server: 'Generic 500' },
  { pattern: /<h1>500 Internal Server Error<\/h1>/i, server: 'Generic 500' },
  { pattern: /<title>503 Service Unavailable<\/title>/i, server: 'Generic 503' },
  { pattern: /<h1>503 Service Unavailable<\/h1>/i, server: 'Generic 503' },
  { pattern: /<title>Bad Gateway<\/title>/i, server: 'Generic 502' },
  { pattern: /<title>Gateway Timeout<\/title>/i, server: 'Generic 504' },
  // Manutenção
  { pattern: /<title>Site em manuten/i, server: 'Maintenance BR' },
  { pattern: /site is currently under maintenance/i, server: 'Maintenance EN' },
  { pattern: /<title>under construction<\/title>/i, server: 'Under Construction' },
  // Empty HTML
  { pattern: /^<!doctype html><html><head><title><\/title><\/head><body><\/body><\/html>$/is, server: 'Empty HTML' },
]

export const errorPageValidator: Validator = {
  name: 'error_page',
  async validate(ctx: CheckContext): Promise<ValidationResult> {
    if (!ctx.responseBody) {
      return { validator: 'error_page', verdict: 'error', weight: 0, message: 'Sem corpo de resposta para validar' }
    }

    const body = ctx.responseBody

    for (const { pattern, server } of ERROR_PAGE_PATTERNS) {
      if (pattern.test(body)) {
        return {
          validator: 'error_page',
          verdict: 'error',
          weight: 0,
          message: `Página de erro padrão detectada: ${server}`,
          details: { server, pattern: pattern.source },
        }
      }
    }

    return { validator: 'error_page', verdict: 'online', weight: 2, message: 'Nenhuma página de erro padrão detectada' }
  },
}
