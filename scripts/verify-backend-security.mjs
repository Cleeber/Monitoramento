import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config()
const options = { auth: { persistSession: false, autoRefreshToken: false } }
const service = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, options)
const anon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY, options)
const tables = ['users', 'smtp_config', 'monitors', 'monitor_checks', 'reports',
  'monthly_report_configs', 'monthly_report_history', 'refresh_tokens']
const missingId = randomUUID()
for (const table of tables) {
  // Empty inserts violate NOT NULL constraints even if a grant regresses.
  // Updates/deletes target a fresh, nonexistent UUID, never historical data.
  for (const [operation, request] of [
    ['select', anon.from(table).select('id').limit(1)],
    ['insert', anon.from(table).insert({})],
    ['update', anon.from(table).update({ id: missingId }).eq('id', missingId)],
    ['delete', anon.from(table).delete().eq('id', missingId)],
  ]) {
    const { error } = await request
    assert.equal(error?.code, '42501', `${table}: anonymous ${operation} should be denied`)
  }
}
for (const [name, args] of [['exec_sql', { sql: 'SELECT 1' }], ['cleanup_expired_refresh_tokens', {}]]) {
  const { error } = await anon.rpc(name, args)
  assert.equal(error?.code, '42501', `${name}: anonymous execution should be denied`)
}
console.log('Anonymous reads, writes and administrative RPCs denied.')

const user = await service.from('users').select('id').eq('role', 'admin').limit(1).single()
assert.equal(user.error, null)
const tokenId = randomUUID()
try {
  const created = await service.from('refresh_tokens').insert({ id: tokenId,
    user_id: user.data.id, token_hash: randomUUID(), expires_at: new Date(Date.now() + 86400000).toISOString() })
  assert.equal(created.error, null)
  const updated = await service.from('refresh_tokens').update({ expires_at: new Date(Date.now() + 172800000).toISOString() }).eq('id', tokenId)
  assert.equal(updated.error, null)
  const read = await service.from('refresh_tokens').select('id').eq('id', tokenId).single()
  assert.equal(read.error, null)
  assert.equal(read.data.id, tokenId)
} finally {
  const deleted = await service.from('refresh_tokens').delete().eq('id', tokenId)
  assert.equal(deleted.error, null)
}
console.log('Backend refresh-token CRUD preserved; fixture removed.')

const base = process.env.SECURITY_TEST_BASE_URL || 'https://monitor.pagina1digital.com.br'
async function get(path, expected = 200) {
  const response = await fetch(base + path)
  assert.equal(response.status, expected, path)
  return response.json()
}
const monitors = await get('/api/public/monitors')
assert.ok(monitors.length > 0)
const safeKeys = new Set(['id','name','url','type','slug','logo_url','is_active','enabled',
  'status','last_check','response_time','uptime_24h','uptime_7d','uptime_30d'])
for (const monitor of monitors) {
  assert.ok(Object.keys(monitor).every(key => safeKeys.has(key)), 'Private configuration leaked')
}
const active = monitors[0].id
await get('/api/public/status/all')
await get(`/api/public/status/monitor/${active}`)
await get(`/api/public/monitors/${active}/checks?limit=2`)
await get(`/api/public/incidents?monitor_id=${active}&limit=2`)
await get(`/api/public/uptime-history?monitor_id=${active}&days=1`)
await get(`/api/public/monitor-stats/${active}`)
await get('/api/monitors', 401)
await get('/api/monthly-reports/history', 401)
console.log('Public status pages preserved; private API requires authentication.')

const pausedId = randomUUID()
try {
  const paused = await service.from('monitors').insert({ id: pausedId, name: 'Security validation fixture',
    url: 'https://security-fixture.example.test', is_active: false })
  assert.equal(paused.error, null)
  for (const id of [pausedId, missingId]) {
    for (const path of [
      `/api/public/incidents?monitor_id=${id}`,
      `/api/public/uptime-history?monitor_id=${id}&days=1`,
      `/api/public/monitor-stats/${id}`,
      `/api/public/status/monitor/${id}`,
    ]) await get(path, 404)
  }
} finally {
  const deleted = await service.from('monitors').delete().eq('id', pausedId)
  assert.equal(deleted.error, null)
}
console.log('Inactive and nonexistent monitors denied; fixture removed.')
