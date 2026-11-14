// Mirrors docs/ARCHITECTURE.md → "API contract". Only the orchestrator changes the contract.

export const LANGS = ['it', 'en', 'es', 'fr', 'de'] as const
export type Lang = (typeof LANGS)[number]

export type Item = {
  id: string // "<year>-<reperto>-<page>"
  year: number
  reperto: number | null
  date: string // ISO yyyy-mm-dd
  descr: string // original Italian text from the registry
  category: string
  tags: string[]
  brand: string | null
  number_guessed?: boolean // OCR missed the registry number, the parser guessed it
  source: { page: number; url: string }
}

export type Interpreted = {
  category: string | null
  brand: string | null
  keywords: string[] // Italian search terms
  date_from: string | null
  date_to: string | null
  ignored: string[] // attributes the registry does not record (colour, place...)
  relaxed?: string[] // filters dropped because nothing matched: keywords, brand, dates
}

export type SearchResponse = {
  items: Item[]
  total: number
  interpreted: Interpreted | null // null = keyword fallback, no LLM
  transcript?: string // voice only
  description?: string | null // photo only; null = nothing recognised
}

export type Meta = {
  total: number
  last_item_date: string | null
  last_checked_at: string | null
  new_items_last_check: number
  categories: { id: string; count: number }[]
  source_url: string
}

export type ItemsParams = {
  q?: string
  category?: string
  brand?: string
  date_from?: string
  date_to?: string
  limit?: number
  offset?: number
}

/** Failed request. `status` is 0 for network errors; the body may be {error,message}, {detail} or not JSON. */
export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function json<T>(res: Response): Promise<T> {
  const text = await res.text().catch(() => '')
  let body: unknown = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    // non-JSON body (proxy error page, 502 from nginx...)
  }
  if (!res.ok) {
    const b = (body ?? {}) as { error?: unknown; message?: unknown; detail?: unknown }
    const detail = typeof b.detail === 'string' ? b.detail : Array.isArray(b.detail) ? 'bad_request' : ''
    const msg = [b.message, b.error, detail, res.statusText].find((x) => typeof x === 'string' && x)
    throw new ApiError(res.status, String(msg ?? `HTTP ${res.status}`))
  }
  if (body === null) throw new ApiError(res.status, 'invalid response')
  return body as T
}

export const getMeta = () => fetch('/api/meta').then(json<Meta>)

export const getItems = (p: ItemsParams = {}) => {
  const qs = new URLSearchParams(
    Object.entries(p).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]),
  )
  return fetch(`/api/items?${qs}`).then(json<SearchResponse>)
}

export const searchText = (query: string, lang: Lang) =>
  fetch('/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, lang }),
  }).then(json<SearchResponse>)

const upload = (path: string, field: string, file: Blob, lang: Lang) => {
  const form = new FormData()
  form.append(field, file)
  form.append('lang', lang)
  return fetch(path, { method: 'POST', body: form }).then(json<SearchResponse>)
}

export const searchVoice = (audio: Blob, lang: Lang) => upload('/api/search/voice', 'audio', audio, lang)
export const searchPhoto = (image: Blob, lang: Lang) => upload('/api/search/photo', 'image', image, lang)
