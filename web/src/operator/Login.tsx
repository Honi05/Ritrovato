import { useState, type FormEvent } from 'react'
import { ApiError, opLogin, type Operator } from '../api'
import Logo from '../components/Logo'
import { href } from '../lib/router'
import { useOpT } from './strings'

export default function Login({ expired, onIn }: { expired: boolean; onIn: (op: Operator) => void }) {
  const t = useOpT()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(expired ? t.session : null)
  const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      onIn(await opLogin(username, password))
    } catch (err) {
      setError(err instanceof ApiError && err.status === 429 ? t.login.limited : t.login.wrong)
    } finally {
      setBusy(false)
    }
  }
  const field = 'min-h-12 border-2 border-ink bg-paper px-3 text-base font-normal'
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 px-4 py-10">
      <a href={href('')} className="flex items-center gap-3 text-ink no-underline">
        <Logo size={56} />
        <span className="font-widest text-[28px] font-black tracking-[0.04em]">RITROVATO</span>
      </a>
      <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-5 border-2 border-ink bg-card p-6 shadow-[8px_8px_0_#111] sm:p-8">
        <div className="flex flex-col gap-2">
          <span className="self-start bg-ink px-2 py-1 font-mono text-[11px] font-semibold tracking-[0.08em] text-card uppercase">{t.title}</span>
          <h1 className="font-wide m-0 text-3xl leading-tight font-black">{t.login.title}</h1>
          <p className="m-0 font-mono text-xs text-muted">{t.login.kicker}</p>
        </div>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">{t.login.username}
          <input required autoFocus autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} className={field} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">{t.login.password}
          <input required type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={field} />
        </label>
        {error && <p role="alert" className="m-0 border-l-[6px] border-signal bg-paper px-3 py-2 text-sm">{error}</p>}
        <button type="submit" disabled={busy} className="min-h-12 cursor-pointer border-2 border-ink bg-signal text-lg font-bold transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60">
          {busy ? '…' : t.login.submit}
        </button>
      </form>
      <a href={href('')} className="text-sm font-semibold">{t.login.back}</a>
    </div>
  )
}
