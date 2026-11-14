import { useEffect, useState } from 'react'
import { officeNumber, opListItems, opPatchItem, type OperatorItem } from '../api'
import { useI18n } from '../i18n'
import { CATEGORIES } from '../lib/colours'
import { formatDate } from '../lib/items'
import ItemForm from './ItemForm'
import { useGuard } from './OperatorApp'
import { useOpT } from './strings'

const STATUSES = ['available', 'reserved', 'returned', 'discarded'] as const
const PAGE = 50

export default function Inventory({ params }: { params: URLSearchParams }) {
  const t = useOpT()
  const { t: pub } = useI18n()
  const guard = useGuard()
  const [status, setStatus] = useState(params.get('status') ?? '')
  const [category, setCategory] = useState('')
  const [q, setQ] = useState('')
  const [data, setData] = useState<{ items: OperatorItem[]; total: number } | null>(null)
  const [editing, setEditing] = useState<OperatorItem | null>(null)
  const [busy, setBusy] = useState(false)

  const load = (offset = 0) =>
    opListItems({ status, category, q, limit: PAGE, offset }).then(
      (r) => setData((d) => (offset && d ? { items: [...d.items, ...r.items], total: r.total } : r)),
      guard,
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [status, category])

  const replace = (it: OperatorItem) => {
    setData((d) => d && { ...d, items: d.items.map((x) => (x.id === it.id ? it : x)) })
    setEditing(null)
  }
  const field = 'min-h-11 border-2 border-ink bg-card px-3'
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-wide m-0 text-4xl font-black">{t.inventory.title}</h1>
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); load() }}>
        <select aria-label="status" value={status} onChange={(e) => setStatus(e.target.value)} className={field}>
          <option value="">{t.inventory.all}</option>
          {STATUSES.map((s) => <option key={s} value={s}>{t.status[s]}</option>)}
        </select>
        <select aria-label="category" value={category} onChange={(e) => setCategory(e.target.value)} className={field}>
          <option value="">{t.inventory.all}</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{pub.categories[c] ?? c}</option>)}
        </select>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.inventory.search} className={`${field} min-w-0 flex-1`} />
        <button type="submit" className="min-h-11 border-2 border-ink bg-card px-4 font-semibold">{t.inventory.search}</button>
      </form>
      {data && data.items.length === 0 && <p className="m-0 border-2 border-dashed border-ink p-4">{t.inventory.empty}</p>}
      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(260px,100%),1fr))] gap-3 p-0">
        {data?.items.map((it) => (
          <li key={it.id} data-testid="inventory-item" className="flex flex-col border-2 border-ink bg-card">
            {it.photo_url && <img src={it.photo_url} alt="" className="aspect-[4/3] w-full border-b-2 border-ink object-cover" />}
            <div className="flex flex-col gap-1 p-3">
              <span className="font-mono text-xs uppercase">{it.id} · {t.status[it.status]}</span>
              <b>{it.descr}</b>
              <span className="text-sm text-muted">{it.found_place} · {formatDate(it.date)}</span>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" onClick={() => setEditing(it)} className="min-h-10 border-2 border-ink px-3 text-sm font-semibold">{t.inventory.edit}</button>
                {(it.status === 'available' || it.status === 'reserved') && (
                  <>
                    <button type="button" onClick={() => opPatchItem(officeNumber(it.id), { status: 'returned' }).then(replace, guard)} className="min-h-10 border-2 border-ink px-3 text-sm font-semibold">{t.inventory.markReturned}</button>
                    <button type="button" onClick={() => opPatchItem(officeNumber(it.id), { status: 'discarded' }).then(replace, guard)} className="min-h-10 border-2 border-ink px-3 text-sm font-semibold">{t.inventory.discard}</button>
                  </>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {data && data.total > data.items.length && (
        <button type="button" onClick={() => load(data.items.length)} className="min-h-11 self-start border-2 border-ink bg-card px-4 font-semibold">{t.inventory.more}</button>
      )}
      {editing && (
        <div role="dialog" aria-modal="true" aria-label={t.inventory.edit} className="fixed inset-0 z-10 flex justify-end bg-black/40">
          <div className="h-full w-full max-w-xl overflow-y-auto border-l-2 border-ink bg-paper p-5">
            <button type="button" onClick={() => setEditing(null)} className="mb-4 min-h-10 border-2 border-ink bg-card px-3 font-semibold">{t.inventory.close}</button>
            <ItemForm
              initial={{ category: editing.category, brand: editing.brand, colour: editing.colour, descr: editing.descr, found_place: editing.found_place ?? '', found_at: editing.date }}
              photoUrl={editing.photo_url}
              busy={busy}
              submitLabel={t.form.save}
              onSubmit={(v) => {
                setBusy(true)
                opPatchItem(officeNumber(editing.id), { ...v, brand: v.brand?.trim() || null }).then(replace, guard).finally(() => setBusy(false))
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
