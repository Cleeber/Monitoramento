import type { CheckContext, ValidationResult, Validator } from './types.js'
import * as tls from 'tls'
import { URL } from 'url'

export const sslValidator: Validator = {
  name: 'ssl',
  async validate(ctx: CheckContext): Promise<ValidationResult> {
    const url = new URL(ctx.url)

    if (url.protocol !== 'https:') {
      return { validator: 'ssl', verdict: 'online', weight: 2, message: 'Não é HTTPS - ignorado' }
    }

    if (ctx.isSslError) {
      return { validator: 'ssl', verdict: 'error', weight: 0, message: 'Erro SSL detectado na requisição' }
    }

    try {
      const socket = await new Promise<tls.TLSSocket>((resolve, reject) => {
        const opts = { host: url.hostname, port: 443, servername: url.hostname, rejectUnauthorized: false }
        const sock = tls.connect(opts, () => resolve(sock))
        sock.on('error', reject)
        sock.setTimeout(5000, () => { sock.destroy(); reject(new Error('SSL handshake timeout')) })
      })

      const cert = socket.getPeerCertificate()
      socket.destroy()

      if (!cert || !cert.valid_to) {
        return { validator: 'ssl', verdict: 'degraded', weight: 1, message: 'Certificado sem data de validade' }
      }

      const daysUntilExpiry = Math.floor((new Date(cert.valid_to).getTime() - Date.now()) / 86400000)

      if (daysUntilExpiry < 0) {
        return { validator: 'ssl', verdict: 'error', weight: 0, message: `SSL expirado em ${cert.valid_to}`, details: { validTo: cert.valid_to } }
      }

      if (daysUntilExpiry <= 7) {
        return { validator: 'ssl', verdict: 'degraded', weight: 1, message: `SSL expira em ${daysUntilExpiry} dias (${cert.valid_to})`, details: { daysUntilExpiry } }
      }

      return {
        validator: 'ssl',
        verdict: 'online',
        weight: 2,
        message: `SSL válido até ${cert.valid_to} (${daysUntilExpiry} dias)`,
        details: { validTo: cert.valid_to, daysUntilExpiry, issuer: cert.issuer },
      }
    } catch (err) {
      return { validator: 'ssl', verdict: 'error', weight: 0, message: `Falha SSL: ${err instanceof Error ? err.message : String(err)}` }
    }
  },
}
