// test/app.spec.mjs — Layer 2: boot the real file in headless Chromium and drive the core
// flows: clean boot, library render/filter/search, logging a session, plans, stats, glossary.
// Run: npx playwright test
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// the published build: app + the starter module, one self-contained file
const APP = 'file://' + join(fileURLToPath(new URL('..', import.meta.url)), 'insight-hunter.html').replace(/\\/g, '/');

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => { throw new Error('page error: ' + err.message); });
  await page.goto(APP);
});

test('boots clean with library data', async ({ page }) => {
  await expect(page.locator('#build-stamp')).toContainText('build');
  await page.click('.tab[data-tab="library"]');
  const count = await page.locator('#exercises .exercise').count();
  expect(count).toBeGreaterThanOrEqual(1);
  await expect(page.locator('#results-count')).toContainText(/practice/);
});

test('library search + mega filter + atomic steps', async ({ page }) => {
  await page.click('.tab[data-tab="library"]');
  await page.fill('#search', 'sitting');
  expect(await page.locator('#exercises .exercise').count()).toBeGreaterThanOrEqual(1);
  await page.locator('.exercise-header').first().click();
  await expect(page.locator('.exercise.open .section-title').first()).toContainText('General Setup');
  await page.fill('#search', '');
  await page.click('#mega-filter .mega-pill[data-mega="meditation"]');
  expect(await page.locator('#exercises .exercise').count()).toBeGreaterThanOrEqual(1);
});

test('log a practice into a session and end it', async ({ page }) => {
  await page.click('.tab[data-tab="practice"]');
  await page.click('#begin-btn');
  await page.click('#add-practice-btn');
  await page.fill('#picker-q', 'sitting');
  await page.locator('.picker-row').first().click();
  await page.click('#ls-log');
  await expect(page.locator('.entry-row')).toHaveCount(1);
  await page.click('#end-btn');
  await page.click('#dlg-ov .btn.primary'); // dismiss summary
  await page.click('.tab[data-tab="history"]');
  await expect(page.locator('.sess-card')).toHaveCount(1);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('insight_hunter_v1')));
  expect(stored.sessions.length).toBe(1);
  expect(stored.sessions[0].entries.length).toBe(1);
});

test('seed plans present and plan runner opens with atomic steps', async ({ page }) => {
  await page.click('.tab[data-tab="plans"]');
  expect(await page.locator('.plan-card').count()).toBeGreaterThanOrEqual(3);
  await page.locator('.plan-card .btn.accent').first().click();
  await expect(page.locator('.timer-wrap')).toBeVisible();
  await expect(page.locator('.timer-steps ol li').first()).toBeVisible();
  await expect(page.locator('.timer-step-label')).toContainText('Step 1/');
  await page.click('#t-cancel');
});

test('glossary opens, searches, filters', async ({ page }) => {
  await page.click('#gloss-btn');
  await expect(page.locator('#gloss-panel')).toHaveClass(/open/);
  await page.fill('#gloss-search', 'anchor');
  await expect(page.locator('.gloss-entry').first()).toContainText(/anchor/i);
  await page.click('#gloss-close');
});

test('timer runs and logs on Done', async ({ page }) => {
  await page.click('.tab[data-tab="library"]');
  await page.fill('#search', 'sitting');
  await page.locator('.exercise-header').first().click();
  await page.locator('.exercise.open > .exercise-body > .ex-actions .btn.accent').first().click(); // ⏱ Practice
  await page.click('#ls-timer');
  await expect(page.locator('.timer-wrap')).toBeVisible();
  await expect(page.locator('#t-count')).toBeVisible();
  await page.click('#t-done');
  await page.click('.tab[data-tab="practice"]');
  await expect(page.locator('.entry-row')).toHaveCount(1);
});

test('no horizontal overflow on any tab (phone + desktop)', async ({ page }) => {
  for (const tab of ['practice', 'library', 'plans', 'history', 'stats', 'settings']) {
    await page.click(`.tab[data-tab="${tab}"]`);
    const over = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(over, `tab ${tab} overflows by ${over}px`).toBeLessThanOrEqual(0);
  }
  const fab = await page.locator('#gloss-btn').boundingBox();
  const vw = await page.evaluate(() => window.innerWidth);
  expect(fab.x + fab.width).toBeLessThanOrEqual(vw);
});

