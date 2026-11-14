import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { ApiError, opLogout, opMe, type Operator } from '../api'
import Logo from '../components/Logo'
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
  if (me === null) return <p className="p-6 font-mono animate-pulse">…</p>

  const link = (p: Page, label: string) => (
    <a href={href(p === 'today' ? 'operator' : `operator/${p}`)} aria-current={page === p ? 'page' : undefined}
      className={`border-2 px-3 py-1.5 font-semibold no-underline ${page === p ? 'border-ink bg-ink text-card hover:text-card' : 'border-transparent hover:border-ink'}`}>
      {label}
    </a>
  )
  return (
    <Guard.Provider value={guard}>
      <div className="mx-auto box-border max-w-[1200px] px-4 pb-16 sm:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-ink py-4">
          <a href={href('operator')} className="flex items-center gap-2.5 text-ink no-underline">
            <Logo size={36} />
            <span className="font-widest text-lg font-black tracking-[0.04em]">RITROVATO</span>
            <span className="bg-signal px-1.5 py-0.5 font-mono text-[11px] font-semibold tracking-[0.08em] uppercase">{t.title}</span>
          </a>
          <nav aria-label={t.title} className="flex flex-wrap gap-1 text-[15px]">
            {link('today', t.nav.today)}
            {link('new', t.nav.new)}
            {link('items', t.nav.items)}
            {link('bookings', t.nav.bookings)}
          </nav>
          <span className="flex items-center gap-3 text-sm font-semibold">
            <span aria-hidden="true" className="grid size-9 place-items-center rounded-full border-2 border-ink bg-manila font-mono font-bold uppercase">{me.display_name.slice(0, 1)}</span>
            {me.display_name}
            <button type="button" onClick={() => opLogout().finally(() => setMe('out'))} className="min-h-10 cursor-pointer border-2 border-ink bg-card px-3 font-semibold hover:bg-paper">
              {t.logout}
            </button>
          </span>
        </header>
        <main className="pt-8">
          {page === 'today' && <Today />}
          {page === 'new' && <Intake />}
          {page === 'items' && <Inventory params={params} />}
          {page === 'bookings' && <Bookings params={params} />}
        </main>
      </div>
    </Guard.Provider>
  )
}
