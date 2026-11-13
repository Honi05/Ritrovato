import { useSyncExternalStore } from 'react'
import type { SearchResponse } from '../api'

// Voice and photo results cannot travel in the URL hash, so the last one lives here
// (module state, mirrored to sessionStorage so a reload of #/search?mode=… keeps it).
export type Mode = 'voice' | 'photo'
export type Last = { mode: Mode; res: SearchResponse }

const KEY = 'ritrovato.lastSearch'
const listeners = new Set<() => void>()
let current: Last | null = null
try {
  current = JSON.parse(sessionStorage.getItem(KEY) ?? 'null')
} catch {
  current = null
}

export function setLast(mode: Mode, res: SearchResponse) {
  current = { mode, res }
  try {
    sessionStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    // only a reload of the results page loses them
  }
  listeners.forEach((l) => l())
}

export function useLast(): Last | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => current,
  )
}
