import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { ApiError, opLogout, opMe, type Operator } from '../api'
import { href, navigate } from '../lib/router'
import Bookings from './Bookings'
import Intake from './Intake'
import Inventory from './Inventory'
import Login from './Login'
import { useOpT } from './strings'
import Today from './Today'

type Page = 'today' | 'login' | 'new' | 'items' | 'bookings'

/** Any operator call that fails with 401 goes through this: back to login with a note. */
const Guard = createContext<(e: unknown) => void>(() => undefined)
// eslint-disable-next-line react-refresh/only-export-components
export const useGuard = () => useContext(Guard)

export default function OperatorApp({ page, params }: { page: Page; params: URLSearchParams }) {
  const t = useOpT()
  const [me, setMe] = useState<Operator | null | 'out'>(null)
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    opMe().then(setMe, () => setMe('out'))
  }, [page])

  const guard = useCallback((e: unknown) => {
    if (e instanceof ApiError && e.status === 401) {
      setExpired(true)
      setMe('out')
    }
  }, [])

  useEffect(() => {
    if (me === 'out' && page !== 'login') navigate(href('operator/login'))
  }, [me, page])

  if (page === 'login' || me === 'out') {
    return <Login expired={expired} onIn={(op) => { setExpired(false); setMe(op); navigate(href('operator')) }} />
  }
  if (me === null) return <p className="p-6 font-mono">…</p>

  const link = (p: Page, label: string) => (
    <a href={href(p === 'today' ? 'operator' : `operator/${p}`)} aria-current={page === p ? 'page' : undefined}
      className={`py-2 font-semibold no-underline ${page === p ? 'underline decoration-[3px] underline-offset-[6px]' : ''}`}>
      {label}
    </a>
  )
  return (
    <Guard.Provider value={guard}>
      <div className="mx-auto box-border max-w-[1200px] px-4 pb-16 sm:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-ink py-4">
          <span className="font-widest text-lg font-black tracking-[0.04em]">RITROVATO · {t.title}</span>
          <nav aria-label={t.title} className="flex flex-wrap gap-5 text-[15px]">
            {link('today', t.nav.today)}
            {link('new', t.nav.new)}
            {link('items', t.nav.items)}
            {link('bookings', t.nav.bookings)}
          </nav>
          <span className="flex items-center gap-3 text-sm">
            {me.display_name}
            <button type="button" onClick={() => opLogout().finally(() => setMe('out'))} className="min-h-10 border-2 border-ink bg-card px-3 font-semibold">
              {t.logout}
            </button>
          </span>
        </header>
        <main className="pt-6">
          {page === 'today' && <Today />}
          {page === 'new' && <Intake />}
          {page === 'items' && <Inventory params={params} />}
          {page === 'bookings' && <Bookings params={params} />}
        </main>
      </div>
    </Guard.Provider>
  )
}
