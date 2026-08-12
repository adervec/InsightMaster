// test/pack-override.spec.mjs — the extension point, proven.
//
// The app ships with a starter module inlined and asks for a content-pack.js beside it.
// Two things have to be true: with no pack the starter is what you get, and with a pack the
// app renders whatever that pack contains — practices, categories, colours and all — without
// the app knowing anything about it in advance.
import { test, expect } from '@playwright/test';
import { mkdtempSync, copyFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));

function deploy(packSource) {
  const dir = mkdtempSync(join(tmpdir(), 'ih-pack-'));
  copyFileSync(join(root, 'insight-hunter.html'), join(dir, 'insight-hunter.html'));
  writeFileSync(join(dir, 'content-pack.js'), packSource);
  return pathToFileURL(join(dir, 'insight-hunter.html')).href;
}

// A pack that shares nothing with the starter: different practice, category, colour, glossary.
const FAKE_PACK = `window.IH_CONTENT = ${JSON.stringify({
  icons: { walk: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="30" fill="currentColor"/></svg>' },
  importanceMap: { 'walking-practice': 4 },
  importanceDefaults: {},
  difficultyOverrides: { slow: 'adv' },
  esotericMap: {},
  esotericDefaults: { movement: 3 },
  bodyLabels: { feet: 'Feet' },
  equipLabels: { shoes: 'Shoes' },
  positionDefaults: { 'walking-practice': { body: { feet: 'Bare or flat-soled' }, equipment: { shoes: 'Optional' } } },
  exercises: [{
    id: 'walking-practice',
    title: 'Zebra Crossing Drill',
    tag: 'Movement • Test',
    mega: 'movement',
    icon: 'walk',
    keywords: 'walking test',
    quickCue: 'A fixture, not a practice.',
    general: { setup: ['Stand up'], movement: ['Walk slowly', 'Stop'], mistakes: ['Running'] },
    variations: [{ id: 'slow', title: 'Very Slow', cue: 'Slower.', movement: ['Walk slower'], programming: { Time: '4 min' } }],
  }],
  subFiltersByMega: {},
  glossary: [{ term: 'Zebra', cat: 'method', def: 'A fixture term that exists only in this test pack.' }],
  glossaryCategories: [{ id: 'all', label: 'All' }, { id: 'method', label: 'Method' }],
  seedPlans: [{ id: 'p1', name: 'Fixture Plan', desc: 'From the pack', steps: [{ exId: 'walking-practice', varId: null, min: 4 }] }],
  megaLabels: { movement: 'Movement' },
  megaColors: { movement: '#2a6f3f' },
  avatarClips: {},
  avatarByEx: {},
  avatarDefaultsByMega: { movement: 'still' },
})};`;

test('with no pack beside it, the starter module is what you get', async ({ page }) => {
  page.on('pageerror', (err) => { throw new Error('page error: ' + err.message); });
  await page.goto(deploy('/* empty placeholder */'));
  await page.click('.tab[data-tab="library"]');
  await expect(page.locator('#exercises .ex-title').first()).toContainText('Sitting Meditation');
  await expect(page.locator('#mega-filter')).toContainText('Meditation');
  await expect(page.locator('#results-count')).toContainText('1 practice');
});

test('a content pack replaces the starter entirely', async ({ page }) => {
  page.on('pageerror', (err) => { throw new Error('page error: ' + err.message); });
  await page.goto(deploy(FAKE_PACK));

  await page.click('.tab[data-tab="library"]');
  await expect(page.locator('#exercises .ex-title').first()).toContainText('Zebra Crossing Drill');
  await expect(page.locator('#exercises')).not.toContainText('Sitting Meditation');

  // the pack's taxonomy and colour drive the UI, with nothing about it known in advance
  await expect(page.locator('#mega-filter')).toContainText('Movement');
  const badge = page.locator('.mega-badge').first();
  await expect(badge).toHaveText('Movement');
  expect(await badge.evaluate((el) => getComputedStyle(el).getPropertyValue('--mc').trim())).toBe('#2a6f3f');

  // its plans, glossary and atomic steps all come through
  await page.click('.tab[data-tab="plans"]');
  await expect(page.locator('.plan-card .pt')).toContainText('Fixture Plan');
  await page.click('#gloss-btn');
  await expect(page.locator('.gloss-entry')).toHaveCount(1);
  await expect(page.locator('.gloss-entry')).toContainText('Zebra');
  await page.click('#gloss-close');

  await page.click('.tab[data-tab="library"]');
  await page.locator('.exercise-header').first().click();
  await expect(page.locator('.exercise.open .section-content li').first()).toContainText('Stand up');
});

test('a timer runs a practice the app has never seen before', async ({ page }) => {
  page.on('pageerror', (err) => { throw new Error('page error: ' + err.message); });
  await page.goto(deploy(FAKE_PACK));
  await page.click('.tab[data-tab="plans"]');
  await page.locator('.plan-card .btn.accent').first().click();
  await expect(page.locator('.timer-wrap')).toBeVisible();
  await expect(page.locator('#t-cue')).toContainText('Step 1 of 2');
  await expect(page.locator('#t-steps li').first()).toContainText('Walk slowly');
  await page.click('#t-done');
  await page.click('.tab[data-tab="practice"]');
  await expect(page.locator('.entry-row')).toContainText('Zebra Crossing Drill');
});