test('recipe grid: every practice becomes a card, recipe sheet shows the method', async ({ page }) => {
  await page.click('.tab[data-tab="library"]');
  await page.click('#view-toggle');
  expect(await page.locator('.recipe-grid .recipe-card').count()).toBeGreaterThanOrEqual(1);
  await page.locator('.recipe-card').first().click();
  await expect(page.locator('#rc-body .section-title').first()).toContainText('Ingredients');
  await expect(page.locator('#rc-body ol li').first()).toBeVisible();
  await page.selectOption('#rc-var', { index: 1 });
  await expect(page.locator('#rc-body .section-title').last()).toBeVisible();
  await page.click('#rc-close');
  await page.click('#view-toggle');
  await expect(page.locator('#exercises .exercise').first()).toBeVisible();
});

test('keyboard: tabs are real buttons, "/" searches, Enter opens, Escape closes', async ({ page }) => {
  await expect(page.locator('#tab-practice')).toHaveAttribute('aria-selected', 'true');
  await page.locator('body').press('/');
  await expect(page.locator('#tab-library')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#search')).toBeFocused();
  await page.fill('#search', 'sitting');

  const head = page.locator('.exercise-header').first();
  await head.focus();
  await head.press('Enter');
  await expect(page.locator('.exercise.open')).toHaveCount(1);
  await expect(head).toHaveAttribute('aria-expanded', 'true');

  await page.locator('.exercise.open .ex-actions .btn.accent').first().click();
  await expect(page.locator('#ls-ov')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#ls-ov')).toHaveCount(0);
});

test('the back button closes a sheet instead of leaving the app', async ({ page }) => {
  await page.click('.tab[data-tab="practice"]');
  await page.click('#begin-btn');
  await page.click('#add-practice-btn');
  await expect(page.locator('#picker-ov')).toBeVisible();
  await page.goBack();
  await expect(page.locator('#picker-ov')).toHaveCount(0);
  await expect(page.locator('#add-practice-btn')).toBeVisible(); // still in the app, still in session
});

test('deleting a logged practice is undoable', async ({ page }) => {
  await page.click('.tab[data-tab="practice"]');
  await page.click('#begin-btn');
  await page.click('#add-practice-btn');
  await page.fill('#picker-q', 'sitting');
  await page.locator('.picker-row').first().click();
  await page.click('#ls-log');
  await expect(page.locator('.entry-row')).toHaveCount(1);

  await page.click('.entry-row .entry-x');
  await expect(page.locator('.entry-row')).toHaveCount(0);
  await page.click('.toast-undo');
  await expect(page.locator('.entry-row')).toHaveCount(1);
});

test('the timer walks the practice through its atomic steps', async ({ page }) => {
  await page.click('.tab[data-tab="plans"]');
  await page.locator('.plan-card .btn.accent').first().click();
  const cue = page.locator('#t-cue');
  await expect(cue).toContainText('Step 1 of');
  await expect(page.locator('#t-steps li.cur')).toHaveCount(1);
  const total = Number((await cue.innerText()).match(/step 1 of (\d+)/i)[1]);
  expect(total).toBeGreaterThan(1);

  // jump the clock to the middle of the step instead of waiting out real minutes.
  // 20s span keeps a whole step-slice of slack either side of the assertion.
  await page.evaluate(() => { T.durMs = 20000; T.endTs = Date.now() + 10000; });
  await page.waitForTimeout(400);
  await expect(cue).toContainText(new RegExp('step ' + (Math.floor(0.5 * total) + 1) + ' of ' + total, 'i'));
  await expect(page.locator('#t-steps li.done').first()).toBeVisible();
  await page.click('#t-cancel');
});

test('an interrupted timer is offered back after a reload', async ({ page }) => {
  await page.click('.tab[data-tab="plans"]');
  await page.locator('.plan-card .btn.accent').first().click();
  await expect(page.locator('.timer-wrap')).toBeVisible();
  await page.reload();
  await expect(page.locator('#dlg-ov')).toContainText('Timer interrupted');
  await page.click('#dlg-ov .btn.primary');
  await expect(page.locator('.timer-wrap')).toBeVisible();
  await expect(page.locator('#t-count')).toBeVisible();
  await page.click('#t-cancel');
});

test('log a practice on an earlier day, then correct its minutes in place', async ({ page }) => {
  await page.click('.tab[data-tab="library"]');
  await page.fill('#search', 'sitting');
  await page.locator('.exercise-header').first().click();
  await page.locator('.exercise.open .ex-actions .btn.accent').first().click();
  await expect(page.locator('.ex-hist')).toContainText('haven’t practiced this yet');
  await page.click('.ls-day[data-d="1"]');
  await page.click('#ls-log');

  const yday = await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() - 1); return todayStr(d); });
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('insight_hunter_v1')));
  expect(stored.sessions).toHaveLength(1);
  expect(stored.sessions[0].date).toBe(yday);

  await page.click('.tab[data-tab="history"]');
  await page.locator('.sess-head').first().click();
  await page.locator('.sess-body .e-min-edit').first().fill('42');
  await page.locator('.sess-body .e-min-edit').first().blur();
  await expect(page.locator('.sess-head .m').first()).toContainText('42m');
});

