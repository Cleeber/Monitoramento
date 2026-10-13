import assert from 'node:assert/strict'
import test from 'node:test'
import { DatabaseService } from '../src/services/DatabaseService.js'

test('histórico pagina mesmo com teto do servidor menor que 1000 e desempata por ID', async () => {
  const original = globalThis.fetch
  const originalUrl = process.env.SUPABASE_URL
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  process.env.SUPABASE_URL = 'https://performance-fixture.example.test'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fixture-key'
  const timestamp = '2026-10-01T00:00:00+00:00'
  const ids = [1, 2, 3].map(i => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`)
  let calls = 0
  globalThis.fetch = async (input) => {
    const url = new URL(String(input))
    assert.equal(url.searchParams.get('order'), 'checked_at.asc,id.asc')
    assert.equal(url.searchParams.get('limit'), '1000')
    assert.notEqual(url.searchParams.get('select'), '*')
    if (calls === 1) assert.equal(url.searchParams.get('or'), `(checked_at.gt.${timestamp},and(checked_at.eq.${timestamp},id.gt.${ids[1]}))`)
    const page = calls === 0 ? ids.slice(0, 2) : calls === 1 ? ids.slice(2) : []
    calls++
    return new Response(JSON.stringify(page.map(id => ({ id, checked_at: timestamp }))), { headers: { 'content-type': 'application/json' } })
  }
  try {
    const service = new DatabaseService()
    const result = await service.getMonitorChecksForPeriod(ids[0], new Date('2026-10-01'), new Date('2026-10-02'))
    assert.deepEqual(result.map(c => c.id), ids)
    assert.equal(calls, 3)
    globalThis.fetch = async () => new Response(JSON.stringify({ message: 'fixture database failure', code: 'XX000' }), { status: 500 })
    await assert.rejects(service.getMonitorReportMetrics(ids[0], new Date('2026-10-01'), new Date('2026-10-02')), { message: 'fixture database failure' })
    await assert.rejects(service.getMonitorReportMetrics(ids[0], new Date('2026-10-02'), new Date('2026-10-01')), /inválido/)
  } finally {
    globalThis.fetch = original
    if (originalUrl === undefined) delete process.env.SUPABASE_URL
    else process.env.SUPABASE_URL = originalUrl
    if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey
  }
})
