import { useId, useState } from 'react'
import { Activity, AlertTriangle, BarChart3, Check, CheckCircle2, Clock3, Globe2, Info, Radio, Server, XCircle } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { incidentDuration, reportDomain, reportDuration, type PublicMonitor, type PublicReport } from '../../utils/publicReport'
import './public-status.css'

const percentage = (value: number) => `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
const dateLabel = (value: string, long = false) => new Date(value.length === 10 ? `${value}T12:00:00` : value).toLocaleDateString('pt-BR', {
  day: '2-digit', month: long ? 'long' : 'short', ...(long ? { year: 'numeric' } : {}),
})
const statuses = {
  online: { label: 'Operacional', tone: 'green' },
  offline: { label: 'Indisponível', tone: 'red' },
  warning: { label: 'Instabilidade', tone: 'amber' },
  unknown: { label: 'Aguardando dados', tone: 'muted' },
}

function Information({ text }: { text: string }) {
  return <span className="report-info" tabIndex={0} aria-label={text}>
    <Info size={14} aria-hidden="true" /><span role="tooltip">{text}</span>
  </span>
}

function ClientLogo({ monitor }: { monitor: PublicMonitor }) {
  const [failed, setFailed] = useState(false)
  const source = monitor.logo_url
  if (!source || failed) return null
  const src = /^(https?:|data:)/.test(source) ? source : `/api${source.startsWith('/') ? '' : '/'}${source}`
  return <img className="report-client-logo" src={src} alt={`Logo de ${monitor.name}`} onError={() => setFailed(true)} />
}

interface Props { report: PublicReport | null; loading: boolean; error: string | null }

export function PublicStatusReport({ report, loading, error }: Props) {
  const gradientId = useId().replace(/:/g, '')
  const monitors = report?.monitors ?? []
  const single = monitors.length === 1 ? monitors[0] : null
  const occurrences = report?.incidents
  const observed = monitors.filter(monitor => monitor.last_check && Number.isFinite(monitor.uptime_30d))
  const uptime = observed.length ? observed.reduce((sum, monitor) => sum + monitor.uptime_30d, 0) / observed.length : null
  const durations = occurrences?.map(incident => incidentDuration(incident, report!.lastUpdated))
  const downtime = durations && durations.every(duration => duration !== null)
    ? durations.reduce<number>((sum, duration) => sum + (duration ?? 0), 0) : null
  const current = monitors.some(monitor => monitor.status === 'offline') ? statuses.offline
    : monitors.some(monitor => monitor.status === 'warning') ? statuses.warning
      : !monitors.length || monitors.some(monitor => monitor.status === 'unknown') ? statuses.unknown : statuses.online
  const periodEnd = report ? new Date(report.lastUpdated) : null
  const periodStart = periodEnd ? new Date(periodEnd.getTime() - 30 * 86_400_000) : null
  const history = report?.history ?? []
  const minUptime = history.length ? Math.min(...history.map(point => point.uptime)) : 100
  const chartMin = Math.max(0, Math.floor((minUptime - Math.max(0.3, (100 - minUptime) * 0.15)) * 10) / 10)
  const metrics = [
    { label: 'Disponibilidade', value: uptime === null ? '—' : percentage(uptime), icon: CheckCircle2, tone: uptime === null ? 'muted' : uptime >= 99 ? 'green' : uptime >= 95 ? 'amber' : 'red', note: 'Últimos 30 dias', info: 'Percentual de verificações bem-sucedidas nos últimos 30 dias.' },
    { label: 'Tempo indisponível', value: downtime === null ? '—' : reportDuration(downtime), icon: Clock3, tone: 'blue', note: 'Nas ocorrências listadas', info: 'Soma das durações informadas no histórico recente. Um traço indica duração indisponível.' },
    { label: 'Incidentes', value: occurrences == null ? '—' : String(occurrences.length), icon: AlertTriangle, tone: occurrences?.length ? 'red' : 'green', note: 'No histórico recente', info: 'Ocorrências disponíveis no histórico recente, dentro dos últimos 30 dias.' },
    { label: 'Resposta média', value: report?.averageResponse == null ? '—' : `${report.averageResponse.toLocaleString('pt-BR')} ms`, icon: BarChart3, tone: 'blue', note: 'Últimos 30 dias', info: 'Tempo médio de resposta das verificações bem-sucedidas no período.' },
  ]
  const accessibility = single ? statuses[single.status] : current
  const integrity = [
    { label: single ? 'Site acessível' : 'Serviços acessíveis', value: accessibility.label, tone: accessibility.tone, icon: Globe2 },
    { label: 'Resposta do servidor', value: single?.response_time != null ? `${Math.round(single.response_time).toLocaleString('pt-BR')} ms na última medição` : single ? 'Sem resposta registrada' : `${monitors.filter(monitor => monitor.response_time != null).length} de ${monitors.length} serviços com resposta`, tone: single ? single.response_time != null ? 'green' : 'muted' : current.tone, icon: Server },
    { label: 'Última verificação', value: single?.last_check ? new Date(single.last_check).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : single ? 'Aguardando verificação' : `${observed.length} serviços com verificações`, tone: observed.length ? 'green' : 'muted', icon: Clock3 },
    { label: 'Status atual', value: current.label, tone: current.tone, icon: Activity },
  ]

  return <div className="public-status-report">
    <div className="report-container">
      <header className="report-header">
        <a className="report-brand" href="https://pagina1digital.com.br" target="_blank" rel="noreferrer" aria-label="Página 1 Digital">
          <span className="report-brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span><strong>Página 1</strong> Digital</span>
        </a>
        {report && <div className="report-client">
          <div className="report-client-name">{single && <ClientLogo key={single.id} monitor={single} />}<div><span>{single ? 'Cliente' : 'Monitoramento'}</span><strong>{single?.name ?? 'Todos os serviços'}</strong></div></div>
          <div className="report-domain"><span>{single ? 'Domínio monitorado' : 'Serviços monitorados'}</span><strong>{single ? reportDomain(single.url) : `${monitors.length} serviços`}</strong></div>
        </div>}
      </header>

      {loading && <div className="report-state" role="status"><Activity className="report-loading" size={32} /><h1>Carregando o status do site</h1><p>Buscando os dados de monitoramento…</p></div>}
      {!loading && !report && <div className="report-state" role="alert"><Globe2 size={36} /><h1>{error ?? 'Página de status não encontrada.'}</h1><p>Verifique o endereço ou tente novamente em instantes.</p><button onClick={() => window.location.reload()}>Tentar novamente</button></div>}

      {!loading && report && <main>
        {(error || report.partial) && <p className="report-notice" role="status">{error ? `${error} Exibindo a última atualização disponível.` : 'Algumas informações do histórico estão indisponíveis. Uma nova atualização será feita automaticamente.'}</p>}
        <section className="report-heading" aria-labelledby="report-title">
          <div><h1 id="report-title">{single ? 'Relatório de Saúde do Site' : 'Relatório de Saúde dos Serviços'}</h1><p>Período: {dateLabel(periodStart!.toISOString(), true)} a {dateLabel(periodEnd!.toISOString(), true)}</p></div>
          <span className={`report-pill ${current.tone}`}><span className="report-dot" />{current.label}</span>
        </section>

        <section className="report-metrics" aria-label="Indicadores do período">
          {metrics.map(({ label, value, icon: Icon, tone, note, info }) => <article className="report-metric" key={label}>
            <span className={`report-icon ${tone}`}><Icon size={28} strokeWidth={1.8} aria-hidden="true" /></span>
            <div><div className="report-metric-label">{label}<Information text={info} /></div><strong className={`report-metric-value ${label === 'Disponibilidade' ? tone : ''}`}>{value}</strong><small>{note}</small></div>
          </article>)}
        </section>

        <section className="report-chart-panel" aria-labelledby="availability-title">
          <div className="report-section-header"><h2 id="availability-title">Disponibilidade {single ? 'do site' : 'dos serviços'} no período <Information text="Disponibilidade diária. O eixo vertical se ajusta aos valores do período." /></h2><span className="report-legend"><span className="report-dot" />Disponibilidade (%)</span></div>
          {history.length ? <div className="report-chart" role="img" aria-label="Gráfico de disponibilidade diária dos últimos 30 dias. Os valores também estão disponíveis na tabela abaixo.">
            <ResponsiveContainer width="100%" height="100%"><AreaChart data={history} margin={{ top: 12, right: 12, left: 4, bottom: 0 }}>
              <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0baa82" stopOpacity={0.17} /><stop offset="100%" stopColor="#0baa82" stopOpacity={0.015} /></linearGradient></defs>
              <CartesianGrid stroke="#e6edf0" strokeDasharray="3 4" />
              <XAxis dataKey="date" tickFormatter={date => dateLabel(String(date))} tick={{ fill: '#728096', fontSize: 12 }} axisLine={{ stroke: '#d4dce5' }} tickLine={false} minTickGap={32} dy={10} height={36} />
              <YAxis domain={[chartMin, 100]} tickFormatter={percentage} tick={{ fill: '#728096', fontSize: 12 }} width={76} axisLine={false} tickLine={false} tickCount={4} />
              <Tooltip labelFormatter={date => dateLabel(String(date), true)} formatter={value => [percentage(Number(value)), 'Disponibilidade']} contentStyle={{ border: '1px solid #e5ebf1', borderRadius: 10, color: '#102442', fontSize: 13 }} />
              <Area type="linear" dataKey="uptime" stroke="#0baa82" strokeWidth={2.2} fill={`url(#${gradientId})`} isAnimationActive={false} dot={false} activeDot={{ r: 5, fill: '#0baa82', stroke: '#fff', strokeWidth: 3 }} />
            </AreaChart></ResponsiveContainer>
          </div> : <p className="report-empty">Histórico de disponibilidade ainda não disponível.</p>}
          {history.length > 0 && <details className="report-chart-details"><summary>Ver dados diários</summary><div className="report-table-scroll"><table><caption className="sr-only">Disponibilidade diária</caption><thead><tr><th scope="col">Data</th><th scope="col">Disponibilidade</th></tr></thead><tbody>{history.map(point => <tr key={point.date}><td>{dateLabel(point.date, true)}</td><td>{percentage(point.uptime)}</td></tr>)}</tbody></table></div></details>}
        </section>

        <section className="report-occurrences" aria-labelledby="occurrences-title">
          <div className="report-section-header"><h2 id="occurrences-title">Ocorrências do período</h2><span className="report-section-note">Histórico recente</span></div>
          <div className="report-table-scroll"><table className={occurrences?.length ? 'report-has-occurrences' : undefined}><caption className="sr-only">Histórico de ocorrências do período</caption><thead><tr><th scope="col">Data</th><th scope="col">Descrição</th><th scope="col">Duração</th><th scope="col">Status</th></tr></thead><tbody>
            {occurrences == null ? <tr><td colSpan={4} className="report-table-empty">Histórico de ocorrências indisponível.</td></tr> : !occurrences.length ? <tr><td colSpan={4} className="report-table-empty"><CheckCircle2 size={19} />Nenhuma ocorrência registrada no histórico disponível.</td></tr> : occurrences.map(incident => {
              const duration = incidentDuration(incident, report.lastUpdated)
              const resolved = incident.status === 'resolved' && !!incident.resolved_at
              return <tr key={incident.id}><td className="report-date"><time dateTime={incident.started_at} title={new Date(incident.started_at).toLocaleString('pt-BR')}>{dateLabel(incident.started_at)}</time></td><td><strong className="report-incident-title">{incident.title}</strong>{!single && <small>{incident.monitor_name}</small>}{incident.description && <small>{incident.description}</small>}</td><td className="report-duration">{duration === null ? '—' : reportDuration(duration)}</td><td><span className={`report-pill ${resolved ? 'green' : 'amber'}`}><span className="report-dot" />{resolved ? 'Normalizado' : incident.status === 'identified' ? 'Identificado' : 'Em investigação'}</span></td></tr>
            })}
          </tbody></table></div>
        </section>

        {!single && monitors.length > 0 && <section className="report-services" aria-labelledby="services-title"><h2 id="services-title">Status dos serviços</h2><div className="report-service-grid">{monitors.map(monitor => <article key={monitor.id}><div><strong>{monitor.name}</strong><span>{reportDomain(monitor.url)}</span></div><span className={`report-pill ${statuses[monitor.status].tone}`}><span className="report-dot" />{statuses[monitor.status].label}</span></article>)}</div></section>}

        <section className="report-integrity" aria-labelledby="integrity-title"><h2 id="integrity-title">Integridade {single ? 'do site' : 'dos serviços'}</h2><div className="report-integrity-grid">
          {integrity.map(({ label, value, tone, icon: Icon }) => <article key={label}><span className={`report-icon ${tone}`}>{tone === 'green' ? <Check size={25} strokeWidth={2.5} /> : tone === 'red' ? <XCircle size={25} /> : <Icon size={25} />}</span><div><strong>{label}</strong><span>{value}</span></div></article>)}
        </div></section>
      </main>}

      <footer className="report-footer"><span>Monitoramento automático · Atualização a cada 30 segundos</span>{report && <span><Radio size={13} aria-hidden="true" />Atualizado em {new Date(report.lastUpdated).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>}</footer>
    </div>
  </div>
}
