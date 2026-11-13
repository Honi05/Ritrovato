import { useEffect, useState } from 'react'
import { searchText, type SearchResponse } from '../api'
import ItemTag from '../components/ItemTag'
import SearchBar from '../components/SearchBar'
import Understood from '../components/Understood'
import { useI18n } from '../i18n'
import { remember } from '../lib/items'
import { useLast, type Mode } from '../lib/lastSearch'
import { href } from '../lib/router'

type State = { status: 'idle' } | { status: 'loading' } | { status: 'error' } | { status: 'done'; res: SearchResponse }

// `params` is a fresh object on every navigation, so re-submitting the same query re-runs it.
export default function Search({ params }: { params: URLSearchParams }) {
  const mode = params.get('mode')
  if (mode === 'voice' || mode === 'photo') return <MediaSearch mode={mode} />
  return <TextSearch params={params} query={params.get('q') ?? ''} />
}

function TextSearch({ params, query }: { params: URLSearchParams; query: string }) {
  const { lang } = useI18n()
  const [state, setState] = useState<State>({ status: query ? 'loading' : 'idle' })

  // Re-run only when the URL changes: switching UI language must not spend another LLM call.
  useEffect(() => {
    if (!query) {
      setState({ status: 'idle' })
      return
    }
    let live = true
    setState({ status: 'loading' })
    searchText(query, lang).then(
      (res) => {
        remember(res.items)
        if (live) setState({ status: 'done', res })
      },
      () => live && setState({ status: 'error' }),
    )
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  return (
    <div className="flex flex-col gap-5 pt-8">
      <SearchBar key={query} initial={query} />
      <Results state={state} query={query} />
    </div>
  )
}

function MediaSearch({ mode }: { mode: Mode }) {
  const { t } = useI18n()
  const last = useLast()
  const res = last?.mode === mode ? last.res : null
  const said = mode === 'voice' ? res?.transcript : res?.description

  return (
    <div className="flex flex-col gap-5 pt-8">
      <SearchBar />
      {res && said ? (
        <>
          <p className="m-0 border-l-[6px] border-signal bg-card px-4 py-3 text-lg leading-snug">
            <span className="font-mono text-xs font-semibold tracking-[0.06em] uppercase">
              {mode === 'voice' ? t.media.youSaid : t.media.weSee}
            </span>
            <br />
            <b data-testid="said">{mode === 'voice' ? `“${said}”` : said}</b>
          </p>
          <Results state={{ status: 'done', res }} query={said} />
        </>
      ) : (
        <p className="m-0 border-2 border-dashed border-ink p-5">{mode === 'voice' ? t.media.noTranscript : t.media.noObject}</p>
      )}
    </div>
  )
}

function Results({ state, query }: { state: State; query: string }) {
  const { t, lang } = useI18n()
  const res = state.status === 'done' ? state.res : null
  const refine = res?.interpreted
    ? href('catalogue', {
        category: res.interpreted.category ?? undefined,
        brand: res.interpreted.brand ?? undefined,
        date_from: res.interpreted.date_from ?? undefined,
        date_to: res.interpreted.date_to ?? undefined,
      })
    : href('catalogue', { q: query })

  return (
    <>
      {res && <Understood interpreted={res.interpreted} />}

      <section aria-live="polite" aria-busy={state.status === 'loading'} className="flex flex-col gap-3.5 pt-3">
        {state.status === 'loading' && <p className="m-0 font-mono text-sm">{t.search.loading}</p>}
        {state.status === 'error' && <p className="m-0 border-2 border-ink bg-card p-4">{t.search.error}</p>}
        {res && (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h1 className="font-wide m-0 text-[30px] font-black">{t.search.matches(res.total)}</h1>
              <span className="font-mono text-[13px] uppercase">{t.search.newest}</span>
            </div>
            {res.items.length === 0 && <p className="m-0 border-2 border-dashed border-ink p-5">{t.search.none}</p>}
            {res.items.map((it, i) => (
              <ItemTag key={it.id} item={it} highlight={i === 0} />
            ))}
            {res.total > res.items.length && (
              <a
                href={refine}
                className="self-start border-2 border-ink px-5 py-3 font-bold no-underline hover:bg-card"
              >
                {t.search.more} ({(res.total - res.items.length).toLocaleString(lang)})
              </a>
            )}
            <p className="m-0 font-mono text-[13px] text-muted">{t.search.hidden}</p>
          </>
        )}
      </section>
    </>
  )
}
