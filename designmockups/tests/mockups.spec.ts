import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PAGES = ['index', 'results', 'item', 'voice', 'photo', 'operator'];

async function open(page: Page, name: string) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const res = await page.goto(`/${name}.html`);
  expect(res?.status()).toBe(200);
  return errors;
}

for (const name of PAGES) {
  test.describe(name, () => {
    test('loads with a title and no errors', async ({ page }) => {
      const errors = await open(page, name);
      await expect(page).toHaveTitle(/\S/);
      await expect(page.locator('h1')).toHaveCount(1);
      expect(errors).toEqual([]);
    });

    test('every internal link points to an existing page', async ({ page, request }) => {
      await open(page, name);
      const hrefs = await page.locator('a[href$=".html"]').evaluateAll((as) => as.map((a) => a.getAttribute('href')!));
      expect(hrefs.length).toBeGreaterThan(0);
      for (const href of new Set(hrefs)) {
        expect((await request.get(`/${href}`)).status(), href).toBe(200);
      }
    });

    test('no horizontal scroll, content stays inside the 16px gutter', async ({ page }) => {
      await open(page, name);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      // Full-bleed bars (starting at x=0) and decoration (aria-hidden) are allowed to touch the edge.
      const offenders = await page.evaluate(() =>
        [...document.body.querySelectorAll('*')]
          .filter((el) => !el.closest('[aria-hidden="true"]'))
          .map((el) => ({ el, r: el.getBoundingClientRect() }))
          .filter(({ r }) => r.width > 0 && r.left > 0.5 && r.right > window.innerWidth - 16 + 0.5)
          .map(({ el, r }) => `${el.tagName.toLowerCase()} right=${Math.round(r.right)}`),
      );
      expect(offenders).toEqual([]);
    });

    test('never shows IMEI or document numbers', async ({ page }) => {
      await open(page, name);
      const text = await page.locator('body').innerText();
      expect(text).not.toMatch(/IMEI:\s*\d/);
      expect(text).not.toMatch(/Nr:\s*\S/);
      expect(text).not.toMatch(/\d{9,}/);
    });

    test('no serious accessibility violations', async ({ page }) => {
      await open(page, name);
      const { violations } = await new AxeBuilder({ page }).analyze();
      const bad = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`)).toEqual([]);
    });
  });
}

test.describe('click-through flow', () => {
  test('home → results → item → back', async ({ page }) => {
    await page.goto('/index.html');
    await page.getByRole('link', { name: 'Search', exact: false }).filter({ hasText: 'Search' }).first().click();
    await expect(page).toHaveURL(/results\.html/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('17 possible matches');
    await page.getByRole('link', { name: /6544/ }).click();
    await expect(page).toHaveURL(/item\.html/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('6544');
    await page.getByRole('link', { name: /Back to 17 matches/ }).click();
    await expect(page).toHaveURL(/results\.html/);
  });

  test('home mic → voice, camera → photo', async ({ page }) => {
    await page.goto('/index.html');
    await page.getByRole('link', { name: 'Search by voice' }).click();
    await expect(page).toHaveURL(/voice\.html/);
    await page.goto('/index.html');
    await page.getByRole('link', { name: 'Search by photo' }).click();
    await expect(page).toHaveURL(/photo\.html/);
  });

  test('operators link → back-office, logo → home', async ({ page }) => {
    await page.goto('/index.html');
    await page.getByRole('link', { name: 'Operators' }).click();
    await expect(page).toHaveURL(/operator\.html/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nuovo reperto');
    await page.goto('/results.html');
    await page.getByRole('link', { name: 'RITROVATO' }).click();
    await expect(page).toHaveURL(/index\.html/);
  });
});
