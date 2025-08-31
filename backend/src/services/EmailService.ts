import nodemailer from 'nodemailer'
import { databaseService } from './DatabaseService.js'

export interface EmailConfig {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  from_name: string
  from_email: string
}

export class EmailService {
  private transporter: nodemailer.Transporter | null = null
  private config: EmailConfig | null = null

  async initialize() {
    try {
      const smtpConfig = await databaseService.getSmtpConfig()
      
      if (!smtpConfig || !smtpConfig.is_configured) {
        console.log('📧 SMTP não configurado')
        return false
      }

      this.config = {
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure,
        user: smtpConfig.user,
        pass: smtpConfig.pass,
        from_name: smtpConfig.from_name,
        from_email: smtpConfig.from_email
      }

      this.transporter = nodemailer.createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        auth: {
          user: this.config.user,
          pass: this.config.pass
        },
        tls: {
          rejectUnauthorized: false
        }
      })

      console.log('📧 Serviço de e-mail inicializado')
      return true
    } catch (error) {
      console.error('❌ Erro ao inicializar serviço de e-mail:', error)
      return false
    }
  }

  async sendTestEmail(toEmail: string): Promise<{ success: boolean; message: string }> {
    try {
      if (!this.transporter || !this.config) {
        const initialized = await this.initialize()
        if (!initialized) {
          return {
            success: false,
            message: 'SMTP não configurado ou configuração inválida'
          }
        }
      }

      const mailOptions = {
        from: `"${this.config!.from_name}" <${this.config!.from_email}>`,
        to: toEmail,
        subject: 'Teste de Configuração SMTP - Uptime Monitor',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">🎉 Teste de E-mail Bem-sucedido!</h2>
            <p>Parabéns! Sua configuração SMTP está funcionando corretamente.</p>
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #374151;">Detalhes da Configuração:</h3>
              <ul style="color: #6b7280;">
                <li><strong>Servidor:</strong> ${this.config!.host}:${this.config!.port}</li>
                <li><strong>Segurança:</strong> ${this.config!.secure ? 'SSL/TLS' : 'STARTTLS'}</li>
                <li><strong>Usuário:</strong> ${this.config!.user}</li>
                <li><strong>Remetente:</strong> ${this.config!.from_name} &lt;${this.config!.from_email}&gt;</li>
              </ul>
            </div>
            <p style="color: #6b7280;">Este e-mail foi enviado automaticamente pelo sistema Uptime Monitor para testar a configuração SMTP.</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <p style="font-size: 12px; color: #9ca3af; text-align: center;">
              Uptime Monitor - Sistema de Monitoramento<br>
              Enviado em ${new Date().toLocaleString('pt-BR')}
            </p>
          </div>
        `
      }

      const info = await this.transporter!.sendMail(mailOptions)
      console.log('📧 E-mail de teste enviado:', info.messageId)
      
      return {
        success: true,
        message: 'E-mail de teste enviado com sucesso!'
      }
    } catch (error) {
      console.error('❌ Erro ao enviar e-mail de teste:', error)
      return {
        success: false,
        message: `Erro ao enviar e-mail: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      }
    }
  }

  async sendNotificationEmail(toEmails: string[], subject: string, content: string): Promise<{ success: boolean; message: string }> {
    try {
      if (!this.transporter || !this.config) {
        const initialized = await this.initialize()
        if (!initialized) {
          return {
            success: false,
            message: 'SMTP não configurado'
          }
        }
      }

      const mailOptions = {
        from: `"${this.config!.from_name}" <${this.config!.from_email}>`,
        to: toEmails.join(', '),
        subject: subject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
              <h2 style="margin: 0;">🚨 Alerta do Uptime Monitor</h2>
            </div>
            <div style="background-color: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
              ${content}
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
              <p style="font-size: 12px; color: #9ca3af; text-align: center;">
                Uptime Monitor - Sistema de Monitoramento<br>
                Enviado em ${new Date().toLocaleString('pt-BR')}
              </p>
            </div>
          </div>
        `
      }

      const info = await this.transporter!.sendMail(mailOptions)
      console.log('📧 E-mail de notificação enviado:', info.messageId)
      
      return {
        success: true,
        message: 'E-mail de notificação enviado com sucesso!'
      }
    } catch (error) {
      console.error('❌ Erro ao enviar e-mail de notificação:', error)
      return {
        success: false,
        message: `Erro ao enviar e-mail: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      }
    }
  }

  async verifyConnection(): Promise<{ success: boolean; message: string }> {
    try {
      if (!this.transporter) {
        const initialized = await this.initialize()
        if (!initialized) {
          return {
            success: false,
            message: 'SMTP não configurado'
          }
        }
      }

      await this.transporter!.verify()
      return {
        success: true,
        message: 'Conexão SMTP verificada com sucesso!'
      }
    } catch (error) {
      console.error('❌ Erro ao verificar conexão SMTP:', error)
      return {
        success: false,
        message: `Erro na conexão SMTP: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      }
    }
  }

  // Método para recarregar configuração após mudanças
  async reloadConfig() {
    this.transporter = null
    this.config = null
    return await this.initialize()
  }
}

export const emailService = new EmailService()