test('rating how a session felt survives the session and reaches stats', async ({ page }) => {
  await page.click('.tab[data-tab="practice"]');
  await page.click('#begin-btn');
  await page.click('#add-practice-btn');
  await page.fill('#picker-q', 'sitting');
  await page.locator('.picker-row').first().click();
  await page.click('#ls-log');
  await page.locator('.feel').nth(4).click(); // 5 = Great
  await expect(page.locator('.feel.on')).toHaveCount(1);

  await page.click('#end-btn');
  await page.click('#dlg-ov .btn.primary');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('insight_hunter_v1')));
  expect(stored.sessions[0].feel).toBe(5);
  await page.click('.tab[data-tab="stats"]');
  await expect(page.locator('.tile', { hasText: 'avg feel' })).toContainText('5.0');
});

test('a past session can be rated, annotated and run again', async ({ page }) => {
  await page.click('.tab[data-tab="practice"]');
  await page.click('#begin-btn');
  await page.click('#add-practice-btn');
  await page.fill('#picker-q', 'sitting');
  await page.locator('.picker-row').first().click();
  await page.click('#ls-log');
  await page.click('#end-btn');
  await page.click('#dlg-ov .btn.primary');

  await page.click('.tab[data-tab="history"]');
  await page.locator('.sess-head').first().click();
  await page.locator('.sess-body .feel').nth(2).click(); // 3 = Neutral
  await page.locator('.sess-body .session-note').first().fill('felt short but steady');
  await page.locator('.sess-body .session-note').first().blur();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('insight_hunter_v1')).sessions[0]);
  expect(stored.feel).toBe(3);
  expect(stored.notes).toBe('felt short but steady');

  await page.locator('.sess-body .btn.accent').first().click();
  await expect(page.locator('.timer-wrap')).toBeVisible();
  await expect(page.locator('.timer-step-label')).toContainText('Repeat of');
  await page.click('#t-cancel');
});

test('a plan step can pin a specific variation', async ({ page }) => {
  await page.click('.tab[data-tab="plans"]');
  await page.click('#new-plan-btn');
  await page.fill('#pe-name', 'Variation test');
  await page.click('#pe-add');
  await page.fill('#picker-q', 'sitting');
  await page.locator('.picker-row').first().click();
  const sel = page.locator('#pe-steps .step-var').first();
  await expect(sel).toBeVisible();
  await sel.selectOption({ index: 1 });
  const label = await page.locator('#pe-steps .n').first().innerText();
  expect(label).toContain('—'); // "Family — Variation"
  await page.click('#pe-save');
  const plans = await page.evaluate(() => JSON.parse(localStorage.getItem('insight_hunter_v1')).plans);
  expect(plans.find((p) => p.name === 'Variation test').steps[0].varId).toBeTruthy();
});

