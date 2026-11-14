// Mirrors docs/ARCHITECTURE.md → "API contract". Only the orchestrator changes the contract.

export const LANGS = ['it', 'en', 'es', 'fr', 'de'] as const
export type Lang = (typeof LANGS)[number]

export type Origin = 'registry' | 'office'

export type Item = {
  id: string // registry "<year>-<reperto>-<page>" or "office-<n>"
  origin: Origin
  year: number
  reperto: number | null
  date: string // ISO yyyy-mm-dd; office: date found
  descr: string
  category: string
  tags: string[]
  brand: string | null
  number_guessed?: boolean
  source: { page: number; url: string } | null // null for office items
  colour: string | null // office only
  found_place: string | null // office only
  photo_url: string | null // office only
  status: 'available' | 'reserved' | null // office only
}

export type Interpreted = {
  category: string | null
  brand: string | null
  keywords: string[] // Italian search terms
  date_from: string | null
  date_to: string | null
  ignored: string[] // attributes the registry does not record (colour, place...)
  colour?: string | null
  place?: string | null
  relaxed?: string[] // filters dropped because nothing matched: keywords, brand, dates
}

export type SearchResponse = {
  items: Item[]
  total: number
  office?: Item[]
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
  source?: 'office'
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

export const getItem = (id: string) => fetch(`/api/items/${encodeURIComponent(id)}`).then(json<Item>)

export type Slot = { start: string; free: boolean } // "YYYY-MM-DDTHH:MM", Europe/Rome
export const getSlots = (date: string) =>
  fetch(`/api/office/slots?date=${date}`).then(json<{ date: string; slots: Slot[] }>)

export type BookingResult = { code: string; manage_token: string; slot_start: string; item_id: string }
export const bookItem = (id: string, body: { name: string; contact: string; slot_start: string }) =>
  fetch(`/api/office/items/${encodeURIComponent(id)}/book`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, ack: true }),
  }).then(json<BookingResult>)

export type BookingStatus = 'booked' | 'collected' | 'no_show' | 'cancelled'
export type Booking = { code: string; status: BookingStatus; slot_start: string; name: string; contact: string; item: Item }
export const getBooking = (token: string) => fetch(`/api/bookings/${encodeURIComponent(token)}`).then(json<Booking>)
export const cancelBooking = (token: string) =>
  fetch(`/api/bookings/${encodeURIComponent(token)}`, { method: 'DELETE' }).then(json<Booking>)

// --- operator back-office (cookie session) ---
export type Operator = { username: string; display_name: string; is_admin: boolean }
export type OperatorItem = Omit<Item, 'status'> & {
  status: 'available' | 'reserved' | 'returned' | 'discarded'
  created_at: string
  updated_at: string
}
export type ItemFields = {
  category: string
  brand: string | null
  colour: string | null
  descr: string
  found_place: string
  found_at: string
}
export type Draft = {
  draft_id: string
  photo_url: string
  suggested: { category: string | null; brand: string | null; colour: string | null; descr: string } | null
}
export type DayBooking = { id: number; code: string; status: BookingStatus; slot_start: string; name: string; contact: string; item: OperatorItem }

const send = (method: string, path: string, body?: unknown) =>
  fetch(path, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

export const opLogin = (username: string, password: string) => send('POST', '/api/operator/login', { username, password }).then(json<Operator>)
export const opLogout = () => send('POST', '/api/operator/logout').then(json<{ ok: boolean }>)
export const opMe = () => fetch('/api/operator/me').then(json<Operator>)
export const opDraft = (image: Blob) => {
  const form = new FormData()
  form.append('image', image)
  return fetch('/api/operator/items/draft', { method: 'POST', body: form }).then(json<Draft>)
}
export const opCreateItem = (fields: ItemFields & { draft_id?: string }) => send('POST', '/api/operator/items', fields).then(json<OperatorItem>)
export const opPatchItem = (n: number, fields: Partial<ItemFields> & { draft_id?: string; status?: 'returned' | 'discarded' }) =>
  send('PATCH', `/api/operator/items/${n}`, fields).then(json<OperatorItem>)
export const opListItems = (p: { status?: string; category?: string; q?: string; limit?: number; offset?: number }) => {
  const qs = new URLSearchParams(Object.entries(p).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]))
  return fetch(`/api/operator/items?${qs}`).then(json<{ items: OperatorItem[]; total: number }>)
}
export const opDayBookings = (date: string) => fetch(`/api/operator/bookings?date=${date}`).then(json<DayBooking[]>)
export const opPatchBooking = (id: number, status: 'collected' | 'no_show' | 'cancelled') =>
  send('PATCH', `/api/operator/bookings/${id}`, { status }).then(json<DayBooking>)

/** "office-42" → 42 */
export const officeNumber = (id: string) => Number(id.replace(/^office-/, ''))
