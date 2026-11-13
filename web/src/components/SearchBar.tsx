import { useEffect, useId, useRef, useState } from 'react'
import { ApiError, searchPhoto, searchVoice, type SearchResponse } from '../api'
import { useI18n } from '../i18n'
import { setLast, type Mode } from '../lib/lastSearch'
import { MAX_RECORD_MS, MediaProblem, canRecord, checkAudio, pickMime, prepareImage } from '../lib/media'
import { remember } from '../lib/items'
import { href, navigate } from '../lib/router'
import { ArrowRight, Camera, Mic, Stop } from './Icons'

type Status =
  | { kind: 'idle' }
  | { kind: 'recording'; secs: number }
  | { kind: 'busy'; mode: Mode }
  | { kind: 'message'; text: string }

// Callers pass `key={initial}` to reset the box when the query in the URL changes.
export default function SearchBar({ initial = '', big = false }: { initial?: string; big?: boolean }) {
  const { t, lang } = useI18n()
  const [q, setQ] = useState(initial)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const id = useId()
  const fileRef = useRef<HTMLInputElement>(null)
  const textRef = useRef<HTMLInputElement>(null)
  const rec = useRef<{ mr: MediaRecorder; stream: MediaStream; timer: number; tick: number } | null>(null)
  const alive = useRef(true)
  const m = t.media

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      if (rec.current) {
        window.clearTimeout(rec.current.timer)
        window.clearInterval(rec.current.tick)
        rec.current.mr.ondataavailable = null
        rec.current.mr.onstop = null
        if (rec.current.mr.state !== 'inactive') rec.current.mr.stop()
        rec.current.stream.getTracks().forEach((tr) => tr.stop())
        rec.current = null
      }
    }
  }, [])

  const fail = (e: unknown) => {
    if (!alive.current) return
    let text = m.failed
    if (e instanceof MediaProblem) text = m[e.kind]
    else if (e instanceof ApiError && e.status === 413) text = m.tooLarge
    else if (e instanceof ApiError && e.status === 429) text = m.rateLimited
    setStatus({ kind: 'message', text })
    // Rate limit or server trouble: send the user to the text box, keeping what they typed.
    if (e instanceof ApiError && (e.status === 429 || e.status === 502)) textRef.current?.focus()
  }

  /** Stores a voice/photo response and opens its result page, or explains why there is nothing to show. */
  const finish = (mode: Mode, res: SearchResponse) => {
    if (!alive.current) return
    const empty = mode === 'voice' ? !res.transcript?.trim() : !res.description
    if (empty) {
      setStatus({ kind: 'message', text: mode === 'voice' ? m.noTranscript : m.noObject })
      return
    }
    remember(res.items)
    setLast(mode, res)
    setStatus({ kind: 'idle' })
    navigate(href('search', { mode }))
  }

  const sendVoice = async (blob: Blob) => {
    setStatus({ kind: 'busy', mode: 'voice' })
    try {
      checkAudio(blob)
      finish('voice', await searchVoice(blob, lang))
    } catch (e) {
      fail(e)
    }
  }

  const stopRecording = () => {
    if (rec.current?.mr.state === 'recording') rec.current.mr.stop()
  }

  const startRecording = async () => {
    if (!canRecord()) return setStatus({ kind: 'message', text: m.noMic })
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      return setStatus({ kind: 'message', text: m.micDenied })
    }
    if (!alive.current) return stream.getTracks().forEach((tr) => tr.stop())
    try {
      const mime = pickMime()
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      const chunks: Blob[] = []
      const started = Date.now()
      mr.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data)
      mr.onstop = () => {
        if (rec.current) {
          window.clearTimeout(rec.current.timer)
          window.clearInterval(rec.current.tick)
        }
        stream.getTracks().forEach((tr) => tr.stop())
        rec.current = null
        if (alive.current) void sendVoice(new Blob(chunks, { type: mr.mimeType || mime || 'audio/webm' }))
      }
      const timer = window.setTimeout(stopRecording, MAX_RECORD_MS)
      const tick = window.setInterval(
        () => alive.current && setStatus({ kind: 'recording', secs: Math.floor((Date.now() - started) / 1000) }),
        500,
      )
      rec.current = { mr, stream, timer, tick }
      mr.start()
      setStatus({ kind: 'recording', secs: 0 })
    } catch {
      stream.getTracks().forEach((tr) => tr.stop())
      setStatus({ kind: 'message', text: m.noMic })
    }
  }

  const onPhoto = async (file: File | undefined) => {
    if (!file) return
    setStatus({ kind: 'busy', mode: 'photo' })
    try {
      finish('photo', await searchPhoto(await prepareImage(file), lang))
    } catch (e) {
      fail(e)
    }
  }

  const recording = status.kind === 'recording'
  const busy = status.kind === 'busy'
  const row = big ? 'min-h-16' : 'min-h-[58px]'
  const btn = `flex flex-1 cursor-pointer items-center justify-center gap-2 border-0 border-t-2 border-ink px-4 text-base font-extrabold text-ink disabled:cursor-wait disabled:opacity-50 sm:flex-none sm:border-t-0 sm:border-l-2 ${row}`

  return (
    <div className="flex flex-col gap-3">
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
          ref={textRef}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t.search.placeholder}
          maxLength={500}
          className={`min-w-0 flex-[1_1_280px] border-0 bg-transparent px-5 font-medium text-ink outline-none placeholder:text-[#6a6c64] ${big ? 'min-h-16 text-[19px]' : 'min-h-[58px] text-lg'}`}
        />
        <button
          type="button"
          onClick={recording ? stopRecording : startRecording}
          disabled={busy}
          aria-pressed={recording}
          className={`${btn} ${recording ? 'bg-ink text-card' : 'bg-white hover:bg-card'}`}
        >
          {recording ? <Stop size={20} className="animate-pulse text-signal" /> : <Mic size={20} />}
          {recording ? m.micStop : m.mic}
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy || recording}
          className={`${btn} bg-white hover:bg-card`}
        >
          <Camera size={20} />
          {m.photo}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          data-testid="photo-input"
          tabIndex={-1}
          aria-hidden="true"
          className="hidden"
          onChange={(e) => {
            void onPhoto(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        <button
          type="submit"
          className={`flex flex-auto cursor-pointer items-center justify-center gap-2.5 border-0 border-t-2 border-ink bg-signal px-6 text-[17px] font-extrabold text-ink hover:bg-[#ff7a47] sm:flex-none sm:border-t-0 sm:border-l-2 ${row}`}
        >
          {t.search.submit}
          <ArrowRight size={20} />
        </button>
      </form>
      <div role="status" aria-live="polite" className="empty:hidden">
        {status.kind === 'recording' && (
          <p className="m-0 flex items-center gap-2 font-mono text-sm font-semibold">
            <span aria-hidden="true" className="size-3 animate-pulse rounded-full bg-signal" />
            {m.rec(status.secs)}
          </p>
        )}
        {status.kind === 'busy' && (
          <p className="m-0 font-mono text-sm font-semibold">{status.mode === 'voice' ? m.transcribing : m.looking}</p>
        )}
        {status.kind === 'message' && <p className="m-0 border-2 border-ink bg-card p-3.5 text-[15px]">{status.text}</p>}
      </div>
    </div>
  )
}
