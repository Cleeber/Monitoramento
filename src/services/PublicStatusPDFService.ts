import PDFDocument from 'pdfkit'
import type { PublicStatusIncident, PublicStatusMonitor, PublicStatusReport } from './PublicStatusService.js'

const palette = {
  navy: '#0c2345',
  muted: '#69768a',
  border: '#e1e7ee',
  pale: '#f5f8fb',
  green: '#07885f',
  greenBg: '#e7f7f0',
  red: '#d43939',
  redBg: '#fdeeed',
  amber: '#a8650a',
  amberBg: '#fff5df',
  blue: '#087ecc',
  blueBg: '#e9f4fd',
  gray: '#69778b',
  grayBg: '#f1f4f8',
}

const pageMargin = 38
const contentBottom = 540

export class PublicStatusPDFService {
  async generate(report: PublicStatusReport): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          layout: 'landscape',
          margins: { top: pageMargin, right: pageMargin, bottom: 42, left: pageMargin },
          bufferPages: true,
          compress: true,
        })
        const chunks: Buffer[] = []
        doc.on('data', chunk => chunks.push(chunk))
        doc.on('end', () => resolve(Buffer.concat(chunks)))
        doc.on('error', reject)

        const single = report.monitors.length === 1 ? report.monitors[0] : null
        this.drawOverviewPage(doc, report, single)
        this.drawDetailsPages(doc, report, single)
        this.drawFooters(doc)
        doc.end()
      } catch (error) {
        reject(error)
      }
    })
  }

  private drawOverviewPage(doc: PDFKit.PDFDocument, report: PublicStatusReport, single: PublicStatusMonitor | null) {
    this.drawBrand(doc, single?.name ?? 'Todos os serviços')

    const current = this.currentStatus(report.monitors)
    const title = single ? 'Relatório de Saúde do Site' : 'Relatório de Saúde dos Serviços'
    doc.font('Helvetica-Bold').fontSize(21).fillColor(palette.navy).text(title, pageMargin, 78, { width: 610 })
    doc.font('Helvetica').fontSize(10).fillColor(palette.muted)
      .text(`Período: ${this.formatDateLong(this.addDays(new Date(report.lastUpdated), -30))} a ${this.formatDateLong(new Date(report.lastUpdated))}`, pageMargin, 108)
    if (single) {
      doc.fontSize(9).fillColor(palette.muted).text(this.domain(single.url), pageMargin, 123, { width: 550 })
    }
    this.drawStatusPill(doc, current.label, current.tone, 684, 83, 120)

    const uptime = this.averageUptime(report.monitors, report.partial)
    const hasChecks = report.monitors.some(monitor => monitor.total_checks > 0)
    const durations = report.incidents?.map(incident => this.incidentDuration(incident, report.lastUpdated)) ?? null
    const downtime = hasChecks && !report.partial && durations && durations.every(duration => duration !== null)
      ? this.formatDuration(durations.reduce<number>((sum, duration) => sum + (duration ?? 0), 0))
      : '—'
    const metrics = [
      { label: 'Disponibilidade', value: uptime === null ? '—' : this.percentage(uptime), note: 'Últimos 30 dias', tone: uptime === null ? 'muted' : uptime >= 99 ? 'green' : uptime >= 95 ? 'amber' : 'red' },
      { label: 'Tempo indisponível', value: downtime, note: 'Nas ocorrências listadas', tone: 'blue' },
      { label: 'Incidentes', value: report.incidents == null || !hasChecks ? '—' : String(report.incidents.length), note: 'No histórico recente', tone: report.incidents?.length ? 'red' : hasChecks ? 'green' : 'muted' },
      { label: 'Resposta média', value: report.averageResponse == null ? '—' : `${report.averageResponse.toLocaleString('pt-BR')} ms`, note: 'Últimos 30 dias', tone: 'blue' },
    ]
    const gap = 12
    const cardWidth = (doc.page.width - pageMargin * 2 - gap * 3) / 4
    metrics.forEach((metric, index) => {
      const x = pageMargin + index * (cardWidth + gap)
      const y = 150
      doc.roundedRect(x, y, cardWidth, 69, 7).fillAndStroke('#ffffff', palette.border)
      doc.font('Helvetica').fontSize(9).fillColor(palette.muted).text(metric.label, x + 13, y + 11, { width: cardWidth - 26 })
      doc.font('Helvetica-Bold').fontSize(20).fillColor(this.toneColor(metric.tone)).text(metric.value, x + 13, y + 27, { width: cardWidth - 26, lineBreak: false })
      doc.font('Helvetica').fontSize(8).fillColor(palette.muted).text(metric.note, x + 13, y + 53, { width: cardWidth - 26, lineBreak: false })
    })

    const chartX = pageMargin
    const chartY = 237
    const chartW = doc.page.width - pageMargin * 2
    const chartH = 286
    doc.roundedRect(chartX, chartY, chartW, chartH, 7).fillAndStroke('#ffffff', palette.border)
    doc.font('Helvetica-Bold').fontSize(12).fillColor(palette.navy)
      .text(`Disponibilidade ${single ? 'do site' : 'dos serviços'} no período`, chartX + 16, chartY + 15)
    doc.font('Helvetica').fontSize(8).fillColor(palette.muted)
      .text('Disponibilidade diária (%)', chartX + chartW - 165, chartY + 17, { width: 145, align: 'right' })

    if (!report.history.length) {
      doc.font('Helvetica').fontSize(10).fillColor(palette.muted)
        .text('Histórico de disponibilidade ainda não disponível.', chartX + 18, chartY + 127, { width: chartW - 36, align: 'center' })
      return
    }

    const minUptime = Math.min(...report.history.map(point => point.uptime))
    const chartMin = Math.max(0, Math.floor((minUptime - Math.max(0.3, (100 - minUptime) * 0.15)) * 10) / 10)
    const plotX = chartX + 69
    const plotY = chartY + 53
    const plotW = chartW - 92
    const plotH = 185

    doc.lineWidth(0.6).strokeColor(palette.border).font('Helvetica').fontSize(8).fillColor(palette.muted)
    for (let index = 0; index < 4; index++) {
      const y = plotY + (plotH * index) / 3
      const value = 100 - ((100 - chartMin) * index) / 3
      doc.moveTo(plotX, y).lineTo(plotX + plotW, y).stroke()
      doc.text(this.percentage(value), chartX + 12, y - 4, { width: 49, align: 'right', lineBreak: false })
    }

    const points = report.history
    const xAt = (index: number) => plotX + (points.length <= 1 ? plotW / 2 : (index / (points.length - 1)) * plotW)
    const yAt = (value: number) => plotY + ((100 - Math.min(100, Math.max(chartMin, value))) / (100 - chartMin || 1)) * plotH
    doc.lineWidth(2).strokeColor('#0baa82')
    points.forEach((point, index) => {
      if (index === 0) doc.moveTo(xAt(index), yAt(point.uptime))
      else doc.lineTo(xAt(index), yAt(point.uptime))
    })
    if (points.length === 1) doc.circle(xAt(0), yAt(points[0].uptime), 2).fill('#0baa82')
    else doc.stroke()

    const labels = [points[0], points[Math.floor((points.length - 1) / 2)], points[points.length - 1]]
    const labelPositions = [plotX, plotX + plotW / 2, plotX + plotW]
    labels.forEach((point, index) => {
      doc.font('Helvetica').fontSize(8).fillColor(palette.muted).text(this.formatDateShort(point.date), labelPositions[index] - 36, plotY + plotH + 12, { width: 72, align: index === 0 ? 'left' : index === 2 ? 'right' : 'center', lineBreak: false })
    })
  }

  private drawDetailsPages(doc: PDFKit.PDFDocument, report: PublicStatusReport, single: PublicStatusMonitor | null) {
    this.addContentPage(doc, 'Ocorrências do período', single?.name ?? 'Todos os serviços')
    this.drawIncidents(doc, report)

    if (!single && report.monitors.length) this.drawServices(doc, report.monitors)
    this.drawIntegrity(doc, report, single)
    if (report.partial) {
      this.ensureSpace(doc, 28, 'Informações complementares')
      doc.font('Helvetica').fontSize(8).fillColor(palette.muted)
        .text('Algumas informações do histórico estavam indisponíveis no momento da geração.', pageMargin, doc.y + 3, { width: doc.page.width - pageMargin * 2 })
      doc.y += 18
    }
  }

  private drawIncidents(doc: PDFKit.PDFDocument, report: PublicStatusReport) {
    const right = doc.page.width - pageMargin
    const columns = { date: pageMargin + 8, detail: pageMargin + 94, duration: right - 202, status: right - 112 }
    this.drawSectionHeading(doc, 'Histórico de ocorrências', report.incidents == null ? 'Histórico indisponível' : 'Histórico recente')

    if (report.incidents == null) {
      doc.font('Helvetica').fontSize(9).fillColor(palette.muted).text('Não foi possível carregar o histórico de ocorrências.', pageMargin + 10, doc.y + 3)
      doc.y += 28
      return
    }
    if (!report.monitors.some(monitor => monitor.total_checks > 0)) {
      doc.roundedRect(pageMargin, doc.y + 3, right - pageMargin, 43, 6).fillAndStroke('#ffffff', palette.border)
      doc.font('Helvetica').fontSize(9).fillColor(palette.muted).text('Sem verificações no período; não é possível confirmar incidentes.', pageMargin + 15, doc.y + 17, { width: right - pageMargin - 30, align: 'center' })
      doc.y += 55
      return
    }
    if (!report.incidents.length) {
      doc.roundedRect(pageMargin, doc.y + 3, right - pageMargin, 43, 6).fillAndStroke('#fbfefd', palette.border)
      doc.font('Helvetica').fontSize(9).fillColor(palette.green).text('Nenhuma ocorrência registrada no histórico disponível.', pageMargin + 15, doc.y + 17, { width: right - pageMargin - 30, align: 'center' })
      doc.y += 55
      return
    }

    const tableTop = doc.y + 3
    doc.roundedRect(pageMargin, tableTop, right - pageMargin, 26, 5).fill(palette.pale)
    doc.font('Helvetica-Bold').fontSize(8).fillColor(palette.muted)
      .text('Data', columns.date, tableTop + 8, { width: 75 })
      .text('Descrição', columns.detail, tableTop + 8, { width: columns.duration - columns.detail - 10 })
      .text('Duração', columns.duration, tableTop + 8, { width: 75 })
      .text('Status', columns.status, tableTop + 8, { width: 96 })
    doc.y = tableTop + 31

    for (const incident of report.incidents) {
      const detail = `${incident.title}${incident.monitor_name && report.monitors.length > 1 ? ` - ${incident.monitor_name}` : ''}${incident.description ? `\n${incident.description}` : ''}`
      const detailWidth = columns.duration - columns.detail - 12
      doc.font('Helvetica').fontSize(8.5)
      const detailHeight = doc.heightOfString(detail, { width: detailWidth, lineGap: 2 })
      const rowHeight = Math.max(34, detailHeight + 15)
      this.ensureSpace(doc, rowHeight + 2, 'Ocorrências do período (continuação)')
      const y = doc.y
      doc.moveTo(pageMargin, y + rowHeight).lineTo(right, y + rowHeight).lineWidth(0.5).strokeColor(palette.border).stroke()
      doc.font('Helvetica').fontSize(8.5).fillColor(palette.navy).text(this.formatDateShort(incident.started_at), columns.date, y + 11, { width: 75 })
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(palette.navy).text(incident.title, columns.detail, y + 8, { width: detailWidth })
      if (incident.description) {
        doc.font('Helvetica').fontSize(7.5).fillColor(palette.muted)
          .text(incident.description, columns.detail, y + 20, { width: detailWidth, lineGap: 2 })
      }
      const duration = this.incidentDuration(incident, report.lastUpdated)
      doc.font('Helvetica').fontSize(8.5).fillColor(palette.muted)
        .text(duration === null ? '—' : this.formatDuration(duration), columns.duration, y + 11, { width: 75 })
      const status = this.incidentStatus(incident, report.lastUpdated)
      this.drawStatusPill(doc, status.label, status.tone, columns.status, y + 7, 100)
      doc.y = y + rowHeight + 2
    }
    doc.y += 8
  }

  private drawServices(doc: PDFKit.PDFDocument, monitors: PublicStatusMonitor[]) {
    this.ensureSpace(doc, 58, 'Status dos serviços')
    this.drawSectionHeading(doc, 'Status dos serviços')
    const right = doc.page.width - pageMargin
    const rowHeight = 29
    for (const monitor of monitors) {
      this.ensureSpace(doc, rowHeight, 'Status dos serviços (continuação)')
      const y = doc.y
      doc.moveTo(pageMargin, y + rowHeight).lineTo(right, y + rowHeight).lineWidth(0.5).strokeColor(palette.border).stroke()
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(palette.navy).text(monitor.name, pageMargin + 9, y + 9, { width: 310, lineBreak: false, ellipsis: true })
      doc.font('Helvetica').fontSize(8).fillColor(palette.muted).text(this.domain(monitor.url), pageMargin + 325, y + 10, { width: right - pageMargin - 460, lineBreak: false, ellipsis: true })
      const status = this.statusFor(monitor.status)
      this.drawStatusPill(doc, status.label, status.tone, right - 124, y + 5, 112)
      doc.y = y + rowHeight
    }
    doc.y += 8
  }

  private drawIntegrity(doc: PDFKit.PDFDocument, report: PublicStatusReport, single: PublicStatusMonitor | null) {
    this.ensureSpace(doc, 112, `Integridade ${single ? 'do site' : 'dos serviços'}`)
    this.drawSectionHeading(doc, `Integridade ${single ? 'do site' : 'dos serviços'}`)
    const current = this.currentStatus(report.monitors)
    const accessibility = single ? this.statusFor(single.status) : current
    const observed = report.monitors.filter(monitor => monitor.total_checks > 0)
    const responseCount = report.monitors.filter(monitor => monitor.response_time != null).length
    const integrity = [
      { label: single ? 'Site acessível' : 'Serviços acessíveis', value: accessibility.label, tone: accessibility.tone },
      { label: 'Resposta do servidor', value: single ? single.response_time != null ? `${Math.round(single.response_time).toLocaleString('pt-BR')} ms na última medição` : 'Sem resposta registrada' : `${responseCount} de ${report.monitors.length} serviços com resposta`, tone: single ? single.response_time != null ? 'green' : 'muted' : current.tone },
      { label: 'Última verificação', value: single ? single.last_check ? new Date(single.last_check).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Aguardando verificação' : `${observed.length} serviços com verificações`, tone: observed.length ? 'green' : 'muted' },
      { label: 'Status atual', value: current.label, tone: current.tone },
    ]

    const gap = 10
    const cardWidth = (doc.page.width - pageMargin * 2 - gap * 3) / 4
    const cardsY = doc.y + 2
    integrity.forEach((item, index) => {
      const x = pageMargin + index * (cardWidth + gap)
      const y = cardsY
      doc.roundedRect(x, y, cardWidth, 64, 6).fillAndStroke('#ffffff', palette.border)
      doc.font('Helvetica').fontSize(8).fillColor(palette.muted).text(item.label, x + 10, y + 10, { width: cardWidth - 20 })
      doc.font('Helvetica-Bold').fontSize(10).fillColor(this.toneColor(item.tone)).text(item.value, x + 10, y + 29, { width: cardWidth - 20, height: 28, ellipsis: true })
    })
    doc.y = cardsY + 76
  }

  private drawBrand(doc: PDFKit.PDFDocument, clientName: string) {
    const markX = pageMargin
    const markY = 38
    doc.rect(markX, markY + 13, 5, 9).fill('#77acc4')
    doc.rect(markX + 8, markY + 7, 5, 15).fill('#008dcc')
    doc.rect(markX + 16, markY, 5, 22).fill('#0c3762')
    doc.font('Helvetica-Bold').fontSize(12).fillColor(palette.navy).text('Página 1 Digital', markX + 29, markY + 5)
    doc.font('Helvetica').fontSize(8).fillColor(palette.muted)
      .text(clientName, doc.page.width - 250, markY + 7, { width: 212, align: 'right', lineBreak: false, ellipsis: true })
    doc.moveTo(pageMargin, 67).lineTo(doc.page.width - pageMargin, 67).lineWidth(0.7).strokeColor(palette.border).stroke()
  }

  private addContentPage(doc: PDFKit.PDFDocument, title: string, subtitle: string) {
    doc.addPage({ size: 'A4', layout: 'landscape', margins: { top: pageMargin, right: pageMargin, bottom: 42, left: pageMargin } })
    this.drawBrand(doc, subtitle)
    doc.font('Helvetica-Bold').fontSize(18).fillColor(palette.navy).text(title, pageMargin, 82)
    doc.y = 112
  }

  private ensureSpace(doc: PDFKit.PDFDocument, height: number, title: string) {
    if (doc.y + height <= contentBottom) return
    this.addContentPage(doc, title, 'Relatório de status')
  }

  private drawSectionHeading(doc: PDFKit.PDFDocument, title: string, note?: string) {
    this.ensureSpace(doc, 38, title)
    const y = doc.y + 3
    doc.font('Helvetica-Bold').fontSize(11).fillColor(palette.navy).text(title, pageMargin, y)
    if (note) doc.font('Helvetica').fontSize(8).fillColor(palette.muted).text(note, doc.page.width - pageMargin - 180, y + 2, { width: 180, align: 'right' })
    doc.y = y + 24
  }

  private drawStatusPill(doc: PDFKit.PDFDocument, label: string, tone: string, x: number, y: number, maxWidth: number) {
    const width = maxWidth
    doc.roundedRect(x, y, width, 20, 10).fill(this.toneBackground(tone))
    doc.circle(x + 9, y + 10, 2.5).fill(this.toneColor(tone))
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(this.toneColor(tone))
      .text(label, x + 16, y + 6, { width: width - 22, height: 10, lineBreak: false, ellipsis: true })
  }

  private drawFooters(doc: PDFKit.PDFDocument) {
    const pages = doc.bufferedPageRange()
    for (let index = pages.start; index < pages.start + pages.count; index++) {
      doc.switchToPage(index)
      const originalMargins = { ...doc.page.margins }
      doc.page.margins.bottom = 10
      const y = doc.page.height - 31
      doc.moveTo(pageMargin, y).lineTo(doc.page.width - pageMargin, y).lineWidth(0.6).strokeColor(palette.border).stroke()
      doc.font('Helvetica').fontSize(7.5).fillColor(palette.muted)
        .text(`Gerado em ${new Date().toLocaleString('pt-BR')} · Página ${index - pages.start + 1} de ${pages.count}`, pageMargin, y + 9, { width: doc.page.width - pageMargin * 2, align: 'right', lineBreak: false })
      doc.page.margins = originalMargins
    }
  }

  private currentStatus(monitors: PublicStatusMonitor[]) {
    const status = monitors.some(monitor => monitor.status === 'offline') ? 'offline'
      : monitors.some(monitor => monitor.status === 'warning') ? 'warning'
        : !monitors.length || monitors.some(monitor => monitor.status === 'unknown') ? 'unknown' : 'online'
    return this.statusFor(status)
  }

  private statusFor(status: string) {
    const statuses: Record<string, { label: string; tone: string }> = {
      online: { label: 'Operacional', tone: 'green' },
      offline: { label: 'Indisponível', tone: 'red' },
      warning: { label: 'Instabilidade', tone: 'amber' },
      unknown: { label: 'Aguardando dados', tone: 'muted' },
    }
    return statuses[status] ?? statuses.unknown
  }

  private incidentStatus(incident: PublicStatusIncident, lastUpdated: string) {
    const duration = this.incidentDuration(incident, lastUpdated)
    const unconfirmed = incident.status === 'resolved' && (!incident.resolved_at || duration === null)
    if (incident.status === 'resolved' && !unconfirmed) return { label: 'Normalizado', tone: 'green' }
    if (unconfirmed) return { label: 'Sem confirmação', tone: 'muted' }
    if (incident.status === 'identified') return { label: 'Identificado', tone: 'amber' }
    return { label: 'Em investigação', tone: 'amber' }
  }

  private incidentDuration(incident: PublicStatusIncident, now: string): number | null {
    const start = new Date(incident.started_at).getTime()
    const end = new Date(incident.resolved_at ?? now).getTime()
    if (incident.resolved_at && end === start) return null
    return Number.isFinite(start) && Number.isFinite(end) && end >= start ? end - start : null
  }

  private averageUptime(monitors: PublicStatusMonitor[], partial: boolean) {
    if (partial) return null
    const observed = monitors.filter(monitor => monitor.total_checks > 0)
    const totalChecks = observed.reduce((sum, monitor) => sum + monitor.total_checks, 0)
    const successfulChecks = observed.reduce((sum, monitor) => sum + monitor.successful_checks, 0)
    return totalChecks ? (successfulChecks / totalChecks) * 100 : null
  }

  private percentage(value: number) {
    return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
  }

  private formatDuration(milliseconds: number) {
    if (milliseconds === 0) return '0 min'
    if (milliseconds < 60_000) return '< 1 min'
    const minutes = Math.round(milliseconds / 60_000)
    if (minutes < 60) return `${minutes} min`
    if (minutes < 1440) return `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ''}`
    return `${Math.floor(minutes / 1440)} d ${Math.floor((minutes % 1440) / 60)} h`
  }

  private formatDateLong(date: Date) {
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  }

  private formatDateShort(value: string) {
    const date = new Date(value.length === 10 ? `${value}T12:00:00` : value)
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  }

  private addDays(date: Date, days: number) {
    const result = new Date(date)
    result.setDate(result.getDate() + days)
    return result
  }

  private domain(url: string) {
    try { return new URL(url).hostname } catch { return url }
  }

  private toneColor(tone: string) {
    return ({ green: palette.green, red: palette.red, amber: palette.amber, blue: palette.blue, muted: palette.gray } as Record<string, string>)[tone] ?? palette.navy
  }

  private toneBackground(tone: string) {
    return ({ green: palette.greenBg, red: palette.redBg, amber: palette.amberBg, blue: palette.blueBg, muted: palette.grayBg } as Record<string, string>)[tone] ?? palette.grayBg
  }
}

export const publicStatusPdfService = new PublicStatusPDFService()
