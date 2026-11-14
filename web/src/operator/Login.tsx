import { useState, type FormEvent } from 'react'
import { ApiError, opLogin, type Operator } from '../api'
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
  const field = 'min-h-11 border-2 border-ink bg-card px-3 text-base'
  return (
    <form onSubmit={submit} className="mx-auto mt-16 flex max-w-sm flex-col gap-4 px-4">
      <h1 className="font-wide m-0 text-3xl font-black">{t.login.title}</h1>
      <label className="flex flex-col gap-1 font-semibold">{t.login.username}
        <input required autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} className={field} />
      </label>
      <label className="flex flex-col gap-1 font-semibold">{t.login.password}
        <input required type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={field} />
      </label>
      {error && <p role="alert" className="m-0 border-l-[6px] border-signal bg-card px-3 py-2">{error}</p>}
      <button type="submit" disabled={busy} className="min-h-12 border-2 border-ink bg-signal font-bold">{t.login.submit}</button>
    </form>
  )
}