test('library sorting persists, and the random pick opens a practice', async ({ page }) => {
  await page.click('.tab[data-tab="library"]');
  for (const mode of ['az', 'importance', 'short']) {
    await page.selectOption('#lib-sort', mode);
    await expect(page.locator('#exercises .exercise').first()).toBeVisible();
  }
  await page.reload();
  await expect(page.locator('#lib-sort')).toHaveValue('short'); // the choice sticks

  await page.click('#lib-random');
  await expect(page.locator('#rc-ov')).toBeVisible();
  await expect(page.locator('#rc-body')).not.toBeEmpty();
});

test('a stale backup is nudged, and the nudge can be deferred', async ({ page }) => {
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('insight_hunter_v1') || '{}');
    s.sessions = Array.from({ length: 6 }, (_, i) => ({
      id: 's' + i, date: '2026-07-0' + (i + 1), startedAt: 0, endedAt: 1, notes: '',
      entries: [{ id: 'e' + i, exId: 'custom:Sitting', varId: null, min: 10 }],
    }));
    localStorage.setItem('insight_hunter_v1', JSON.stringify(s));
  });
  await page.reload();
  await page.click('.tab[data-tab="practice"]');
  await expect(page.locator('.card.nudge')).toContainText('no backup yet');
  await page.click('#nudge-later');
  await expect(page.locator('.card.nudge')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.card.nudge')).toHaveCount(0); // stays quiet for a week
});

test('stats show a year heatmap, time of day, and a per-practice detail sheet', async ({ page }) => {
  await page.click('.tab[data-tab="practice"]');
  await page.click('#begin-btn');
  await page.click('#add-practice-btn');
  await page.fill('#picker-q', 'sitting');
  await page.locator('.picker-row').first().click();
  await page.click('#ls-log');
  await page.click('#end-btn');
  await page.click('#dlg-ov .btn.primary');

  await page.click('.tab[data-tab="stats"]');
  expect(await page.locator('.heat-grid .heat-cell').count()).toBeGreaterThan(360);
  await expect(page.locator('.heat-cell.today')).toHaveCount(1);
  await expect(page.locator('.heat-cell.today')).toBeInViewport(); // opens scrolled to the recent end
  await expect(page.locator('.card', { hasText: 'Time of day' })).toContainText(/Morning|Midday|Evening|Night|Early|Late/);

  await page.locator('.hbar-row.tap').first().click();
  await expect(page.locator('#xs-ov')).toBeVisible();
  await expect(page.locator('#xs-ov .tile').first()).toContainText('1');
  await expect(page.locator('#xs-ov')).toContainText('times practised');
  await page.click('#xs-close');
});

test('plan steps reorder both ways', async ({ page }) => {
  await page.click('.tab[data-tab="plans"]');
  await page.click('#new-plan-btn');
  await page.fill('#pe-name', 'Order test');
  for (let i = 0; i < 2; i++) {
    await page.click('#pe-add');
    await page.fill('#picker-q', 'sitting');
    await page.locator('.picker-row').first().click();
  }
  // one family in the starter module, so tell the steps apart by pinning a variation
  await page.locator('#pe-steps .step-var').first().selectOption({ index: 2 });
  const names = () => page.locator('#pe-steps .n').allInnerTexts();
  const [first, second] = await names();
  expect(first).not.toBe(second);
  await page.locator('#pe-steps [data-down="0"]').click();
  expect(await names()).toEqual([second, first]);
  await page.locator('#pe-steps [data-up="1"]').click();
  expect(await names()).toEqual([first, second]);
});

test('Drive backup: nothing reaches Google until you connect', async ({ page }) => {
  const googleHits = [];
  page.on('request', (r) => { if (/google|gstatic/.test(new URL(r.url()).hostname || '')) googleHits.push(r.url()); });
  for (const tab of ['practice', 'library', 'plans', 'history', 'stats', 'settings']) {
    await page.click(`.tab[data-tab="${tab}"]`);
  }
  await expect(page.locator('.card', { hasText: 'Cloud backup' })).toBeVisible();
  expect(googleHits, 'the app contacted Google before opting in').toEqual([]);
  expect(await page.locator('script[src*="accounts.google.com"]').count()).toBe(0);
});

