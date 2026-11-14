import { useEffect, useId, useRef, useState } from 'react'
import { getItems, getMeta, type Item, type ItemsParams, type Meta } from '../api'
import ItemTag from '../components/ItemTag'
import OfficeCard from '../components/OfficeCard'
import OfficeStrip from '../components/OfficeStrip'
import { useI18n } from '../i18n'
import { remember } from '../lib/items'
import { href, navigate } from '../lib/router'

const PAGE = 20
const FIELDS = ['q', 'category', 'brand', 'date_from', 'date_to'] as const
type Filters = Record<(typeof FIELDS)[number], string>
// The register only records a usable brand for phones and electronics (docs/DATA.md).
const BRANDED = ['', 'phone', 'electronics']
// Most frequent brands there; the API matches the brand exactly.
const BRANDS = ['APPLE', 'SAMSUNG', 'REDMI', 'XIAOMI REDMI', 'XIAOMI', 'MOTOROLA', 'OPPO', 'HUAWEI', 'HONOR', 'LENOVO']

export default function Catalogue({ params }: { params: URLSearchParams }) {
  const { t, lang } = useI18n()
  const filters = Object.fromEntries(FIELDS.map((k) => [k, params.get(k) ?? ''])) as Filters
  if (!BRANDED.includes(filters.category)) filters.brand = ''
  const office = params.get('source') === 'office'
  const key = [...FIELDS.map((k) => filters[k]), office].join('|')

  const [meta, setMeta] = useState<Meta | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [near, setNear] = useState<Item[]>([])
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const gen = useRef(0) // bumps per request; a response from an older request is dropped

  useEffect(() => {
    getMeta().then(setMeta, () => setMeta(null))
  }, [])

  const load = (offset: number) => {
    const mine = ++gen.current
    setLoading(true)
    setError(false)
    const p: ItemsParams = { ...filters, limit: PAGE, offset, ...(office ? { source: 'office' as const } : {}) }
    return getItems(p).then(
      (r) => {
        remember(r.items)
        if (mine !== gen.current) return
        setItems((prev) => (offset === 0 ? r.items : [...prev, ...r.items]))
        setTotal(r.total)
        if (offset === 0) setNear(r.office ?? [])
        setLoading(false)
      },
      () => {
        if (mine !== gen.current) return
        setError(true)
        setLoading(false)
      },
    )
  }

  useEffect(() => {
    load(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return (
    <div className="flex flex-wrap items-start gap-8 pt-8">
      <FilterPanel key={key} initial={filters} meta={meta} office={office} />

      <section aria-live="polite" aria-busy={loading} className="flex min-w-0 flex-[999_1_560px] flex-col gap-3.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="font-wide m-0 text-[30px] font-black">
            {total === null ? (office ? t.office.recent : t.nav.catalogue) : t.search.matches(total)}
          </h1>
          <span className="font-mono text-[13px] uppercase">{t.search.newest}</span>
        </div>
        {error && <p className="m-0 border-2 border-ink bg-card p-4">{t.search.error}</p>}
        {!loading && !error && items.length === 0 && (
          <p className="m-0 border-2 border-dashed border-ink p-5">{t.search.none}</p>
        )}
        {!office && <OfficeStrip items={near} />}
        {office ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
            {items.map((it) => <OfficeCard key={it.id} item={it} />)}
          </div>
        ) : (
          items.map((it) => <ItemTag key={it.id} item={it} />)
        )}
        {loading && <p className="m-0 font-mono text-sm">{t.search.loading}</p>}
        {!loading && total !== null && items.length < total && (
          <button
            type="button"
            onClick={() => load(items.length)}
            className="min-h-12 cursor-pointer self-start border-2 border-ink bg-transparent px-5 font-bold hover:bg-card"
          >
            {t.search.more} ({(total - items.length).toLocaleString(lang)})
          </button>
        )}
        <p className="m-0 font-mono text-[13px] text-muted">{t.search.hidden}</p>
      </section>
    </div>
  )
}

function FilterPanel({ initial, meta, office }: { initial: Filters; meta: Meta | null; office: boolean }) {
  const { t } = useI18n()
  const [f, setF] = useState(initial)
  // Open beside the results on wide screens; collapsed above them on phones.
  const [open, setOpen] = useState(() => window.matchMedia('(min-width: 900px)').matches)
  const active = FIELDS.filter((k) => initial[k]).length
  const id = useId()
  const set = (k: keyof Filters) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  const branded = BRANDED.includes(f.category)
  const brands = f.brand && !BRANDS.includes(f.brand) ? [f.brand, ...BRANDS] : BRANDS
  const label = 'flex flex-col gap-1.5 font-mono text-xs font-semibold tracking-[0.06em] uppercase'
  const field = 'min-h-11 w-full min-w-0 box-border border-2 border-ink bg-white px-2.5 font-sans text-[15px] font-medium normal-case tracking-normal'

  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="min-w-0 flex-[1_1_240px] border-2 border-ink bg-card"
    >
      <summary className="cursor-pointer px-5 py-4 text-lg font-extrabold">
        {t.filters.title}
        {active > 0 && <span className="ml-2 bg-ink px-2 py-0.5 font-mono text-sm text-card">{active}</span>}
      </summary>
    <form
      aria-label={t.filters.title}
      onSubmit={(e) => {
        e.preventDefault()
        navigate(href('catalogue', { ...f, q: f.q.trim(), brand: branded ? f.brand : '', source: office ? 'office' : undefined }))
      }}
      className="flex flex-col gap-5 px-5 pb-5"
    >
      <label className={label}>
        {t.filters.keyword}
        <input type="text" value={f.q} onChange={set('q')} className={field} aria-describedby={`${id}-kw`} />
        <span id={`${id}-kw`} className="font-sans text-xs font-normal tracking-normal text-muted normal-case">
          {t.filters.keywordHint}
        </span>
      </label>
      <label className={label}>
        {t.filters.type}
        <select value={f.category} onChange={set('category')} className={field}>
          <option value="">{t.filters.anyType}</option>
          {meta?.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {t.categories[c.id] ?? c.id} ({c.count.toLocaleString()})
            </option>
          ))}
        </select>
      </label>
      {branded && (
        <label className={label}>
          {t.filters.brand}
          <select value={f.brand} onChange={set('brand')} className={field}>
            <option value="">{t.filters.anyBrand}</option>
            {brands.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="flex flex-wrap gap-x-2 gap-y-5">
        <label className={`${label} min-w-0 flex-[1_1_160px]`}>
          {t.filters.from}
          <input type="date" value={f.date_from} onChange={set('date_from')} className={`${field} font-mono`} />
        </label>
        <label className={`${label} min-w-0 flex-[1_1_160px]`}>
          {t.filters.to}
          <input type="date" value={f.date_to} onChange={set('date_to')} className={`${field} font-mono`} />
        </label>
      </div>
      <p className="m-0 text-[13px] leading-normal text-muted">{t.filters.dateNote}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          className="min-h-11 flex-1 cursor-pointer border-2 border-ink bg-signal px-4 font-extrabold text-ink hover:bg-[#ff7a47]"
        >
          {t.filters.apply}
        </button>
        <a
          href={href('catalogue')}
          className="flex min-h-11 items-center border-2 border-ink px-4 font-bold no-underline hover:bg-white"
        >
          {t.filters.reset}
        </a>
      </div>
    </form>
    </details>
  )
}
