import { useId, useState } from 'react'
import { useI18n } from '../i18n'
import { href, navigate } from '../lib/router'
import { ArrowRight } from './Icons'

// Mic and photo buttons arrive with block 07; this block is text only.
// Callers pass `key={initial}` to reset the box when the query in the URL changes.
export default function SearchBar({ initial = '', big = false }: { initial?: string; big?: boolean }) {
  const { t } = useI18n()
  const [q, setQ] = useState(initial)
  const id = useId()

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        if (q.trim()) navigate(href('search', { q: q.trim() }))
      }}
      className={`flex flex-wrap border-[3px] border-ink bg-white ${big ? 'shadow-[8px_8px_0_#111]' : 'shadow-[6px_6px_0_#111]'}`}
    >
      <label htmlFor={id} className="sr-only">
        {t.search.label}
      </label>
      <input
        id={id}
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t.search.placeholder}
        maxLength={500}
        className={`min-w-0 flex-[1_1_280px] border-0 bg-transparent px-5 font-medium text-ink outline-none placeholder:text-[#6a6c64] ${big ? 'min-h-16 text-[19px]' : 'min-h-[58px] text-lg'}`}
      />
      <button
        type="submit"
        className={`flex flex-auto cursor-pointer items-center justify-center gap-2.5 border-0 border-l-2 border-ink bg-signal px-6 text-[17px] font-extrabold text-ink hover:bg-[#ff7a47] sm:flex-none ${big ? 'min-h-16' : 'min-h-[58px]'}`}
      >
        {t.search.submit}
        <ArrowRight size={20} />
      </button>
    </form>
  )
}
