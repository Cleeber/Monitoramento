import assert from 'node:assert/strict'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { databaseService } from '../dist/server/services/DatabaseService.js'
import { CheckHistory } from '../dist/server/monitoring/CheckHistory.js'
dotenv.config()
const service = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false}})
const {data: monitors, error} = await service.from('monitors').select('id').eq('is_active',true).order('id')
assert.equal(error,null)
assert.ok(monitors.length)
const now = new Date()
const start = new Date(now.getTime() - 30 * 86400000)
const id = monitors[0].id
const before = performance.now()
const raw = await databaseService.getMonitorChecksForPeriod(id,start,now)
const detailMs = performance.now()-before
const summaryStart = performance.now()
const metrics = await databaseService.getMonitorReportMetrics(id,start,now)
const summaryMs = performance.now()-summaryStart
assert.equal(Number(metrics.total_checks),raw.length)
assert.equal(Number(metrics.successful_checks),raw.filter(c=>c.status==='online').length)
const times = raw.filter(c=>c.status==='online' && c.response_time>0).map(c=>c.response_time)
assert.equal(Number(metrics.response_time_samples),times.length)
assert.equal(Number(metrics.total_response_time),times.reduce((sum,time)=>sum+time,0))
const daily = new Map()
for(const c of raw) {
  const date=c.checked_at.slice(0,10)
  const counts=daily.get(date)||{total:0,successful:0}
  counts.total++
  if(c.status==='online') counts.successful++
  daily.set(date,counts)
}
for(const day of metrics.daily) assert.deepEqual({total:day.total,successful:day.successful},daily.get(day.date))
const bootstrap = await databaseService.getMonitoringBootstrap(monitors.map(m=>m.id),now)
const history = new CheckHistory()
const legacy = []
for(const row of bootstrap) {
  assert.ok(row.latest_checks.length<=100)
  history.seed(row.monitor_id,row.samples,row.latest_checks,now.getTime())
  for(const [time,online] of row.samples) legacy.push({monitor_id:row.monitor_id,checked_at:new Date(time).toISOString(),status:online?'online':'offline'})
}
function oldUptime(hours) {
  const rows=legacy.filter(c=>c.monitor_id===id && Date.parse(c.checked_at)>=now.getTime()-hours*3600000)
  return rows.length?100*rows.filter(c=>c.status==='online').length/rows.length:0
}
for(const hours of [24,168,720]) assert.equal(history.uptime(id,hours,now.getTime()),oldUptime(hours))
const iterations = 100
let started=performance.now()
for(let i=0;i<iterations;i++) for(const hours of [24,168,720]) oldUptime(hours)
const legacyUptimeMs=performance.now()-started
started=performance.now()
for(let i=0;i<iterations;i++) for(const hours of [24,168,720]) history.uptime(id,hours,now.getTime())
const compactUptimeMs=performance.now()-started
const report={activeMonitors:monitors.length,monitorChecks:raw.length,
  detailBytes:Buffer.byteLength(JSON.stringify(raw)),summaryBytes:Buffer.byteLength(JSON.stringify(metrics)),
  detailMs:Math.round(detailMs),summaryMs:Math.round(summaryMs),
  bootstrapSamples:history.sampleCount,fullRecordsCached:history.fullRecordCount,
  bootstrapBytes:Buffer.byteLength(JSON.stringify(bootstrap)),
  uptimeIterations:iterations,legacyUptimeMs:Math.round(legacyUptimeMs),compactUptimeMs:Number(compactUptimeMs.toFixed(3))}
console.log(JSON.stringify(report,null,2))
const base=process.env.SECURITY_TEST_BASE_URL||'https://monitor.pagina1digital.com.br'
if(process.argv.includes('--production')) {
  const stats=await fetch(`${base}/api/public/monitor-stats/${id}`)
  assert.equal(stats.status,200)
  const body=await stats.json()
  assert.ok(body.totalChecks>=raw.length-1 && body.totalChecks<=raw.length+10)
  const chart=await fetch(`${base}/api/public/uptime-history?monitor_id=${id}&days=30`)
  assert.equal(chart.status,200)
  assert.ok((await chart.json()).length>0)
  console.log('Production statistics and uptime chart returned valid data.')
}
