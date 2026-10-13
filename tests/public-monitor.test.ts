import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import { publicMonitor, findActivePublicMonitor } from '../src/lib/publicMonitor.js'

test('resposta pública exclui configurações e também campos internos futuros', () => {
  const result = publicMonitor({
    id: randomUUID(), name: 'Example', url: 'https://example.test', is_active: true,
    report_email: 'private@example.test', api_health_expected_body: 'private',
    future_secret: 'private', response_time: 10, uptime_24h: 99,
  }, { response_time: 0, uptime_24h: 0 })
  assert.equal(result.response_time, 0)
  assert.equal(result.uptime_24h, 0)
  assert.equal(result.enabled, true)
  assert.equal('report_email' in result, false)
  assert.equal('api_health_expected_body' in result, false)
  assert.equal('future_secret' in result, false)
})

test('histórico público exige monitor ativo e um UUID válido', async () => {
  const id = randomUUID()
  assert.equal(await findActivePublicMonitor({ getMonitorById: async () => ({ is_active: false }) }, id), null)
  assert.equal(await findActivePublicMonitor({ getMonitorById: async () => { throw { code: 'PGRST116' } } }, id), null)
  assert.equal(await findActivePublicMonitor({ getMonitorById: async () => { throw new Error('must not query') } }, 'invalid'), null)
  const active = { id, is_active: true }
  assert.equal(await findActivePublicMonitor({ getMonitorById: async () => active }, id), active)
})

test('falhas de banco não são disfarçadas como monitor inexistente', async () => {
  await assert.rejects(findActivePublicMonitor({ getMonitorById: async () => { throw new Error('database unavailable') } }, randomUUID()), /database unavailable/)
})