test('Drive backup is gated to the authorized origin, with a client-ID escape hatch', async ({ page }) => {
  // file:// is not an authorized origin, so the built-in client id must be refused here
  await page.click('.tab[data-tab="settings"]');
  const card = page.locator('.card', { hasText: 'Cloud backup' });
  await expect(card).toContainText('isn’t enabled on this deployment');
  await expect(page.locator('#drive-backup')).toHaveCount(0);

  await page.fill('#drive-cid', 'my-own-id.apps.googleusercontent.com');
  await page.locator('#drive-cid').blur();
  await expect(page.locator('#drive-backup')).toBeVisible();     // a fork's own id enables it
  await expect(page.locator('#drive-restore')).toBeVisible();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('insight_hunter_v1')).sync);
  expect(stored.driveClientId).toBe('my-own-id.apps.googleusercontent.com');
  expect(stored.auto).toBe(false);                                // opt-in, off by default
  expect(JSON.stringify(stored)).not.toContain('token');
});

test('a restore never wipes the deployment’s own OAuth client ID', async ({ page }) => {
  await page.click('.tab[data-tab="settings"]');
  await page.fill('#drive-cid', 'fork-id.apps.googleusercontent.com');
  await page.locator('#drive-cid').blur();
  // a backup made before the id was set, applied through the real Overwrite path
  const done = page.evaluate(() => applyBackup({ app: 'InsightHunter', version: 1, state: { sessions: [], plans: [] } }, 'Restore from Drive'));
  await page.click('#dlg-ov .btn.danger'); // Overwrite
  expect(await done).toBe(true);
  const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('insight_hunter_v1')).sync.driveClientId);
  expect(kept).toBe('fork-id.apps.googleusercontent.com');
});

test('avatar is off by default, and animates the practice when enabled', async ({ page }) => {
  await page.click('.tab[data-tab="plans"]');
  await page.locator('.plan-card .btn.accent').first().click();
  await expect(page.locator('.timer-wrap .av-svg')).toHaveCount(0); // opt-in
  await page.click('#t-cancel');

  await page.click('.tab[data-tab="settings"]');
  await page.click('label.switch:has(#set-avatar)');
  await expect(page.locator('#av-preview .av-svg')).toBeVisible();

  await page.click('.tab[data-tab="plans"]');
  await page.locator('.plan-card .btn.accent').first().click();
  const bone = page.locator('.timer-wrap .av-bone').first();
  await expect(bone).toBeVisible();
  const at = async () => (await bone.getAttribute('y2')) + ',' + (await bone.getAttribute('x2'));
  const first = await at();
  await page.waitForTimeout(1200);
  expect(await at(), 'avatar did not move').not.toBe(first);
  await expect(page.locator('.timer-wrap .av-caption')).toHaveText(/Inhale|Exhale/);
  await page.click('#t-cancel');
});

test('a settling-in countdown runs before the opening bell, and Done starts the sit at once', async ({ page }) => {
  await page.click('.tab[data-tab="settings"]');
  await page.selectOption('#set-prep', '30');
  await page.click('.tab[data-tab="plans"]');
  await page.locator('.plan-card .btn.accent').first().click();
  await expect(page.locator('#t-cue')).toContainText('Settling in');
  await expect(page.locator('#t-pause')).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('ih_timer_v1'))).toBeNull(); // nothing to resume until the bell
  await page.click('#t-done');
  await expect(page.locator('#t-cue')).toContainText('Step 1 of');
  await expect(page.locator('#t-pause')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('ih_timer_v1'))).not.toBeNull();
  await page.click('#t-cancel');
});

