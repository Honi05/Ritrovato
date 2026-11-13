import { expect, test, type Page } from '@playwright/test'

// Voice and photo are stubbed with page.route: no ElevenLabs/vision keys needed.
// Text search and /api/meta still hit the real backend on :8000 unless a test stubs them.

const KEYS = {
  items: [
    {
      id: '2026-1234-9',
      year: 2026,
      reperto: 1234,
      date: '2026-10-03',
      descr: 'MAZZO DI CHIAVI - CON PORTACHIAVI',
      category: 'keys',
      tags: [],
      brand: null,
      source: { page: 9, url: 'https://www.comune.roma.it/x.pdf' },
    },
  ],
  total: 1,
  interpreted: { category: 'keys', brand: null, keywords: ['chiavi'], date_from: null, date_to: null, ignored: [] },
}

// 1x1 PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) })

async function setLang(page: Page, lang: string) {
  await page.getByRole('group').getByRole('button', { name: lang.toUpperCase(), exact: true }).click()
}

/** Replaces the microphone and MediaRecorder with fakes that "record" a few bytes. */
async function fakeRecorder(page: Page, opts: { denied?: boolean } = {}) {
  await page.addInitScript((denied) => {
    class FakeRecorder {
      static isTypeSupported = (m: string) => m === 'audio/webm'
      state = 'inactive'
      mimeType = 'audio/webm'
      ondataavailable: ((e: { data: Blob }) => void) | null = null
      onstop: (() => void) | null = null
      start() {
        this.state = 'recording'
      }
      stop() {
        this.state = 'inactive'
        this.ondataavailable?.({ data: new Blob([new Uint8Array(2048)], { type: 'audio/webm' }) })
        this.onstop?.()
      }
    }
    ;(window as unknown as { MediaRecorder: unknown }).MediaRecorder = FakeRecorder
    const gum = denied
      ? () => Promise.reject(new DOMException('denied', 'NotAllowedError'))
      : () => Promise.resolve({ getTracks: () => [{ stop() {} }] })
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: gum }, configurable: true })
  }, !!opts.denied)
}

