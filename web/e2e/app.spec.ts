import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// Runs against the real API on :8000 (proxied by Vite). Numbers below come from the seed DB.
const DEMO = 'I lost my black Samsung phone in October'

test.beforeAll(async ({ request }) => {
  const res = await request.get('/api/health').catch(() => null)
  expect(res?.ok(), 'backend must run on :8000 (cd server && uvicorn app.main:app --port 8000)').toBeTruthy()
})

/** Collects page errors and console errors for the whole test. */
function watchErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  return errors
}

async function setLang(page: Page, lang: string) {
  await page.getByRole('group').getByRole('button', { name: lang.toUpperCase(), exact: true }).click()
}

async function search(page: Page, query: string) {
  await page.getByRole('searchbox').fill(query)
  await page.getByRole('searchbox').press('Enter')
  await expect(page).toHaveURL(/#\/search\?q=/)
}

test('home shows live register numbers and every category', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('/')
  await setLang(page, 'en')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Lost something in Rome?')
  await expect(page.getByText('15,560')).toBeVisible()
  await expect(page.locator('a[href^="#/catalogue?category="]')).toHaveCount(15)
  expect(errors).toEqual([])
})

const LANGS = {
  it: { h1: /14 possibili corrispondenze/, chip: 'Telefoni', colour: 'Colore' },
  en: { h1: /14 possible matches/, chip: 'Phones', colour: 'Colour' },
  es: { h1: /14 posibles coincidencias/, chip: 'Móviles', colour: 'Color' },
  fr: { h1: /14 correspondances possibles/, chip: 'Téléphones', colour: 'Couleur' },
  de: { h1: /14 mögliche Treffer/, chip: 'Handys', colour: 'Farbe' },
}

for (const [lang, want] of Object.entries(LANGS)) {
  test(`demo query works in ${lang}`, async ({ page }) => {
    const errors = watchErrors(page)
    await page.goto('/')
    await setLang(page, lang)
    await expect(page.locator('html')).toHaveAttribute('lang', lang)
    await search(page, DEMO)

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(want.h1)
    const understood = page.getByRole('region', { name: /./ }).filter({ has: page.getByText('SAMSUNG', { exact: true }) })
    await expect(understood.getByText(want.chip, { exact: true })).toBeVisible()
    await expect(understood.getByText('01/10/2026 – 31/10/2026')).toBeVisible()
    await expect(understood.getByText(want.colour, { exact: true })).toBeVisible()
    await expect(page.locator('a[href^="#/item/"]')).toHaveCount(14)
    await expect(page.locator('a[href^="#/item/"]').first()).toContainText('6544')
    expect(errors).toEqual([])
  })
}

test('result → entry card with pickup info → back', async ({ page }) => {
  await page.goto('/')
  await setLang(page, 'en')
  await search(page, DEMO)
  await page.locator('a[href^="#/item/"]').first().click()

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('6544')
  await expect(page.getByText('TELEFONO CELLULARE CON SIM · SAMSUNG · LYCA MOBILE')).toBeVisible()
  await expect(page.getByRole('link', { name: 'oggettismarriti@comune.roma.it' })).toBeVisible()
  await expect(page.getByText('Quote reperto 6544/2026')).toBeVisible()
  await expect(page.getByText('€4,60')).toBeVisible()
  await expect(page.getByRole('link', { name: 'PDF p. 481' })).toHaveAttribute('href', /comune\.roma\.it/)

  // A reload keeps the card (sessionStorage), then back returns to the results.
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('6544')
  await page.getByRole('button', { name: 'Back to results' }).click()
  await expect(page).toHaveURL(/#\/search/)
})

test('catalogue filters by category and brand, and pages', async ({ page }) => {
  await page.goto('/#/catalogue')
  await setLang(page, 'en')
  // Filters start collapsed on phones.
  const panel = page.locator('details').filter({ hasText: 'Filters' })
  if (!(await panel.evaluate((d: HTMLDetailsElement) => d.open))) await panel.locator('summary').click()
  await page.getByLabel('Type').selectOption('phone')
  await page.getByLabel('Brand').fill('samsung')
  await page.getByRole('button', { name: 'Apply' }).click()

  await expect(page).toHaveURL(/category=phone/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/possible matches/)
  const tags = page.locator('a[href^="#/item/"]')
  await expect(tags).toHaveCount(20)
  await expect(tags.first()).toContainText('SAMSUNG')
  await page.getByRole('button', { name: /Show more/ }).click()
  await expect(tags).toHaveCount(40)
  // Brand appears once per tag, not repeated in the subtitle.
  await expect(tags.first()).not.toContainText(/SAMSUNG.*SAMSUNG/)
})

test('home category tile opens the filtered catalogue', async ({ page }) => {
  await page.goto('/')
  await setLang(page, 'en')
  await page.getByRole('link', { name: /^Keys/ }).click()
  await expect(page).toHaveURL(/category=keys/)
  await expect(page.getByLabel('Type')).toHaveValue('keys')
})

test('language choice survives a reload', async ({ page }) => {
  await page.goto('/')
  await setLang(page, 'de')
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Etwas in Rom verloren?')
})

test('no IMEI or document numbers reach the page', async ({ page }) => {
  await page.goto('/#/catalogue?category=id_document')
  await expect(page.locator('a[href^="#/item/"]')).toHaveCount(20)
  await page.goto('/#/catalogue?category=phone')
  await expect(page.locator('a[href^="#/item/"]')).toHaveCount(20)
  const text = await page.locator('body').innerText()
  expect(text).not.toMatch(/IMEI:\s*\d/)
  expect(text).not.toMatch(/Nr:\s*\S/)
  expect(text).not.toMatch(/\d{6,}/)
})

for (const path of ['/', '/#/search?q=chiavi', '/#/catalogue', '/#/collect']) {
  test(`layout and accessibility: ${path}`, async ({ page }) => {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    const offenders = await page.evaluate(() =>
      [...document.body.querySelectorAll('*')]
        .filter((el) => !el.closest('[aria-hidden="true"]'))
        .map((el) => ({ el, r: el.getBoundingClientRect() }))
        .filter(({ r }) => r.width > 0 && r.left > 0.5 && r.right > window.innerWidth - 16 + 0.5)
        .map(({ el, r }) => `${el.tagName.toLowerCase()}.${el.className} right=${Math.round(r.right)}`),
    )
    expect(offenders).toEqual([])

    const { violations } = await new AxeBuilder({ page }).analyze()
    const bad = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
    expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`)).toEqual([])
  })
}