test('an open-ended sit counts up, survives a reload, and logs the time actually sat', async ({ page }) => {
  await page.click('.tab[data-tab="library"]');
  await page.fill('#search', 'sitting');
  await page.locator('.exercise-header').first().click();
  await page.locator('.exercise.open > .exercise-body > .ex-actions .btn.accent').first().click();
  await page.click('.ls-preset[data-n="0"]');
  await expect(page.locator('#ls-min')).toHaveText('∞');
  await page.click('#ls-timer');
  await expect(page.locator('.t-sub')).toContainText('open sit');
  await expect(page.locator('#t-plus')).toHaveCount(0);
  await page.evaluate(() => { T.stepStart = Date.now() - 7 * 60000; saveTimer(); }); // pretend seven minutes have passed
  await expect(page.locator('#t-count')).toContainText('7:0');
  await page.reload();
  await expect(page.locator('#dlg-ov')).toContainText('open sit');
  await page.click('#dlg-ov .btn.primary');
  await expect(page.locator('#t-count')).toContainText('7:0');
  await page.click('#t-done');
  await page.click('.tab[data-tab="practice"]');
  await expect(page.locator('.e-min-edit')).toHaveValue('7');
});

test('tapping the ring hides the clock, and the choice sticks', async ({ page }) => {
  await page.click('.tab[data-tab="plans"]');
  await page.locator('.plan-card .btn.accent').first().click();
  await expect(page.locator('#t-ringbox .t-time')).toBeVisible();
  await page.click('#t-ringbox');
  await expect(page.locator('#t-ringbox .t-time')).toBeHidden();
  await page.click('#t-cancel');
  await page.locator('.plan-card .btn.accent').first().click();
  await expect(page.locator('#t-ringbox .t-time')).toBeHidden();
  await page.click('#t-ringbox');
  await expect(page.locator('#t-ringbox .t-time')).toBeVisible();
  await page.click('#t-cancel');
});

test('CSV export has one row per logged practice, and the reminder is a daily calendar event', async ({ page }) => {
  await page.click('#begin-btn');
  await page.click('#add-practice-btn');
  await page.fill('#picker-q', 'sitting');
  await page.locator('.picker-row').first().click();
  await page.click('#ls-log');
  const csv = await page.evaluate(() => csvText());
  const lines = csv.split('\r\n');
  expect(lines[0]).toBe('"date","session_start","practice","variation","minutes","feel","plan","notes"');
  expect(lines.length).toBe(2);
  expect(lines[1]).toContain('"Sitting Meditation"');
  await page.click('.tab[data-tab="settings"]');
  await page.fill('#set-rem-time', '06:30');
  await page.locator('#set-rem-time').dispatchEvent('change');
  const ics = await page.evaluate(() => reminderIcs());
  expect(ics).toContain('RRULE:FREQ=DAILY');
  expect(ics).toContain('T063000');
  expect(ics).toContain('BEGIN:VALARM');
});

test('closing-bell count and vibrate settings persist', async ({ page }) => {
  await page.click('.tab[data-tab="settings"]');
  await page.selectOption('#set-endbells', '3');
  await page.click('label.switch:has(#set-haptics)');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('insight_hunter_v1')).sound);
  expect(stored.endBells).toBe(3);
  expect(stored.haptics).toBe(true);
  await page.reload();
  await page.click('.tab[data-tab="settings"]');
  await expect(page.locator('#set-endbells')).toHaveValue('3');
  await expect(page.locator('#set-haptics')).toBeChecked();
});

test('house font: Atkinson Hyperlegible by default, and the Settings choice changes it and sticks', async ({ page }) => {
  const bodyFont = () => page.evaluate(() => getComputedStyle(document.body).fontFamily);
  await expect.poll(bodyFont).toMatch(/^"?Atkinson Hyperlegible/);
  await page.click('.tab[data-tab="settings"]');
  await page.selectOption('#set-font', 'serif');
  await expect.poll(bodyFont).toMatch(/^Georgia/);
  await page.reload();
  await expect.poll(bodyFont).toMatch(/^Georgia/);
  await page.click('.tab[data-tab="settings"]');
  await expect(page.locator('#set-font')).toHaveValue('serif');
});

test('erase everything removes only this app’s keys, confirms first, and says Drive is untouched', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('maker-font', 'serif');
    localStorage.setItem('portal-activity', '[[1,"GymTracker315","lift",3]]');
    localStorage.setItem('some-other-app', 'keep me');
  });
  await page.click('#begin-btn');
  await page.click('#add-practice-btn');
  await page.fill('#picker-q', 'sitting');
  await page.locator('.picker-row').first().click();
  await page.click('#ls-log');
  await page.click('#end-btn');
  await page.click('#dlg-ov .btn.primary');
  await page.click('.tab[data-tab="library"]');
  await page.click('.tab[data-tab="settings"]');
  await page.click('#set-clear');
  await expect(page.locator('#dlg-ov')).toContainText('Google Drive backup is not touched');
  await page.click('#dlg-ov .btn.danger');
  await page.click('#dlg-ov .btn.danger');
  await expect(page.locator('#toast')).toContainText('Drive backup untouched');
  const keys = await page.evaluate(() => Object.keys(localStorage).sort());
  expect(keys.filter((k) => /^(ih_|insight_hunter)/.test(k)).length, keys.join(',')).toBeLessThanOrEqual(1); // re-saved fresh state only
  const left = await page.evaluate(() => ({ f: localStorage.getItem('maker-font'), o: localStorage.getItem('some-other-app'), p: JSON.parse(localStorage.getItem('portal-activity')) }));
  expect(left.f).toBe('serif');
  expect(left.o).toBe('keep me');
  expect(left.p[0][1]).toBe('GymTracker315');
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('insight_hunter_v1') || '{"sessions":[]}'));
  expect(st.sessions.length).toBe(0);
});

