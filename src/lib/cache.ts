import LRUCache from 'lru-cache'

// ─── Cache para stats do dashboard ──────────────────────────────────────────

const statsCache = new LRUCache<string, { value: unknown; timestamp: number }>({
  max: 100,
  ttl: 30_000, // 30 segundos
})

const publicStatusCache = new LRUCache<string, { value: unknown; timestamp: number }>({
  max: 50,
  ttl: 60_000, // 60 segundos
})

const configCache = new LRUCache<string, { value: unknown; timestamp: number }>({
  max: 200,
  ttl: 5 * 60_000, // 5 minutos
})

export type CacheType = 'stats' | 'publicStatus' | 'config'

export function getCached<T>(type: CacheType, key: string): T | null {
  const cache = type === 'stats' ? statsCache
    : type === 'publicStatus' ? publicStatusCache
    : configCache
  const entry = cache.get(key)
  if (entry) return entry.value as T
  return null
}

export function setCached<T>(type: CacheType, key: string, value: T): void {
  const cache = type === 'stats' ? statsCache
    : type === 'publicStatus' ? publicStatusCache
    : configCache
  cache.set(key, { value, timestamp: Date.now() })
}

export function invalidateCache(type: CacheType, key?: string): void {
  const cache = type === 'stats' ? statsCache
    : type === 'publicStatus' ? publicStatusCache
    : configCache
  if (key) {
    cache.delete(key)
  } else {
    cache.clear()
  }
}

export function invalidateAllCaches(): void {
  statsCache.clear()
  publicStatusCache.clear()
  configCache.clear()
}
