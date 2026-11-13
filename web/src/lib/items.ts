import type { Item } from '../api'

// The API has no "get one item" route, so the entry card reads items already seen in a
// result list. The last opened one survives a reload via sessionStorage.
const seen = new Map<string, Item>()
const LAST = 'ritrovato.lastItem'

export function remember(items: Item[]) {
  for (const it of items) seen.set(it.id, it)
}

export function rememberOpened(item: Item) {
  try {
    sessionStorage.setItem(LAST, JSON.stringify(item))
  } catch {
    // reload of the card just shows "not loaded"
  }
}

export function lookup(id: string): Item | null {
  const hit = seen.get(id)
  if (hit) return hit
  try {
    const last = JSON.parse(sessionStorage.getItem(LAST) ?? 'null') as Item | null
    return last?.id === id ? last : null
  } catch {
    return null
  }
}

/** "2026-10-28" → "28/10/2026", the register's own format. */
export function formatDate(iso: string | null) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/** Register text split into its " - " segments, without empty or "/" leftovers. */
export function segments(descr: string) {
  return descr
    .split(/\s+-\s+/)
    .map((s) => s.trim())
    .filter((s) => s && s !== '/')
}
