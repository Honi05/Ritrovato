import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import path from 'node:path'

// Needs the backend on :8000 with an operator created by:
//   cd server && .venv/Scripts/python.exe -m app.operators seed-demo --password "$OPERATOR_PASSWORD"
const USER = process.env.OPERATOR_USER ?? 'demo'
const PASSWORD = process.env.OPERATOR_PASSWORD ?? 'demo-pass-123'
const PHOTO = path.join(import.meta.dirname, 'fixtures', 'wallet.jpg')

test('operator logs an item, citizen books it, desk marks it collected', async ({ page, context }, info) => {
  const letters = (n: number) => Array.from({ length: n }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join('')
  const tag = `zz${info.project.name}${letters(10)}` // letters only: public descriptions drop digit runs (D-011)

  // AI pre-fill is mocked: the real draft is stored (re-posted via the API, because route.fetch()
  // corrupts multipart bodies), only the suggestions are replaced.
  await page.route('**/api/operator/items/draft', async (route) => {
    const res = await page.request.post('/api/operator/items/draft', {
      multipart: { image: { name: 'wallet.jpg', mimeType: 'image/jpeg', buffer: readFileSync(PHOTO) } },
    })
    const body = await res.json()
    await route.fulfill({ json: { ...body, suggested: { category: 'wallet', brand: null, colour: 'black', descr: `Portafoglio nero ${tag}` } } })
  })

  // 1. operator logs in and logs the item
  await page.goto('/#/operator')
  await expect(page).toHaveURL(/#\/operator\/login/)
  await page.getByLabel(/username|utente/i).fill(USER)
  await page.getByLabel(/password/i).fill(PASSWORD)
  await page.getByRole('button', { name: /log in|entra/i }).click()
  await expect(page.getByRole('button', { name: /log out|esci/i })).toBeVisible() // logged in; avoids racing the post-login redirect
  await page.goto('/#/operator/new')
  await page.getByTestId('photo-input').setInputFiles(PHOTO)
  await expect(page.getByLabel(/description|descrizione/i)).toHaveValue(`Portafoglio nero ${tag}`)
  await page.getByLabel(/where found|dove/i).fill('Stazione Termini')
  await page.getByRole('button', { name: /^(save|salva)$/i }).click()
  const toast = await page.getByTestId('toast').textContent()
  const officeId = toast!.match(/office-\d+/)![0]

  // 2. citizen (fresh context, no operator cookie) finds it and books
  const citizen = await context.browser()!.newContext()
  const c = await citizen.newPage()
  await c.goto(`/#/catalogue?source=office&q=${encodeURIComponent(tag)}`)
  await c.getByTestId('office-card').first().click()
  await expect(c).toHaveURL(new RegExp(`#/item/${officeId}`))
  await c.getByTestId('book-cta').click()
  const panel = c.getByTestId('booking-panel')
  // pick the first chip whose day has a free slot, asking the API (the server is authoritative)
  let picked = false
  for (const chip of await panel.locator('[data-day]').all()) {
    const day = await chip.getAttribute('data-day')
    const { slots } = await (await c.request.get(`/api/office/slots?date=${day}`)).json()
    if (slots.some((s: { free: boolean }) => s.free)) {
      await chip.click()
      picked = true
      break
    }
  }
  expect(picked, 'no free pickup slot in the next office days').toBeTruthy()
  // desktop and phone run in parallel: take different slots so they cannot collide on the same one
  await panel.getByTestId('slot').nth(info.project.name === 'phone' ? 1 : 0).click()
  await panel.getByLabel(/name|nome/i).fill('Ana Rossi')
  await panel.getByLabel(/email/i).fill(`${tag}@example.com`)
  await panel.getByRole('checkbox').check()
  await panel.getByRole('button', { name: /confirm|conferma/i }).click()
  await expect(c.getByTestId('booking-code')).toHaveText(/^RT-[A-Z2-9]{4}$/)
  const manage = await c.getByRole('textbox').inputValue()
  const slotDay = (await c.request.get(`/api/bookings/${manage.split('booking/')[1]}`).then((r) => r.json())).slot_start.slice(0, 10)

  // 3. desk sees the booking that day and marks it collected
  await page.goto(`/#/operator/bookings?date=${slotDay}`)
  const row = page.getByTestId('booking-row').filter({ hasText: `${tag}@example.com` })
  await row.getByRole('button', { name: /^(collected|ritirato)$/i }).click()
  await expect(row.getByRole('button', { name: /^(collected|ritirato)$/i })).toHaveCount(0) // the PATCH finished
  await expect(row).toContainText(/collected|ritirato/i)

  // 4. item is gone from the public side; manage page says collected
  expect((await c.request.get(`/api/items/${officeId}`)).status()).toBe(404)
  await c.goto(manage)
  await expect(c.getByTestId('booking-status')).toHaveText(/collected|ritirato|recogido|retiré|abgeholt/i)
  await citizen.close()
})
