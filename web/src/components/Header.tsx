import { LANGS } from '../api'
import { useI18n } from '../i18n'
import { href, type Route } from '../lib/router'
import { TagIcon } from './Icons'

export default function Header({ route }: { route: Route }) {
  const { t, lang, setLang } = useI18n()
  const navLink = 'py-2 no-underline decoration-[3px] underline-offset-[6px]'

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-ink py-5">
      <a href={href('')} className="flex items-center gap-2.5 text-ink no-underline">
        <TagIcon size={30} />
        <span className="font-widest text-[22px] font-black tracking-[0.04em]">RITROVATO</span>
      </a>
      <nav aria-label={t.nav.main} className="flex flex-wrap gap-6 text-[15px] font-semibold">
        <a
          href={href('catalogue')}
          aria-current={route.name === 'catalogue' ? 'page' : undefined}
          className={`${navLink} ${route.name === 'catalogue' ? 'underline' : ''}`}
        >
          {t.nav.catalogue}
        </a>
        <a
          href={href('collect')}
          aria-current={route.name === 'collect' ? 'page' : undefined}
          className={`${navLink} ${route.name === 'collect' ? 'underline' : ''}`}
        >
          {t.nav.collect}
        </a>
      </nav>
      <div role="group" aria-label={t.nav.language} className="flex border-2 border-ink font-mono text-[13px] font-semibold">
        {LANGS.map((l) => (
          <button
            key={l}
            type="button"
            lang={l}
            aria-pressed={l === lang}
            onClick={() => setLang(l)}
            className={`min-h-9 min-w-11 cursor-pointer ${l === lang ? 'bg-ink text-paper' : 'bg-transparent text-ink hover:bg-card'}`}
          >
            {l.toUpperCase()}
          </button>
        ))}
      </div>
    </header>
  )
}