test('photo: description and results from a stubbed upload', async ({ page }) => {
  let seen = ''
  await page.route('**/api/search/photo', async (route) => {
    const req = route.request()
    seen = req.headers()['content-type'] ?? ''
    expect(req.postData() ?? '').toContain('name="image"')
    await new Promise((r) => setTimeout(r, 400))
    await route.fulfill(json({ ...KEYS, description: 'a bunch of keys on a ring' }))
  })
  await page.goto('/')
  await setLang(page, 'en')
  await page.getByTestId('photo-input').setInputFiles({ name: 'keys.png', mimeType: 'image/png', buffer: PNG })
  await expect(page.getByText('Looking at the photo…')).toBeVisible()
  await expect(page).toHaveURL(/#\/search\?mode=photo/)
  await expect(page.getByTestId('said')).toHaveText('a bunch of keys on a ring')
  await expect(page.getByText('We see')).toBeVisible()
  await expect(page.locator('a[href^="#/item/"]')).toHaveCount(1)
  await expect(page.locator('a[href^="#/item/"]').first()).toContainText('1234')
  expect(seen).toContain('multipart/form-data')

  // The result survives a reload (sessionStorage) and opens the entry card.
  await page.reload()
  await expect(page.getByTestId('said')).toHaveText('a bunch of keys on a ring')
  await page.locator('a[href^="#/item/"]').first().click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('1234')
})

test('photo: description null shows a friendly message and stays put', async ({ page }) => {
  await page.route('**/api/search/photo', (r) =>
    r.fulfill(json({ items: [], total: 0, interpreted: null, description: null })),
  )
  await page.goto('/')
  await setLang(page, 'en')
  await page.getByTestId('photo-input').setInputFiles({ name: 'x.png', mimeType: 'image/png', buffer: PNG })
  await expect(page.getByRole('status')).toContainText("couldn't recognise an object")
  await expect(page).not.toHaveURL(/mode=photo/)
  // Text search is still there.
  await expect(page.getByRole('searchbox')).toBeVisible()
})

test('photo: an unreadable non-image format asks for JPEG without calling the API', async ({ page }) => {
  let called = false
  await page.route('**/api/search/photo', (r) => {
    called = true
    return r.fulfill(json(KEYS))
  })
  await page.goto('/')
  await setLang(page, 'en')
  await page.getByTestId('photo-input').setInputFiles({ name: 'a.heic', mimeType: 'image/heic', buffer: Buffer.from('not an image') })
  await expect(page.getByRole('status')).toContainText('JPEG or PNG')
  expect(called).toBe(false)
})

test('photo: a 3000 px image is shrunk to at most 2000 px JPEG before upload', async ({ page }) => {
  let sent: Buffer | null = null
  await page.route('**/api/search/photo', async (route) => {
    sent = route.request().postDataBuffer()
    await route.fulfill(json({ ...KEYS, description: 'keys' }))
  })
  await page.goto('/')
  await page.evaluate(async () => {
    const c = document.createElement('canvas')
    c.width = 3000
    c.height = 1500
    const g = c.getContext('2d')!
    g.fillStyle = '#c33'
    g.fillRect(0, 0, 3000, 1500)
    const blob: Blob = await new Promise((ok) => c.toBlob((b) => ok(b!), 'image/png'))
    const dt = new DataTransfer()
    dt.items.add(new File([blob], 'big.png', { type: 'image/png' }))
    const input = document.querySelector<HTMLInputElement>('[data-testid="photo-input"]')!
    input.files = dt.files
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await expect(page).toHaveURL(/mode=photo/)
  const body = sent as Buffer | null
  expect(body).not.toBeNull()
  expect(body!.includes(Buffer.from('image/jpeg'))).toBe(true)
  // JPEG start-of-frame marker holds height then width.
  const sof = body!.indexOf(Buffer.from([0xff, 0xc0]))
  const alt = sof >= 0 ? sof : body!.indexOf(Buffer.from([0xff, 0xc2]))
  expect(alt).toBeGreaterThan(0)
  const h = body!.readUInt16BE(alt + 5)
  const w = body!.readUInt16BE(alt + 7)
  expect(Math.max(w, h)).toBeLessThanOrEqual(2000)
  expect(w).toBe(2000)
})

test('photo: 413 says the file is too large', async ({ page }) => {
  await page.route('**/api/search/photo', (r) =>
    r.fulfill(json({ error: 'too_large', message: 'image exceeds 8 MB' }, 413)),
  )
  await page.goto('/')
  await setLang(page, 'en')
  await page.getByTestId('photo-input').setInputFiles({ name: 'x.png', mimeType: 'image/png', buffer: PNG })
  await expect(page.getByRole('status')).toContainText('too large')
})

test('photo: non-JSON 502 and FastAPI {detail} bodies give the retry message', async ({ page }) => {
  let n = 0
  await page.route('**/api/search/photo', (r) =>
    ++n === 1
      ? r.fulfill({ status: 502, contentType: 'text/html', body: '<html>Bad gateway</html>' })
      : r.fulfill(json({ detail: [{ msg: 'field required' }] }, 422)),
  )
  await page.goto('/')
  await setLang(page, 'en')
  const input = page.getByTestId('photo-input')
  await input.setInputFiles({ name: 'x.png', mimeType: 'image/png', buffer: PNG })
  await expect(page.getByRole('status')).toContainText('Something went wrong')
  await input.setInputFiles({ name: 'y.png', mimeType: 'image/png', buffer: PNG })
  await expect(page.getByRole('status')).toContainText('Something went wrong')
  expect(n).toBe(2)
})

test('voice: record, stop, transcript and results (Spanish UI)', async ({ page }) => {
  await fakeRecorder(page)
  let lang = ''
  await page.route('**/api/search/voice', async (route) => {
    const data = route.request().postData() ?? ''
    lang = /name="lang"\r\n\r\n(\w+)/.exec(data)?.[1] ?? ''
    expect(data).toContain('name="audio"')
    await new Promise((r) => setTimeout(r, 400))
    await route.fulfill(json({ ...KEYS, transcript: 'perdí mis llaves' }))
  })
  await page.goto('/')
  await setLang(page, 'es')
  await page.getByRole('button', { name: 'Hablar' }).click()
  await expect(page.getByText(/Grabando/)).toBeVisible()
  await page.getByRole('button', { name: 'Parar' }).click()
  await expect(page.getByText('Transcribiendo…')).toBeVisible()
  await expect(page).toHaveURL(/#\/search\?mode=voice/)
  await expect(page.getByTestId('said')).toHaveText('“perdí mis llaves”')
  await expect(page.getByText('Has dicho')).toBeVisible()
  await expect(page.locator('a[href^="#/item/"]')).toHaveCount(1)
  expect(lang).toBe('es')
})

test('voice: empty transcript says it did not catch that', async ({ page }) => {
  await fakeRecorder(page)
  await page.route('**/api/search/voice', (r) => r.fulfill(json({ items: [], total: 0, interpreted: null, transcript: '' })))
  await page.goto('/')
  await setLang(page, 'en')
  await page.getByRole('button', { name: 'Speak' }).click()
  await page.getByRole('button', { name: 'Stop' }).click()
  await expect(page.getByRole('status')).toContainText("didn't catch that")
  await expect(page).not.toHaveURL(/mode=voice/)
})

test('voice: microphone permission denied leaves text search working', async ({ page }) => {
  await fakeRecorder(page, { denied: true })
  await page.goto('/')
  await setLang(page, 'en')
  await page.getByRole('button', { name: 'Speak' }).click()
  await expect(page.getByRole('status')).toContainText('Microphone access was blocked')
  await page.getByRole('searchbox').fill('chiavi')
  await page.getByRole('searchbox').press('Enter')
  await expect(page).toHaveURL(/#\/search\?q=chiavi/)
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/possible match/)
})

test('voice: no MediaRecorder gives a clear message', async ({ page }) => {
  await page.addInitScript(() => {
    delete (window as unknown as { MediaRecorder?: unknown }).MediaRecorder
  })
  await page.goto('/')
  await setLang(page, 'en')
  await page.getByRole('button', { name: 'Speak' }).click()
  await expect(page.getByRole('status')).toContainText('not available in this browser')
})

test('mic and photo buttons are tappable and the page does not scroll sideways', async ({ page }) => {
  await page.goto('/')
  await setLang(page, 'en')
  for (const name of ['Speak', 'Photo']) {
    const box = await page.getByRole('button', { name }).boundingBox()
    expect(box!.height).toBeGreaterThanOrEqual(44)
    expect(box!.width).toBeGreaterThanOrEqual(44)
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})

test('footer: daily-update claim only when a check has run', async ({ page }) => {
  const meta = { total: 15560, last_item_date: '2026-11-04', new_items_last_check: 37, categories: [], source_url: 'x' }
  await page.route('**/api/meta', (r) => r.fulfill(json({ ...meta, last_checked_at: null })))
  await page.goto('/#/collect')
  await setLang(page, 'en')
  await expect(page.getByTestId('freshness')).toHaveText('Data as of 04/11/2026 · 15,560 entries')
  await expect(page.getByTestId('freshness')).not.toContainText('daily')

  await page.unroute('**/api/meta')
  await page.route('**/api/meta', (r) => r.fulfill(json({ ...meta, last_checked_at: '2026-11-14T06:00:00Z' })))
  await page.reload()
  await expect(page.getByTestId('freshness')).toContainText('Updated daily — last check')
  await expect(page.getByTestId('freshness')).toContainText('37 new entries')
})

test('search: empty q does not hang and re-submitting the same query re-runs it', async ({ page }) => {
  await page.goto('/#/search')
  await expect(page.getByText('Searching the register…')).toHaveCount(0)
  await expect(page.getByRole('searchbox')).toBeVisible()

  let calls = 0
  await page.route('**/api/search', (r) => {
    calls++
    return r.fulfill(json(KEYS))
  })
  await page.goto('/#/search?q=chiavi')
  await expect(page.locator('a[href^="#/item/"]')).toHaveCount(1)
  expect(calls).toBe(1)
  await page.getByRole('searchbox').press('Enter')
  await expect.poll(() => calls).toBe(2)
})

test('entry card with a null reperto never prints "null"', async ({ page }) => {
  const item = { ...KEYS.items[0], id: '2026-x-3', reperto: null }
  await page.route('**/api/search', (r) => r.fulfill(json({ ...KEYS, items: [item] })))
  await page.goto('/#/search?q=chiavi')
  await page.locator('a[href^="#/item/"]').first().click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('—')
  expect(await page.locator('body').innerText()).not.toContain('null')
})
