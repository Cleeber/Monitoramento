import assert from 'node:assert/strict'
import test from 'node:test'
import { CheckHistory, type CachedCheck } from '../src/monitoring/CheckHistory.js'

const now = Date.parse('2026-10-13T12:00:00Z')
const day = 86400000
const check = (time: number, status: CachedCheck['status'] = 'online', id = String(time)): CachedCheck => ({
  id, monitor_id: 'one', status, checked_at: new Date(time).toISOString(), response_time: 25, error_message: null,
})

test('janelas incluem o limite exato e excluem dados antigos e futuros', () => {
  const h = new CheckHistory()
  h.seed('one', [[now - 30 * day - 1, 0], [now - 30 * day, 1], [now - 7 * day, 0],
    [now - day, 1], [now, 0], [now + 1, 1]], [], now)
  assert.equal(h.sampleCount, 4)
  assert.equal(h.uptime('one', 720, now), 50)
  assert.equal(h.uptime('one', 168, now), 100 / 3)
  assert.equal(h.uptime('one', 24, now), 50)
  assert.equal(h.uptime('missing', 24, now), 0)
})

test('checagens fora de ordem e com timestamps iguais mantêm somas corretas', () => {
  const h = new CheckHistory()
  for (const c of [check(now, 'offline'), check(now - 10, 'online'), check(now, 'online', 'tie'), check(now - 5, 'warning')]) h.record(c)
  assert.equal(h.uptime('one', 24, now), 50)
  assert.equal(h.uptime('one', 24, now - 6), 100)
  assert.equal(h.recent('one', 1)[0].id, 'tie')
})

test('remoção de amostras antigas mantém o prefixo e limita registros completos', () => {
  const h = new CheckHistory()
  h.seed('one', [[now - 30 * day, 0], [now - day, 1]], [], now)
  h.prune('one', now + 1)
  h.record(check(now, 'offline'))
  assert.equal(h.uptime('one', 720, now), 50)
  for (let i = 1; i <= 150; i++) h.record(check(now + i, i % 2 ? 'online' : 'warning'))
  assert.equal(h.fullRecordCount, 100)
  assert.equal(h.recent('one', 10000).length, 100)
  assert.equal(h.recent('one', -1).length, 0)
  h.pruneAll(now + 31 * day)
  assert.equal(h.sampleCount, 0)
  assert.equal(h.fullRecordCount, 0)
})

test('isolamento por monitor e cache sem dados não inventam disponibilidade', () => {
  const h = new CheckHistory()
  h.seed('two', [[now, 0]], [check(now + 1)], now)
  h.record(check(now))
  assert.equal(h.uptime('one', 24, now), 100)
  assert.equal(h.uptime('two', 24, now), 0)
  assert.equal(h.recent('two', 100).length, 0)
  h.remove('one')
  assert.equal(h.uptime('one', 24, now), 0)
  assert.throws(() => h.seed('bad', [[now, 1], [now - 1, 0]], [], now), /chronological/)
})
