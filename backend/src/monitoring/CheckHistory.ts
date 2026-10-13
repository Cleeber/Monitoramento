export interface CachedCheck {
  id: string
  monitor_id: string
  status: 'online' | 'offline' | 'warning'
  checked_at: string
  response_time: number | null
  error_message: string | null
  status_code?: number | null
}

const WINDOW = 30 * 86400000
interface History { times: number[]; prefix: number[]; recent: CachedCheck[] }

function lowerBound(times: number[], cutoff: number): number {
  let low = 0
  let high = times.length
  while (low < high) {
    const mid = (low + high) >>> 1
    if (times[mid] < cutoff) low = mid + 1
    else high = mid
  }
  return low
}

/** Numeric samples for uptime; at most 100 full records per monitor for live charts. */
export class CheckHistory {
  private histories = new Map<string, History>()

  seed(id: string, samples: number[][], recent: CachedCheck[], now = Date.now()) {
    const history: History = { times: [], prefix: [0], recent: [] }
    for (const [time, online] of samples) {
      if (!Number.isFinite(time) || time < now - WINDOW || time > now) continue
      if (history.times.length && time < history.times[history.times.length - 1]) {
        throw new Error('Bootstrap samples must be chronological')
      }
      history.times.push(time)
      history.prefix.push(history.prefix[history.prefix.length - 1] + (online === 1 ? 1 : 0))
    }
    history.recent = recent.filter(check => Date.parse(check.checked_at) >= now - WINDOW && Date.parse(check.checked_at) <= now)
      .sort((a, b) => Date.parse(b.checked_at) - Date.parse(a.checked_at) || b.id.localeCompare(a.id)).slice(0, 100)
    this.histories.set(id, history)
  }

  record(check: CachedCheck) {
    const time = Date.parse(check.checked_at)
    if (!Number.isFinite(time)) return
    const history = this.histories.get(check.monitor_id) ?? { times: [], prefix: [0], recent: [] }
    const index = lowerBound(history.times, time)
    if (index === history.times.length) {
      history.times.push(time)
      history.prefix.push(history.prefix[history.prefix.length - 1] + (check.status === 'online' ? 1 : 0))
    } else {
      // Clock shifts or overlapping manual checks can arrive out of order.
      history.times.splice(index, 0, time)
      history.prefix.splice(index + 1, 0, history.prefix[index])
      for (let i = index + 1; i < history.prefix.length; i++) {
        history.prefix[i] += check.status === 'online' ? 1 : 0
      }
    }
    history.recent.push(check)
    history.recent.sort((a, b) => Date.parse(b.checked_at) - Date.parse(a.checked_at) || b.id.localeCompare(a.id))
    history.recent = history.recent.slice(0, 100)
    this.histories.set(check.monitor_id, history)
    this.prune(check.monitor_id, time)
  }

  uptime(id: string, hours: number, now = Date.now()): number {
    const history = this.histories.get(id)
    if (!history) return 0
    const start = lowerBound(history.times, now - hours * 3600000)
    const end = lowerBound(history.times, now + 1)
    const count = end - start
    return count > 0 ? 100 * (history.prefix[end] - history.prefix[start]) / count : 0
  }

  recent(id: string, limit: number): CachedCheck[] {
    return (this.histories.get(id)?.recent ?? []).slice(0, Math.min(Math.max(limit, 0), 100))
  }

  remove(id: string) { this.histories.delete(id) }

  prune(id: string, now = Date.now()): void {
    const history = this.histories.get(id)
    if (!history) return
    const offset = lowerBound(history.times, now - WINDOW)
    if (offset) {
      history.times = history.times.slice(offset)
      history.prefix = history.prefix.slice(offset)
    }
    history.recent = history.recent.filter(check => Date.parse(check.checked_at) >= now - WINDOW)
  }

  pruneAll(now = Date.now()) { for (const id of this.histories.keys()) this.prune(id, now) }
  get sampleCount() { return [...this.histories.values()].reduce((sum, h) => sum + h.times.length, 0) }
  get fullRecordCount() { return [...this.histories.values()].reduce((sum, h) => sum + h.recent.length, 0) }
}
