// test/pwa.spec.mjs — installability requirements, checked against the served app:
// linked manifest with the fields Chrome requires, a service worker that reaches
// "activated" with the shell cached, and all referenced icons resolving.
import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:4322/';
const APP = BASE + 'insight-hunter.html';

test('manifest is linked and has the install-required fields', async ({ page }) => {
  await page.goto(APP);
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBe('manifest.webmanifest');
  const m = await page.evaluate(async () => (await fetch('manifest.webmanifest')).json());
  expect(m.name).toBe('InsightHunter');
  expect(m.display).toBe('standalone');
  expect(m.start_url).toBeTruthy();
  const sizes = m.icons.map((i) => i.sizes);
  expect(sizes).toContain('192x192');
  expect(sizes).toContain('512x512');
  expect(m.icons.some((i) => i.purpose === 'maskable')).toBe(true);
  expect(m.shortcuts.length).toBeGreaterThanOrEqual(2);
});

test('an install shortcut lands on the right screen and starts a session', async ({ page }) => {
  await page.goto(APP + '?go=session');
  await expect(page.locator('#tab-practice')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#add-practice-btn')).toBeVisible(); // a session is already running
  await page.goto(APP + '?go=library');
  await expect(page.locator('#tab-library')).toHaveAttribute('aria-selected', 'true');
});

test('service worker registers, activates, and caches the shell', async ({ page }) => {
  await page.goto(APP);
  const state = await page.evaluate(async () => {
    // `ready` resolves as soon as there is an active worker, which can still be "activating"
    // on a slow machine — wait for it to settle rather than racing it.
    const sw = (await navigator.serviceWorker.ready).active;
    if (sw.state !== 'activated') await new Promise((r) => sw.addEventListener('statechange', () => sw.state === 'activated' && r()));
    return sw.state;
  });
  expect(state).toBe('activated');
  const cached = await page.evaluate(async () => {
    const keys = await caches.keys();
    const cache = await caches.open(keys.find((k) => k.startsWith('ih-cache-')));
    return (await cache.keys()).length;
  });
  expect(cached).toBeGreaterThanOrEqual(5); // './' + manifest + icons
});

test('on an authorized origin the built-in Drive client id is offered', async ({ page }) => {
  // 127.0.0.1 counts as local dev in the origin gate, so no per-user setup is needed
  const googleHits = [];
  page.on('request', (r) => { if (/google|gstatic/.test(new URL(r.url()).hostname || '')) googleHits.push(r.url()); });
  await page.goto(APP);
  await page.click('.tab[data-tab="settings"]');
  const card = page.locator('.card', { hasText: 'Cloud backup' });
  await expect(card).toContainText('Not connected');
  await expect(page.locator('#drive-backup')).toBeVisible();
  await expect(page.locator('#drive-cid')).toHaveCount(0); // no client-ID field needed here
  expect(googleHits, 'sign-in must wait for a click').toEqual([]);
});

test('all manifest icons and the touch icon resolve', async ({ page, request }) => {
  await page.goto(APP);
  for (const file of ['icon-192.png', 'icon-512.png', 'icon-512-maskable.png', 'apple-touch-icon.png']) {
    const res = await request.get(BASE + file);
    expect(res.status(), file).toBe(200);
    expect(res.headers()['content-type'], file).toBe('image/png');
  }
});

test('app boots identically over http (SW path)', async ({ page }) => {
  await page.goto(APP);
  await expect(page.locator('#build-stamp')).toContainText('build');
  await page.click('.tab[data-tab="library"]');
  expect(await page.locator('#exercises .exercise').count()).toBeGreaterThanOrEqual(1);
  await expect(page.locator('h1 svg.logo')).toBeVisible();
});

test('the site root hands off to the app (GitHub Pages serves index.html)', async ({ request }) => {
  const res = await request.get(BASE + 'index.html');
  expect(res.status()).toBe(200);
  expect(await res.text()).toContain('url=insight-hunter.html');
});