test('ending a session appends meditation to the shared portal activity list', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('portal-activity', '[[1,"Run315","cardio",2]]'));
  await page.click('#begin-btn');
  await page.click('#add-practice-btn');
  await page.fill('#picker-q', 'sitting');
  await page.locator('.picker-row').first().click();
  await page.click('.ls-preset[data-n="20"]');
  await page.click('#ls-log');
  await page.click('#end-btn');
  await page.click('#dlg-ov .btn.primary');
  const a = await page.evaluate(() => JSON.parse(localStorage.getItem('portal-activity')));
  expect(a.length).toBe(2);
  expect(a[0][1]).toBe('Run315');
  const [ts, slug, kind, amount] = a[1];
  expect(slug).toBe('InsightMaster');
  expect(kind).toBe('focus');
  expect(amount).toBe(2);
  expect(Math.abs(ts - Date.now() / 1000)).toBeLessThan(60);
});

test('practice coach: the panel mounts in Settings, sends only the log, and a reply can be applied and undone', async ({ page }) => {
  await page.click('#begin-btn');
  await page.click('#add-practice-btn');
  await page.fill('#picker-q', 'sitting');
  await page.locator('.picker-row').first().click();
  await page.click('#ls-log');
  await page.click('#end-btn');
  await page.click('#dlg-ov .btn.primary');
  await page.click('.tab[data-tab="settings"]');
  await expect(page.locator('.card', { hasText: 'Practice coach' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => !!document.getElementById('coach-host') && !!(window.cowork || document.getElementById('coach-host').textContent))).toBe(true);

  const files = await page.evaluate(() => coachFiles());
  const req = files['coach/request.json'];
  expect(req.protocol).toBe('insightmaster-coach');
  expect(req.requestHash).toBe(await page.evaluate((p) => coworkHash(JSON.stringify(p)), req.payload));
  expect(req.payload.recentSessions.length).toBe(1);
  expect(req.payload.recentSessions[0].practices[0].name).toContain('Sitting Meditation');
  const sent = JSON.stringify(req.payload);
  for (const key of ['"movement"', '"setup"', '"mistakes"', '"quickCue"', '"cue"']) expect(sent).not.toContain(key); // no library content
  expect(files['coach/INSTRUCTIONS.md']).toContain('requestHash');

  const done = await page.evaluate(() => COACH_CHANNEL.apply({ requestHash: 'x', reply: 'Sit ten minutes after breakfast.' }));
  await expect(page.locator('#coach-reply')).toHaveText('Sit ten minutes after breakfast.');
  await page.reload();
  await page.click('.tab[data-tab="settings"]');
  await expect(page.locator('#coach-reply')).toHaveText('Sit ten minutes after breakfast.');
  await page.evaluate((d) => COACH_CHANNEL.undo(d), done.undo);
  await expect(page.locator('#coach-reply')).toBeHidden();
  expect((await page.evaluate(() => coachBrief())).markdown).toContain('Streak');
});
