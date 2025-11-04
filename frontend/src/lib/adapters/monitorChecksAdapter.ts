// Adaptador de normalização para respostas de checks de monitores
// Mantém compatibilidade com respostas em array e objeto (format=full)

export function normalizeChecksArray(payload: any): any[] {
  try {
    if (Array.isArray(payload)) return payload
    if (payload && Array.isArray(payload.data)) return payload.data
    if (payload && Array.isArray(payload.items)) return payload.items
    if (payload && Array.isArray(payload.checks)) return payload.checks
    return []
  } catch {
    return []
  }
}

export function normalizeChecksResponse(payload: any): { items: any[]; count: number } {
  const items = normalizeChecksArray(payload)
  const count = typeof payload?.count === 'number' ? payload.count : items.length
  return { items, count }
}