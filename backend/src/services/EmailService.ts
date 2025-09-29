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
      console.log(`📧 Iniciando envio de e-mail de teste para: ${toEmail}`)
      
      if (!this.transporter || !this.config) {
        console.log('🔧 Inicializando configuração SMTP...')
        const initialized = await this.initialize()
        if (!initialized) {
          const error = 'SMTP não configurado ou configuração inválida'
          console.error(`❌ Erro no envio de e-mail de teste: ${error}`)
          return {
            success: false,
            message: error
          }
        }
      }

      console.log(`🔧 Configuração SMTP carregada: ${this.config!.host}:${this.config!.port}`)

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
            <p style="color: #6b7280;">Este e-mail foi enviado automaticamente para testar a configuração SMTP.</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <p style="font-size: 12px; color: #9ca3af; text-align: center;">
              Enviado em ${new Date().toLocaleString('pt-BR')}
            </p>
          </div>
        `
      }

      const info = await this.transporter!.sendMail(mailOptions)
      console.log(`✅ E-mail de teste enviado com sucesso para: ${toEmail}, MessageID: ${info.messageId}`)
      
      return {
        success: true,
        message: 'E-mail de teste enviado com sucesso!'
      }
    } catch (error) {
      console.error(`❌ Erro ao enviar e-mail de teste para ${toEmail}:`, error)
      return {
        success: false,
        message: `Erro ao enviar e-mail: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      }
    }
  }

  async sendNotificationEmail(toEmails: string[], subject: string, content: string, attachments?: any[]): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`📧 Iniciando envio de notificação para: ${toEmails.join(', ')}`)
      console.log(`📋 Assunto: ${subject}`)
      
      if (!this.transporter || !this.config) {
        console.log('🔧 Inicializando configuração SMTP...')
        const initialized = await this.initialize()
        if (!initialized) {
          const error = 'SMTP não configurado ou configuração inválida'
          console.error(`❌ Erro no envio de notificação: ${error}`)
          return {
            success: false,
            message: error
          }
        }
      }

      console.log(`🔧 Usando configuração SMTP: ${this.config!.host}:${this.config!.port}`)

      const mailOptions: any = {
        from: `"${this.config!.from_name}" <${this.config!.from_email}>`,
        to: toEmails.join(', '),
        subject: subject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
              <h2 style="margin: 0;">🚨 Alerta de Monitoramento</h2>
            </div>
            <div style="background-color: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
              ${content}
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
              <p style="font-size: 12px; color: #9ca3af; text-align: center;">
                Enviado em ${new Date().toLocaleString('pt-BR')}
              </p>
            </div>
          </div>
        `
      }

      // Adicionar anexos se fornecidos
      if (attachments && attachments.length > 0) {
        mailOptions.attachments = attachments
        console.log(`📎 Anexos incluídos: ${attachments.length} arquivo(s)`)
        attachments.forEach((attachment, index) => {
          console.log(`   ${index + 1}. ${attachment.filename || 'Sem nome'} (${attachment.contentType || 'tipo desconhecido'})`)
        })
      }

      const info = await this.transporter!.sendMail(mailOptions)
      console.log(`✅ Notificação enviada com sucesso para: ${toEmails.join(', ')}, MessageID: ${info.messageId}`)
      
      return {
        success: true,
        message: 'E-mail de notificação enviado com sucesso!'
      }
    } catch (error) {
      console.error(`❌ Erro ao enviar notificação para ${toEmails.join(', ')}:`, error)
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
  async sendMonthlyReport(
    toEmail: string, 
    monitorName: string, 
    pdfBuffer?: Buffer,
    fileName?: string,
    statusLink?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`📊 Iniciando envio de relatório mensal para: ${toEmail}`)
      console.log(`📋 Monitor: ${monitorName}`)
      
      if (!this.transporter || !this.config) {
        console.log('🔧 Inicializando configuração SMTP...')
        const initialized = await this.initialize()
        if (!initialized) {
          const error = 'SMTP não configurado ou configuração inválida'
          console.error(`❌ Erro no envio de relatório mensal: ${error}`)
          return {
            success: false,
            message: error
          }
        }
      }

      console.log(`🔧 Usando configuração SMTP: ${this.config!.host}:${this.config!.port}`)

      const currentDate = new Date()
      const monthYear = currentDate.toLocaleDateString('pt-BR', { 
        month: 'long', 
        year: 'numeric' 
      })

      const mailOptions: any = {
        from: `"${this.config!.from_name}" <${this.config!.from_email}>`,
        to: toEmail,
        subject: `📊 Relatório Mensal - ${monitorName} - ${monthYear}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f5f5f5; padding: 20px;">
            <div style="background-color: #ffffff; border: 2px solid #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <div style="background-color: #3b82f6; color: white; padding: 20px; text-align: left;">
                <h1 style="margin: 0; font-size: 24px; font-weight: bold;">📊 Relatório Mensal</h1>
                <p style="margin: 10px 0 0 0; font-size: 16px;">${monitorName} - ${monthYear}</p>
              </div>
              
              <div style="padding: 30px; background-color: #ffffff; color: #374151;">
                ${statusLink ? `
                <div style="background-color: #f8fafc; padding: 15px; border-left: 4px solid #3b82f6; margin-bottom: 20px;">
                  <p style="margin: 0 0 8px 0; color: #1e40af; font-weight: bold; font-size: 14px;">🔗 Acompanhe o status em tempo real:</p>
                  <a href="${statusLink}" target="_blank" style="color: #3b82f6; text-decoration: none; font-size: 14px; word-break: break-all;">${statusLink}</a>
                </div>` : ''}

                <p style="color: #6b7280; margin: 0 0 20px 0; line-height: 1.6; font-size: 14px;">
                  Caso não consiga abrir o link acima, enviamos uma versão em PDF em anexo.
                </p>

                ${pdfBuffer ? `
                <div style="background-color: #f9fafb; padding: 15px; text-align: center; margin-bottom: 20px; border: 1px solid #e5e7eb;">
                  <p style="margin: 0; color: #374151; font-size: 14px;"><strong>📎 Anexo:</strong> Relatório detalhado em PDF</p>
                </div>` : ''}
              </div>
            </div>
          </div>
        `
      }

      // Adicionar anexo PDF se fornecido
      if (pdfBuffer && fileName) {
        mailOptions.attachments = [{
          filename: fileName,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }]
        console.log(`📎 Anexo PDF incluído: ${fileName} (${Math.round(pdfBuffer.length / 1024)}KB)`)
      }

      const info = await this.transporter!.sendMail(mailOptions)
      console.log(`✅ Relatório mensal enviado com sucesso para: ${toEmail}, MessageID: ${info.messageId}`)
      
      return {
        success: true,
        message: 'Relatório mensal enviado com sucesso!'
      }
    } catch (error) {
      console.error(`❌ Erro ao enviar relatório mensal para ${toEmail}:`, error)
      return {
        success: false,
        message: `Erro ao enviar relatório: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      }
    }
  }

  async reloadConfig() {
    this.config = null
    this.transporter = null
    await this.initialize()
  }
}

export const emailService = new EmailService()