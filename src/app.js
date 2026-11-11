'use strict';
/* InsightHunter — a GymTracker315-style tracker for meditation, yoga & mind-body practice.
   Single file, offline-first, localStorage. Content library baked in from the
   Flexibility & Mind-Body Reference guide. */

const APP_BUILD = 'build 5 · 2026-11-10';
const APP_TITLE = document.title;
window.appUpdateNotice = false; // font.js reads this when an update lands; the app's own Reload toast covers it
const STORAGE_KEY = 'insight_hunter_v1';
const PENDING_KEY = 'insight_hunter_pending_v1';
const TAB_KEY = 'ih_tab';

/* ---------- tiny helpers ---------- */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const todayStr = (d) => {
  const x = d || new Date();
  return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
};
const fmtMin = (m) => (m >= 60 ? Math.floor(m / 60) + 'h' + (m % 60 ? ' ' + (m % 60) + 'm' : '') : m + 'm');
const fmtClock = (sec) => {
  sec = Math.max(0, Math.round(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  return (m >= 60 ? Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
};
function dateLabel(ds) {
  if (ds === todayStr()) return 'Today';
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (ds === todayStr(y)) return 'Yesterday';
  const d = new Date(ds + 'T12:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/* ---------- content index ---------- */
const EX_BY_ID = {};
exercises.forEach((ex) => { EX_BY_ID[ex.id] = ex; });
function getVar(exId, varId) {
  const ex = EX_BY_ID[exId];
  if (!ex || !varId || !ex.variations) return null;
  return ex.variations.find((v) => v.id === varId) || null;
}
/* practices the user typed in themselves, so the app is usable with no content pack */
const CUSTOM_PREFIX = 'custom:';
function exFor(exId) {
  if (EX_BY_ID[exId]) return EX_BY_ID[exId];
  if (typeof exId === 'string' && exId.startsWith(CUSTOM_PREFIX)) {
    return { id: exId, title: exId.slice(CUSTOM_PREFIX.length), tag: 'Custom', mega: 'custom', icon: 'meditation', variations: [], general: null, custom: true };
  }
  return null;
}
function displayName(exId, varId) {
  const ex = exFor(exId);
  if (!ex) return exId;
  const v = getVar(exId, varId);
  return v && v.title !== ex.title ? ex.title + ' — ' + v.title : ex.title;
}
const MEGA_LABELS = IH_C.megaLabels || {}; // category vocabulary belongs to the content pack
const MEGA_COLORS = IH_C.megaColors || {};  // ...and so does its colour
const ACCENT = '#b48aff';
function megaColor(mega) { return MEGA_COLORS[mega] || ACCENT; }
function megaVar(mega) { return `--mc:${megaColor(mega)}`; }
// a pack may pick any colour, so work out whether text on top of it should be light
function isDarkColor(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return false;
  const n = parseInt(m[1], 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 < 0.5;
}
function megaBadge(mega) {
  return `<span class="mega-badge" style="${megaVar(mega)}">${esc(MEGA_LABELS[mega] || mega)}</span>`;
}
const NO_CONTENT_HTML = `<div class="no-results">
  <strong>No content pack loaded.</strong><br><br>
  InsightHunter ships as an empty practice tracker — the practice library and glossary
  live in a separate <code>content-pack.js</code> file placed next to this app.<br><br>
  You can still time, log, and chart your own sessions, and build plans from your own steps.
</div>`;
function suggestedMin(ex, v) {
  const prog = (v && v.programming) || null;
  const src = prog ? (prog.Time || prog.Duration || prog.Hold || '') : '';
  const m = /(\d+)/.exec(src);
  if (m) return Math.min(60, Math.max(1, parseInt(m[1], 10)));
  return 10;
}

/* ---------- state ---------- */
function defaultState() {
  return {
    sessions: [],       // {id, date, startedAt, endedAt, entries:[{id,exId,varId,min}], notes, planId, planName, updatedAt}
    plans: [],          // {id, name, desc, steps:[{exId,varId,min}], seeded, updatedAt}
    seededPlanIds: [],
    favorites: {},
    sound: { bell: true, volume: 0.5, intervalMin: 0, stepCue: false, prepSec: 0, endBells: 2, haptics: false },
    goal: { weeklyMin: 90 },
    reminder: { time: '', badge: false }, // calendar .ics time, and the installed-icon badge
    avatar: false,      // opt-in 3D figure in the timer
    hideCount: false,   // tap the timer ring to sit without watching the clock
    lastExportAt: 0,    // localStorage is the only copy until you export one
    backupNudgedAt: 0,
    // Google Drive backup. driveClientId is a fork's own OAuth client id (kept on this device);
    // no token is ever stored here — see src/drive.js.
    sync: { driveClientId: '', lastSync: 0, auto: false },

    savedAt: 0,
  };
}
let state = loadState();
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const s = { ...defaultState(), ...JSON.parse(raw) };
    s.sound = { ...defaultState().sound, ...(s.sound || {}) };
    s.goal = { ...defaultState().goal, ...(s.goal || {}) };
    s.reminder = { ...defaultState().reminder, ...(s.reminder || {}) };
    s.sync = { ...defaultState().sync, ...(s.sync || {}) };
    if (!Array.isArray(s.sessions)) s.sessions = [];
    if (!Array.isArray(s.plans)) s.plans = [];
    return s;
  } catch (e) { return defaultState(); }
}
function saveState() {
  state.savedAt = Date.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
let active = null; // in-progress session
try { active = JSON.parse(localStorage.getItem(PENDING_KEY) || 'null'); } catch (e) { active = null; }
function savePending() {
  if (active) localStorage.setItem(PENDING_KEY, JSON.stringify(active));
  else localStorage.removeItem(PENDING_KEY);
}

/* ---------- audio bell ---------- */
let _actx = null;
function bell(times, soft) {
  times = times || 1;
  if (state.sound.haptics && navigator.vibrate) {
    try { navigator.vibrate(soft ? [40] : Array.from({ length: times }, () => [180, 400]).flat()); } catch (e) { /* no motor */ }
  }
  if (!state.sound.bell) return;
  // soft = the short single tone used to mark a guided step change, not a session boundary
  const partials = soft ? [880] : [528, 792, 1056];
  const peaks = soft ? [0.22] : [0.5, 0.22, 0.08];
  const decay = soft ? 0.7 : 2.4;
  try {
    _actx = _actx || new (window.AudioContext || window.webkitAudioContext)();
    if (_actx.state === 'suspended') _actx.resume();
    for (let i = 0; i < times; i++) {
      const t0 = _actx.currentTime + i * 1.1;
      partials.forEach((f, j) => {
        const o = _actx.createOscillator(), g = _actx.createGain();
        o.type = 'sine'; o.frequency.value = f;
        const peak = state.sound.volume * peaks[j];
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
        o.connect(g); g.connect(_actx.destination);
        o.start(t0); o.stop(t0 + decay + 0.1);
      });
    }
  } catch (e) { /* audio unavailable — stay silent */ }
}

/* ---------- toast & dialogs ---------- */
let _toastT = null;
function toast(msg, undo, label) {
  const t = $('toast');
  t.textContent = msg;
  if (undo) {
    const b = document.createElement('button');
    b.className = 'toast-undo';
    b.textContent = label || 'Undo';
    b.addEventListener('click', () => { t.classList.remove('show'); clearTimeout(_toastT); undo(); });
    t.appendChild(b);
  }
  t.classList.add('show');
  clearTimeout(_toastT);
  _toastT = setTimeout(() => t.classList.remove('show'), undo ? 8000 : 2200);
}

/* ---------- overlays: focus, Escape, and the phone's back button ----------
   Every sheet goes through showOverlay, so all three behave the same way and a
   sheet can never strand focus behind it. */
let _restoreFocus = null;
let _ovMarker = false;    // our history entry is on top of the stack
let _releaseT = 0;        // deferred history.back() — see closeOverlay
let _popping = false;     // inside popstate — don't navigate back again
let _onClose = null;      // dismiss callback, so a sheet closed by Escape still settles its promise
function showOverlay(html) {
  const root = $('overlay-root');
  if (!root.firstElementChild) {
    _restoreFocus = document.activeElement;
    _onClose = null;
    clearTimeout(_releaseT); // a sheet that hands off to another keeps the same history entry
    // back gesture / Android back closes the sheet instead of leaving the app
    if (!_ovMarker) { try { history.pushState({ ihOverlay: 1 }, ''); _ovMarker = true; } catch (e) { _ovMarker = false; } }
  }
  root.innerHTML = html;
  const ov = root.firstElementChild;
  if (!ov) return;
  const focusTarget = ov.querySelector('.sheet') || ov;
  focusTarget.setAttribute('tabindex', '-1');
  if (ov.classList.contains('overlay')) { ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); }
  focusTarget.focus({ preventScroll: true });
}
function closeOverlay() {
  $('overlay-root').innerHTML = '';
  if (_restoreFocus && _restoreFocus.isConnected) { try { _restoreFocus.focus(); } catch (e) { /* gone */ } }
  _restoreFocus = null;
  const cb = _onClose; _onClose = null;
  // release the history entry on the next tick, so picker -> log sheet -> timer hand-offs
  // reuse it instead of stacking (and racing) one entry per sheet
  if (_ovMarker && !_popping) {
    clearTimeout(_releaseT);
    _releaseT = setTimeout(() => {
      if (_ovMarker && !$('overlay-root').firstElementChild) { _ovMarker = false; try { history.back(); } catch (e) { /* no history */ } }
    }, 0);
  }
  if (cb) cb();
}
window.addEventListener('popstate', () => {
  _ovMarker = false; // whatever we pushed is behind us now
  if (!$('overlay-root').firstElementChild) return;
  _popping = true;
  if (T) cancelTimer(); else closeOverlay();
  _popping = false;
});
// keep focus inside an open sheet — a modal you can tab out of is not modal
document.addEventListener('focusin', (e) => {
  const ov = $('overlay-root').firstElementChild;
  if (!ov || ov.contains(e.target)) return;
  const el = ov.querySelector('.sheet') || ov;
  el.focus({ preventScroll: true });
});
document.addEventListener('keydown', (e) => {
  const ov = $('overlay-root').firstElementChild;
  // Escape dismisses a sheet — but never a running timer, which would drop the practice
  if (e.key === 'Escape' && ov && ov.classList.contains('overlay')) { e.preventDefault(); closeOverlay(); return; }
  // card-style controls are divs; make them behave like the buttons they claim to be
  const t = e.target;
  if ((e.key === 'Enter' || e.key === ' ') && t.tagName !== 'BUTTON' && t.getAttribute && t.getAttribute('role') === 'button') {
    e.preventDefault(); t.click(); return;
  }
  if (e.key === '/' && !ov && !/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) {
    e.preventDefault(); switchTab('library'); $('search').focus(); $('search').select();
  }
});

function choiceDialog(opts) {
  // themed replacement for native confirm/alert — returns the chosen button's value
  return new Promise((resolve) => {
    const btns = opts.buttons || [{ label: 'OK', value: true, kind: 'primary' }];
    showOverlay(`
      <div class="overlay center" id="dlg-ov">
        <div class="sheet">
          <div class="sheet-head"><div class="t">${esc(opts.title || '')}</div></div>
          <div class="sheet-body">
            ${opts.msg ? `<div class="dialog-msg">${esc(opts.msg)}</div>` : ''}
            <div class="btn-row">${btns.map((b, i) => `<button class="btn ${b.kind || ''}" data-i="${i}" style="flex:1">${esc(b.label)}</button>`).join('')}</div>
          </div>
        </div>
      </div>`);
    _onClose = () => resolve(undefined); // Escape / back / backdrop all count as "no choice"
    document.querySelectorAll('#dlg-ov [data-i]').forEach((el) => {
      el.addEventListener('click', () => { _onClose = null; closeOverlay(); resolve(btns[+el.dataset.i].value); });
    });
    $('dlg-ov').addEventListener('click', (e) => { if (e.target.id === 'dlg-ov') closeOverlay(); });
  });
}

/* ---------- day totals, streaks ---------- */
function allSessions() { return active && active.entries.length ? state.sessions.concat([active]) : state.sessions; }
function sortSessions() {
  state.sessions.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.startedAt || 0) - (b.startedAt || 0)));
}
function sessionMin(s) { return s.entries.reduce((t, e) => t + e.min, 0); }
function dayTotals() {
  const m = {};
  allSessions().forEach((s) => { if (s.entries.length) m[s.date] = (m[s.date] || 0) + sessionMin(s); });
  return m;
}
function streaks() {
  const days = dayTotals();
  const d = new Date();
  let cur = 0;
  if (!days[todayStr(d)]) d.setDate(d.getDate() - 1);
  while (days[todayStr(d)]) { cur++; d.setDate(d.getDate() - 1); }
  const dates = Object.keys(days).sort();
  let best = 0, run = 0, prev = null;
  dates.forEach((ds) => {
    if (prev) {
      const p = new Date(prev + 'T12:00:00'); p.setDate(p.getDate() + 1);
      run = todayStr(p) === ds ? run + 1 : 1;
    } else run = 1;
    if (run > best) best = run;
    prev = ds;
  });
  return { current: cur, best: best };
}
function renderStreakChip() {
  const s = streaks();
  const el = $('streak-chip');
  el.textContent = '🔥 ' + s.current + ' day' + (s.current === 1 ? '' : 's');
  el.className = s.current ? '' : 'zero';
  updateBadge();
}

/* ---------- tabs ---------- */
let currentTab = localStorage.getItem(TAB_KEY) || 'practice';
function switchTab(name) {
  currentTab = name;
  localStorage.setItem(TAB_KEY, name);
  document.querySelectorAll('.tab').forEach((t) => {
    const on = t.dataset.tab === name;
    t.classList.toggle('active', on);
    t.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('active', p.id === 'panel-' + name));
  renderTab(name);
}
function renderTab(name) {
  if (name === 'practice') renderPractice();
  else if (name === 'plans') renderPlans();
  else if (name === 'history') renderHistory();
  else if (name === 'stats') renderStats();
  else if (name === 'settings') renderSettings();
}
function renderAll() { renderStreakChip(); renderTab(currentTab); }

/* ==================================================================
   LIBRARY (ported from the guide, + favorites & practice actions)
   ================================================================== */
let currentMega = 'all';
let currentSub = 'all';
let currentSearch = '';
const LIBVIEW_KEY = 'ih_libview';
const LIBSORT_KEY = 'ih_libsort';
let libView = localStorage.getItem(LIBVIEW_KEY) || 'list';
let libSort = localStorage.getItem(LIBSORT_KEY) || 'default';
function toggleLibView() {
  libView = libView === 'grid' ? 'list' : 'grid';
  localStorage.setItem(LIBVIEW_KEY, libView);
  renderLibrary();
}
const LIB_SORTS = {
  az: (a, b) => a.title.localeCompare(b.title),
  importance: (a, b) => getImportance(b.id, b.mega) - getImportance(a.id, a.mega) || a.title.localeCompare(b.title),
  esoteric: (a, b) => getEsoteric(a.id, a.mega) - getEsoteric(b.id, b.mega) || a.title.localeCompare(b.title),
  short: (a, b) => suggestedMin(a, (a.variations || [])[0]) - suggestedMin(b, (b.variations || [])[0]),
};
function randomPractice() {
  const pool = exercises.filter((ex) => (currentMega === 'all' || (currentMega === 'favorites' ? !!state.favorites[ex.id] : ex.mega === currentMega)));
  if (!pool.length) { toast('Nothing to choose from in this filter'); return; }
  openRecipe(pool[Math.floor(Math.random() * pool.length)].id);
}

function renderMegaFilter() {
  // the category vocabulary comes from the content pack — no pack, no pills
  const el = $('mega-filter');
  const megas = Object.keys(MEGA_LABELS).filter((m) => exercises.some((ex) => ex.mega === m));
  if (!megas.length) { el.innerHTML = ''; return; }
  const PSEUDO = { all: '#888888', favorites: '#ffd24a' }; // not categories, so the app owns their colour
  el.innerHTML = [['all', 'All'], ['favorites', '★ Favs']].concat(megas.map((m) => [m, MEGA_LABELS[m]]))
    .map(([id, label]) => {
      const c = PSEUDO[id] || megaColor(id);
      return `<div class="mega-pill ${id === currentMega ? 'active' : ''} ${isDarkColor(c) ? 'on-dark' : ''}" style="--mc:${c}" data-mega="${id}" tabindex="0" role="button" aria-pressed="${id === currentMega}">${esc(label)}</div>`;
    }).join('');
  el.querySelectorAll('.mega-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      currentMega = pill.dataset.mega;
      currentSub = 'all';
      renderMegaFilter(); // re-render so class and aria-pressed can't drift apart
      const again = el.querySelector(`.mega-pill[data-mega="${currentMega}"]`);
      if (again) again.focus({ preventScroll: true });
      renderSubFilters();
      renderLibrary();
    });
  });
}
function renderSubFilters() {
  const filterPills = $('filters');
  const filters = subFiltersByMega[currentMega] || [];
  if (filters.length === 0) { filterPills.style.display = 'none'; return; }
  filterPills.style.display = 'flex';
  filterPills.innerHTML = filters.map((f) => `<div class="pill ${f.id === currentSub ? 'active' : ''}" data-filter="${f.id}" tabindex="0" role="button" aria-pressed="${f.id === currentSub}">${f.label}</div>`).join('');
  filterPills.querySelectorAll('.pill').forEach((p) => {
    p.addEventListener('click', () => { currentSub = p.dataset.filter; renderSubFilters(); renderLibrary(); });
  });
}
function exerciseMatchesSearch(ex, q) {
  if (!q) return true;
  if (ex.title.toLowerCase().includes(q)) return true;
  if (ex.sanskrit && ex.sanskrit.toLowerCase().includes(q)) return true;
  if (ex.keywords && ex.keywords.toLowerCase().includes(q)) return true;
  if (ex.tag.toLowerCase().includes(q)) return true;
  if (ex.quickCue && ex.quickCue.toLowerCase().includes(q)) return true;
  if (ex.variations) {
    for (const v of ex.variations) {
      if (v.title.toLowerCase().includes(q)) return true;
      if (v.sanskrit && v.sanskrit.toLowerCase().includes(q)) return true;
      if (v.cue && v.cue.toLowerCase().includes(q)) return true;
      if (v.best && v.best.toLowerCase().includes(q)) return true;
    }
  }
  return false;
}
function renderLibrary() {
  const main = $('exercises');
  let filtered = exercises.filter((ex) => {
    const matchesMega = currentMega === 'all' || (currentMega === 'favorites' ? !!state.favorites[ex.id] : ex.mega === currentMega);
    const matchesSub = currentSub === 'all' || ex.sub === currentSub;
    return matchesMega && matchesSub && exerciseMatchesSearch(ex, currentSearch);
  });
  if (LIB_SORTS[libSort]) filtered = filtered.slice().sort(LIB_SORTS[libSort]);
  const totalVars = filtered.reduce((s, ex) => s + (ex.variations ? ex.variations.length : 0), 0);
  $('results-count').textContent = `${filtered.length} practice${filtered.length === 1 ? '' : 's'} · ${totalVars} variation${totalVars === 1 ? '' : 's'}`;
  $('view-toggle').textContent = libView === 'grid' ? '☰ List view' : '▦ Recipe grid';
  if (!HAS_CONTENT) { main.innerHTML = NO_CONTENT_HTML; return; }
  if (filtered.length === 0) { main.innerHTML = '<div class="no-results">No practices match your filters.</div>'; return; }

  if (libView === 'grid') {
    main.innerHTML = '<div class="recipe-grid">' + filtered.map((ex) => `
      <div class="recipe-card" tabindex="0" role="button" onclick="openRecipe('${ex.id}')">
        <div class="rc-icon">${icons[ex.icon] || icons.standing}</div>
        <div class="rc-title">${state.favorites[ex.id] ? '<span class="fav-star">★</span> ' : ''}${ex.title}</div>
        ${ex.sanskrit ? `<div class="rc-sanskrit">${ex.sanskrit}</div>` : ''}
        <div class="rc-meta">${ex.tag} · ~${suggestedMin(ex, (ex.variations || [])[0])}m</div>
        <div class="rc-badges">${importanceBadge(ex.id, ex.mega)}${megaBadge(ex.mega)}</div>
      </div>`).join('') + '</div>';
    return;
  }

  main.innerHTML = filtered.map((ex) => `
    <div class="exercise" data-id="${ex.id}" data-mega="${ex.mega}" style="${megaVar(ex.mega)}">
      <div class="exercise-header" tabindex="0" role="button" aria-expanded="false" onclick="toggleEx('${ex.id}')">
        <div class="ex-icon">${icons[ex.icon] || icons.standing}</div>
        <div class="ex-info">
          <div class="ex-title">${state.favorites[ex.id] ? '<span class="fav-star">★</span> ' : ''}${ex.title}</div>
          ${ex.sanskrit ? `<div class="ex-sanskrit">${ex.sanskrit}</div>` : ''}
          <div class="ex-tag">${ex.tag}</div>
        </div>
        <div class="chevron">▶</div>
        <div class="badge-row">
          ${importanceBadge(ex.id, ex.mega)}
          ${esotericBadge(ex.id, ex.mega)}
          ${megaBadge(ex.mega)}
        </div>
      </div>
      <div class="exercise-body">
        <div class="big-icon">${icons[ex.icon] || icons.standing}</div>
        ${ex.quickCue ? `<div class="quick-cue">💡 ${ex.quickCue}</div>` : ''}
        <div class="ex-actions">
          <button class="btn accent small" onclick="openLogSheet('${ex.id}','timer')">⏱ Practice</button>
          <button class="btn small" onclick="openLogSheet('${ex.id}','log')">➕ Log</button>
          <button class="btn small" onclick="toggleFav('${ex.id}')">${state.favorites[ex.id] ? '★ Unfavorite' : '☆ Favorite'}</button>
        </div>
        ${ex.general ? `
          <div class="section"><div class="section-title">General Setup</div><div class="section-content"><ul>${ex.general.setup.map((s) => `<li>${s}</li>`).join('')}</ul></div></div>
          <div class="section"><div class="section-title">General Practice</div><div class="section-content"><ul>${ex.general.movement.map((s) => `<li>${s}</li>`).join('')}</ul></div></div>
          <div class="section"><div class="section-title warn">Common Mistakes</div><div class="section-content"><ul>${ex.general.mistakes.map((s) => `<li>${s}</li>`).join('')}</ul></div></div>
        ` : ''}
        ${ex.variations ? `
          <div class="section">
            <div class="section-title var">Variations (${ex.variations.length}) — Tap to expand</div>
            <div class="variations-wrap">
              ${ex.variations.map((v) => `
                <div class="variation" data-vid="${ex.id}-${v.id}">
                  <div class="variation-header" tabindex="0" role="button" aria-expanded="false" onclick="toggleVar('${ex.id}-${v.id}')">
                    <div class="var-title">${v.title}${v.sanskrit ? ` <span style="font-size:11px; color:#a090c0; font-style:italic; font-weight:400;">(${v.sanskrit})</span>` : ''}</div>
                    <div class="var-chev">▶</div>
                    <div class="var-badge-row">
                      ${difficultyBadge(v.id, ex.id)}
                      ${v.best ? `<div class="var-best">${v.best}</div>` : ''}
                    </div>
                  </div>
                  <div class="variation-body">
                    ${v.cue ? `<div class="var-cue">${v.cue}</div>` : ''}
                    <div class="ex-actions"><button class="btn accent small" onclick="startTimerFor('${ex.id}','${v.id}')">⏱ Practice this</button></div>
                    ${renderPosition(ex.id + '-' + v.id, getPosition(v, ex.id))}
                    ${v.setup ? `<div class="var-section"><div class="var-section-title">Setup</div><div class="var-section-content"><ul>${v.setup.map((s) => `<li>${s}</li>`).join('')}</ul></div></div>` : ''}
                    ${v.movement ? `<div class="var-section"><div class="var-section-title">Practice</div><div class="var-section-content"><ul>${v.movement.map((s) => `<li>${s}</li>`).join('')}</ul></div></div>` : ''}
                    ${v.mistakes ? `<div class="var-section"><div class="var-section-title warn">Mistakes</div><div class="var-section-content"><ul>${v.mistakes.map((s) => `<li>${s}</li>`).join('')}</ul></div></div>` : ''}
                    ${v.programming ? `<div class="var-section"><div class="var-section-title">Practice Dose</div><div class="var-section-content"><div class="programming-grid">${Object.entries(v.programming).map(([k, val]) => `<div>${k}</div><div>${val}</div>`).join('')}</div></div></div>` : ''}
                    ${v.tip ? `<div class="var-section"><div class="var-section-title" style="color:#5fd068">Tip</div><div class="var-section-content">${v.tip}</div></div>` : ''}
                    ${v.warning ? `<div class="var-section"><div class="var-section-title" style="color:#e25555">⚠️ Caution</div><div class="var-section-content">${v.warning}</div></div>` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  `).join('');
}
function toggleEx(id) { setExpanded(document.querySelector(`.exercise[data-id="${id}"]`), '.exercise-header'); }
/* open/close a disclosure card, keeping its header's aria-expanded honest */
function setExpanded(card, headSel) {
  if (!card) return;
  const open = card.classList.toggle('open');
  const head = card.querySelector(headSel);
  if (head) head.setAttribute('aria-expanded', open ? 'true' : 'false');
}
function toggleVar(vid) {
  event.stopPropagation();
  setExpanded(document.querySelector(`.variation[data-vid="${vid}"]`), '.variation-header');
}
function toggleFav(exId) {
  event.stopPropagation();
  if (state.favorites[exId]) delete state.favorites[exId];
  else state.favorites[exId] = true;
  saveState();
  renderLibrary();
}

/* recipe view — one practice laid out like a recipe card: ingredients (setup),
   method (the atomic steps), watch-outs (mistakes), dose (programming) */
function openRecipe(exId) {
  const ex = EX_BY_ID[exId];
  if (!ex) return;
  const vars = ex.variations || [];
  const body = (varId) => {
    const v = varId ? getVar(exId, varId) : null;
    const setup = (v && v.setup) || (ex.general && ex.general.setup) || [];
    const method = (v && v.movement) || (ex.general && ex.general.movement) || [];
    const mistakes = (v && v.mistakes) || (ex.general && ex.general.mistakes) || [];
    const cue = v ? v.cue : ex.quickCue;
    return `
      ${cue ? `<div class="quick-cue" style="margin-top:0">💡 ${cue}</div>` : ''}
      <div class="recipe-glance">
        ${v ? difficultyBadge(v.id, ex.id) : importanceBadge(ex.id, ex.mega)}
        ${esotericBadge(ex.id, ex.mega)}
        ${megaBadge(ex.mega)}
        <span class="rc-meta">~${suggestedMin(ex, v)} min</span>
      </div>
      ${v ? renderPosition('rc-' + ex.id + '-' + v.id, getPosition(v, ex.id)) : ''}
      ${setup.length ? `<div class="section"><div class="section-title">🧺 Ingredients — set up</div><div class="section-content"><ul>${setup.map((s) => `<li>${s}</li>`).join('')}</ul></div></div>` : ''}
      ${method.length ? `<div class="section"><div class="section-title">👣 Method — atomic steps</div><div class="section-content"><ol>${method.map((s) => `<li>${s}</li>`).join('')}</ol></div></div>` : ''}
      ${mistakes.length ? `<div class="section"><div class="section-title warn">⚠️ Watch out</div><div class="section-content"><ul>${mistakes.map((s) => `<li>${s}</li>`).join('')}</ul></div></div>` : ''}
      ${v && v.programming ? `<div class="section"><div class="section-title">⏲️ Dose</div><div class="section-content"><div class="programming-grid">${Object.entries(v.programming).map(([k, val]) => `<div>${k}</div><div>${val}</div>`).join('')}</div></div></div>` : ''}
      ${v && v.tip ? `<div class="section"><div class="section-title" style="color:#5fd068">Tip</div><div class="section-content">${v.tip}</div></div>` : ''}
      ${v && v.warning ? `<div class="section"><div class="section-title" style="color:#e25555">⚠️ Caution</div><div class="section-content">${v.warning}</div></div>` : ''}`;
  };
  showOverlay(`
    <div class="overlay" id="rc-ov">
      <div class="sheet" style="${megaVar(ex.mega)}">
        <div class="sheet-head">
          <div class="rc-icon" style="width:30px;height:30px;flex-shrink:0">${icons[ex.icon] || icons.standing}</div>
          <div class="t">${ex.title}${ex.sanskrit ? ` <span style="font-size:11px;color:#a090c0;font-style:italic;font-weight:400">${ex.sanskrit}</span>` : ''}</div>
          <button class="btn small" id="rc-close">✕</button>
        </div>
        <div class="sheet-body">
          ${vars.length ? `
            <div class="field-label">Variation</div>
            <select class="var-select" id="rc-var" style="margin-top:0">
              <option value="">${esc(ex.title)} (general)</option>
              ${vars.map((v) => `<option value="${v.id}">${esc(v.title)}</option>`).join('')}
            </select>` : ''}
          ${exHistoryLine(exId)}
          <div id="rc-body">${body(null)}</div>
          <div class="btn-row" style="margin-top:12px">
            <button class="btn accent" id="rc-practice" style="flex:1">⏱ Practice</button>
            <button class="btn" id="rc-log" style="flex:1">➕ Log</button>
            <button class="btn" id="rc-fav" style="flex:1">${state.favorites[exId] ? '★ Favorited' : '☆ Favorite'}</button>
          </div>
        </div>
      </div>
    </div>`);
  let curVar = '';
  const varSel = $('rc-var');
  if (varSel) varSel.addEventListener('change', () => { curVar = varSel.value; $('rc-body').innerHTML = body(curVar || null); });
  $('rc-close').addEventListener('click', closeOverlay);
  $('rc-ov').addEventListener('click', (e) => { if (e.target.id === 'rc-ov') closeOverlay(); });
  $('rc-practice').addEventListener('click', () => { if (curVar) startTimerFor(exId, curVar); else openLogSheet(exId, 'timer'); });
  $('rc-log').addEventListener('click', () => openLogSheet(exId, 'log'));
  $('rc-fav').addEventListener('click', () => {
    if (state.favorites[exId]) delete state.favorites[exId];
    else state.favorites[exId] = true;
    saveState();
    renderLibrary();
    $('rc-fav').textContent = state.favorites[exId] ? '★ Favorited' : '☆ Favorite';
  });
}

/* ==================================================================
   SESSIONS
   ================================================================== */
function startSession() {
  if (active) return;
  active = { id: uid(), date: todayStr(), startedAt: Date.now(), endedAt: null, entries: [], notes: '', planId: null, planName: null, updatedAt: Date.now() };
  savePending();
}
function logEntry(exId, varId, min, opts) {
  if (!active) { startSession(); toast('Session started'); }
  active.entries.push({ id: uid(), exId: exId, varId: varId || null, min: Math.max(1, Math.round(min)) });
  active.updatedAt = Date.now();
  savePending();
  if (!opts || !opts.quiet) { renderAll(); toast('Logged ' + displayName(exId, varId)); }
}
/* Log a practice you did on an earlier day — it joins (or starts) that day's session
   directly, without disturbing whatever is running now. */
function logOn(exId, varId, min, date) {
  if (!date || date === todayStr()) { logEntry(exId, varId, min); return; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { toast('Pick a valid date'); return; }
  if (date > todayStr()) { toast('You can’t log a practice in the future'); return; }
  let s = null;
  state.sessions.forEach((x) => { if (x.date === date && !x.planId) s = x; });
  if (!s) {
    s = { id: uid(), date: date, startedAt: new Date(date + 'T12:00:00').getTime(), endedAt: null, entries: [], notes: '', planId: null, planName: null, updatedAt: Date.now() };
    state.sessions.push(s);
  }
  s.entries.push({ id: uid(), exId: exId, varId: varId || null, min: Math.max(1, Math.round(min)) });
  s.updatedAt = Date.now();
  sortSessions();
  saveState();
  renderAll();
  toast('Logged ' + fmtMin(min) + ' to ' + dateLabel(date));
}
/* minutes are editable in place — mistyping a duration used to mean delete and re-add */
function setEntryMin(sid, eid, val) {
  const s = sid ? state.sessions.find((x) => x.id === sid) : active;
  if (!s) return;
  const e = s.entries.find((x) => x.id === eid);
  if (!e) return;
  const n = Math.max(1, Math.min(600, Math.round(+val || 0)));
  if (n === e.min) return;
  e.min = n;
  s.updatedAt = Date.now();
  if (sid) saveState(); else savePending();
  renderAll();
}
/* your own track record with one practice, shown wherever you're about to pick it */
function exHistory(exId) {
  let n = 0, min = 0, last = null;
  allSessions().forEach((s) => s.entries.forEach((e) => {
    if (e.exId !== exId) return;
    n++; min += e.min;
    if (!last || s.date > last) last = s.date;
  }));
  return { n: n, min: min, last: last };
}
function exHistoryLine(exId) {
  const h = exHistory(exId);
  return `<button type="button" class="ex-hist" onclick="openExStats('${exId}')">${h.n
    ? `📈 You’ve practiced this <strong>${h.n}×</strong> · ${fmtMin(h.min)} total · last ${dateLabel(h.last)} ›`
    : '📈 You haven’t practiced this yet. ›'}</button>`;
}
const FEELS = [null, { i: '😖', l: 'Rough' }, { i: '😕', l: 'Restless' }, { i: '😐', l: 'Neutral' }, { i: '🙂', l: 'Settled' }, { i: '😌', l: 'Great' }];
function setFeel(n) {
  if (!active) return;
  active.feel = active.feel === n ? null : n;
  active.updatedAt = Date.now();
  savePending();
  renderPractice();
}
async function endSession() {
  if (!active) return;
  if (!active.entries.length) { discardSession(true); return; }
  const total = sessionMin(active);
  active.endedAt = Date.now();
  active.updatedAt = Date.now();
  state.sessions.push(active);
  sortSessions();
  logPortalActivity(total);
  const prior = state.sessions.filter((s) => s.date < active.date);
  const last = prior.length ? prior[prior.length - 1] : null;
  active = null;
  savePending();
  saveState();
  renderAll();
  bell(2);
  if (state.sync.auto) driveBackupNow({ silent: true }); // never blocks the summary
  const s = streaks();
  let msg = 'Streak: ' + s.current + ' day' + (s.current === 1 ? '' : 's') + '.';
  if (last) {
    const lm = sessionMin(last);
    msg += total >= lm ? '\nYou met your last session (' + fmtMin(lm) + ') — ' + (total > lm ? 'and beat it.' : 'matched.') : '\nLast session was ' + fmtMin(lm) + ' — there’s tomorrow.';
  }
  await choiceDialog({ title: '✨ Session complete — ' + fmtMin(total), msg: msg, buttons: [{ label: 'Done', value: true, kind: 'primary' }] });
}
/* The maker portal on this origin reads a shared list of [unixSeconds, slug, kind, amount] to draw its
   streak. Amount is tens of minutes, as in the sibling apps. Backdated logs are left out: their
   timestamp would put them on the wrong day. */
function logPortalActivity(min) {
  try {
    const k = 'portal-activity', a = JSON.parse(localStorage.getItem(k) || '[]');
    a.push([Math.round(Date.now() / 1000), 'InsightMaster', 'focus', Math.max(1, Math.round(min / 10))]);
    localStorage.setItem(k, JSON.stringify(a.slice(-2000)));
  } catch (e) { /* quota or bad JSON — the portal is optional */ }
}
async function discardSession(silent) {
  if (!active) return;
  if (!silent) {
    const ok = await choiceDialog({ title: 'Discard session?', msg: 'The ' + active.entries.length + ' logged practice(s) will be lost.', buttons: [{ label: 'Discard', value: true, kind: 'danger' }, { label: 'Keep', value: false }] });
    if (!ok) return;
  }
  active = null;
  savePending();
  renderAll();
}
function deleteEntry(entryId) {
  if (!active) return;
  const i = active.entries.findIndex((e) => e.id === entryId);
  if (i < 0) return;
  const gone = active.entries.splice(i, 1)[0];
  active.updatedAt = Date.now();
  savePending();
  renderAll();
  toast('Removed ' + displayName(gone.exId, gone.varId), () => {
    if (!active) { toast('Session already ended — nothing to undo into'); return; }
    active.entries.splice(i, 0, gone);
    active.updatedAt = Date.now();
    savePending();
    renderAll();
  });
}

/* ---------- practice panel ---------- */
let _elapsedT = null;
function recentExIds(n) {
  const seen = [], have = {};
  const sess = state.sessions.slice().reverse();
  for (const s of sess) {
    for (const e of s.entries.slice().reverse()) {
      if (!have[e.exId]) { have[e.exId] = 1; seen.push(e.exId); if (seen.length >= n) return seen; }
    }
  }
  return seen;
}
/* localStorage is the only copy of a practice log until you export one, and clearing
   site data is a two-tap accident. Nag gently, and only once a week. */
const DAY_MS = 86400000;
function backupNudgeHtml() {
  if (state.sessions.length < 5) return '';
  if (state.backupNudgedAt && Date.now() - state.backupNudgedAt < 7 * DAY_MS) return '';
  const days = state.lastExportAt ? Math.floor((Date.now() - state.lastExportAt) / DAY_MS) : null;
  if (days !== null && days < 14) return '';
  return `<div class="card nudge">
    <h2>💾 Back up your practice log</h2>
    <div class="sub">${days === null
      ? state.sessions.length + ' sessions logged and no backup yet.'
      : 'Your last backup was ' + days + ' days ago.'}
      It lives in this browser only — clearing site data would erase it.</div>
    <div class="btn-row">
      <button class="btn accent" id="nudge-export">⬇ Export now</button>
      ${driveClientId() ? '<button class="btn" id="nudge-drive">☁️ To Drive</button>' : ''}
      <button class="btn" id="nudge-later">Later</button>
    </div>
  </div>`;
}
function bindBackupNudge() {
  const ex = $('nudge-export');
  if (!ex) return;
  ex.addEventListener('click', () => { exportJson(); renderPractice(); });
  const dr = $('nudge-drive');
  if (dr) dr.addEventListener('click', async () => { if (await driveBackupNow({})) renderPractice(); });
  $('nudge-later').addEventListener('click', () => { state.backupNudgedAt = Date.now(); saveState(); renderPractice(); });
}
function renderPractice() {
  const p = $('panel-practice');
  clearInterval(_elapsedT);
  const days = dayTotals();
  const todayMin = days[todayStr()] || 0;
  const yd = new Date(); yd.setDate(yd.getDate() - 1);
  const yMin = days[todayStr(yd)] || 0;
  const wk = weekStart(new Date());
  const weekMin = Object.keys(days).reduce((t, ds) => t + (weekStart(new Date(ds + 'T12:00:00')) === wk ? days[ds] : 0), 0);
  const goalBar = `
    <div class="goal-line"><span>This week</span><span class="g">${weekMin} / ${state.goal.weeklyMin} min</span></div>
    <div class="mile-bar"><div class="f" style="width:${Math.min(100, Math.round(weekMin / Math.max(1, state.goal.weeklyMin) * 100))}%"></div></div>`;

  if (!active) {
    const quick = Object.keys(state.favorites).concat(recentExIds(8)).filter((v, i, a) => a.indexOf(v) === i && exFor(v)).slice(0, 8);
    p.innerHTML = `
      ${backupNudgeHtml()}
      <div class="card">
        <h2>🧘 Ready to practice</h2>
        <div class="sub">${todayMin ? 'Today so far: <strong style="color:#b48aff">' + fmtMin(todayMin) + '</strong>' : (yMin ? 'Yesterday: ' + fmtMin(yMin) + ' — keep the thread going.' : 'Begin your first session.')}</div>
        <div class="btn-row"><button class="btn accent big" id="begin-btn">Begin Practice</button></div>
        ${goalBar}
      </div>
      ${quick.length ? `<div class="card"><h2>⚡ Quick start</h2><div class="quickstart-grid">${quick.map((id) => `<button class="btn small" onclick="openLogSheet('${esc(id)}','timer')">${state.favorites[id] ? '★ ' : ''}${esc(exFor(id).title)}</button>`).join('')}</div></div>` : ''}
      <div class="card">
        <h2>🗺️ Or run a plan</h2>
        <div class="quickstart-grid">${state.plans.slice(0, 4).map((pl) => `<button class="btn small" onclick="startPlan('${pl.id}')">▶ ${esc(pl.name)}</button>`).join('') || '<span class="muted">No plans yet — see the Plans tab.</span>'}</div>
      </div>`;
    const bb = $('begin-btn');
    if (bb) bb.addEventListener('click', () => { startSession(); renderAll(); });
    bindBackupNudge();
    return;
  }

  const total = sessionMin(active);
  const beat = yMin ? (total >= yMin
    ? `<div class="beat-chip ahead">✅ ${total > yMin ? 'Beat' : 'Matched'} yesterday (${fmtMin(yMin)})</div>`
    : `<div class="beat-chip behind">🎯 ${fmtMin(yMin - total)} to match yesterday</div>`) : '';
  p.innerHTML = `
    <div class="card">
      <div class="elapsed-strip"><span class="clock" id="sess-clock"></span><span class="muted">in session · ${fmtMin(total)} logged${active.planName ? ' · ' + esc(active.planName) : ''}</span></div>
      ${beat}
      <div class="btn-row">
        <button class="btn accent" id="add-practice-btn">➕ Add Practice</button>
        <button class="btn good" id="end-btn">✔ End Session</button>
        <button class="btn danger" id="discard-btn">✕</button>
      </div>
      ${goalBar}
    </div>
    <div class="card">
      <h2>Logged this session</h2>
      ${active.entries.length ? active.entries.map((e) => `
        <div class="entry-row">
          <div class="e-icon">${icons[(exFor(e.exId) || {}).icon] || icons.meditation || ''}</div>
          <div class="e-name">${esc(displayName(e.exId, e.varId))}</div>
          <input class="e-min-edit" type="number" min="1" max="600" value="${e.min}" aria-label="Minutes — ${esc(displayName(e.exId, e.varId))}" onchange="setEntryMin('','${e.id}',this.value)">
          <button class="entry-x" onclick="deleteEntry('${e.id}')" aria-label="Remove">✕</button>
        </div>`).join('') : '<div class="muted">Nothing yet — add a practice or start a timer.</div>'}
      <div class="field-label">How did it feel?</div>
      <div class="feel-row">${[1, 2, 3, 4, 5].map((n) => `
        <button type="button" class="feel ${active.feel === n ? 'on' : ''}" aria-pressed="${active.feel === n}" onclick="setFeel(${n})">${FEELS[n].i}<span class="fl">${FEELS[n].l}</span></button>`).join('')}</div>
      <textarea class="session-note" id="sess-note" placeholder="Session notes — what did you notice?">${esc(active.notes || '')}</textarea>
    </div>`;
  $('add-practice-btn').addEventListener('click', () => openPicker());
  $('end-btn').addEventListener('click', endSession);
  $('discard-btn').addEventListener('click', () => discardSession(false));
  $('sess-note').addEventListener('change', (e) => { active.notes = e.target.value; active.updatedAt = Date.now(); savePending(); });
  const tick = () => { const el = $('sess-clock'); if (el && active) el.textContent = fmtClock((Date.now() - active.startedAt) / 1000); };
  tick();
  _elapsedT = setInterval(tick, 1000);
}

/* ==================================================================
   PICKER & LOG SHEET
   ================================================================== */
function openPicker(onPick) {
  onPick = onPick || ((exId) => openLogSheet(exId, 'ask'));
  let q = '', mega = 'all';
  const recent = recentExIds(20);
  const draw = () => {
    const list = exercises.filter((ex) => (mega === 'all' || ex.mega === mega) && exerciseMatchesSearch(ex, q));
    // what you actually practise floats to the top: favorites, then recents, then the rest
    const rank = (ex) => (state.favorites[ex.id] ? 0 : recent.indexOf(ex.id) >= 0 ? 1 : 2);
    list.sort((a, b) => rank(a) - rank(b));
    $('picker-list').innerHTML = list.map((ex) => `
      <div class="picker-row" data-ex="${ex.id}" tabindex="0" role="button">
        <div class="p-icon">${icons[ex.icon] || icons.standing}</div>
        <div class="p-info"><div class="p-title">${state.favorites[ex.id] ? '★ ' : ''}${ex.title}</div><div class="p-sub">${ex.tag}</div></div>
        ${esotericBadge(ex.id, ex.mega)}
      </div>`).join('') || `<div class="no-results">${HAS_CONTENT ? 'No matches.' : 'No content pack loaded — type your own practice above.'}</div>`;
    document.querySelectorAll('#picker-list .picker-row').forEach((r) => {
      r.addEventListener('click', () => { closeOverlay(); onPick(r.dataset.ex); });
    });
  };
  const pickCustom = () => {
    // strip quotes/brackets: these names reach inline onclick handlers, so keep them inert
    const name = ($('picker-q').value || '').replace(/["'`\\<>]/g, '').trim().slice(0, 60);
    if (!name) return;
    closeOverlay();
    onPick(CUSTOM_PREFIX + name);
  };
  showOverlay(`
    <div class="overlay" id="picker-ov">
      <div class="sheet">
        <div class="sheet-head"><div class="t">Choose a practice</div><button class="btn small" id="picker-close">✕</button></div>
        <div class="sheet-body">
          <div style="display:flex;gap:6px">
            <input class="picker-search" id="picker-q" placeholder="${HAS_CONTENT ? 'Search or type your own...' : 'Name your practice...'}" autocomplete="off" style="flex:1">
            <button class="btn small" id="picker-custom" title="Log what you typed as your own practice">➕ Own</button>
          </div>
          ${HAS_CONTENT ? `<div class="mega-filter" id="picker-megas">
            ${['all'].concat(Object.keys(MEGA_LABELS)).map((m) => `<div class="mega-pill ${m === 'all' ? 'active' : ''} ${m !== 'all' && isDarkColor(megaColor(m)) ? 'on-dark' : ''}" style="--mc:${m === 'all' ? '#888888' : megaColor(m)}" data-mega="${m}" tabindex="0" role="button">${esc(m === 'all' ? 'All' : MEGA_LABELS[m])}</div>`).join('')}
          </div>` : ''}
          <div id="picker-list"></div>
        </div>
      </div>
    </div>`);
  $('picker-close').addEventListener('click', closeOverlay);
  $('picker-ov').addEventListener('click', (e) => { if (e.target.id === 'picker-ov') closeOverlay(); });
  $('picker-q').addEventListener('input', (e) => { q = e.target.value.trim().toLowerCase(); draw(); });
  $('picker-q').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const first = document.querySelector('#picker-list .picker-row'); // Enter takes the top match, or your own words when nothing matches
    if (first) { closeOverlay(); onPick(first.dataset.ex); } else pickCustom();
  });
  $('picker-custom').addEventListener('click', pickCustom);
  document.querySelectorAll('#picker-megas .mega-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('#picker-megas .mega-pill').forEach((x) => x.classList.remove('active'));
      pill.classList.add('active');
      mega = pill.dataset.mega;
      draw();
    });
  });
  draw();
  $('picker-q').focus();
}

function openLogSheet(exId, mode) {
  const ex = exFor(exId);
  if (!ex) return;
  let varId = null;
  let mins = suggestedMin(ex, null);
  const vars = ex.variations || [];
  const drawMin = () => { $('ls-min').textContent = mins || '∞'; };
  showOverlay(`
    <div class="overlay" id="ls-ov">
      <div class="sheet">
        <div class="sheet-head"><div class="t">${esc(ex.title)}</div><button class="btn small" id="ls-close">✕</button></div>
        <div class="sheet-body">
          ${ex.quickCue ? `<div class="quick-cue" style="margin-top:0">💡 ${ex.quickCue}</div>` : ''}
          ${exHistoryLine(exId)}
          ${vars.length ? `
            <div class="field-label">Variation</div>
            <select class="var-select" id="ls-var">
              <option value="">${esc(ex.title)} (general)</option>
              ${vars.map((v) => `<option value="${v.id}">${esc(v.title)}</option>`).join('')}
            </select>` : ''}
          <div class="field-label">Minutes</div>
          <div class="preset-row">${[3, 5, 10, 15, 20, 30, 45, 60].map((n) => `<button class="btn small ls-preset" data-n="${n}">${n}</button>`).join('')}<button class="btn small ls-preset" data-n="0" title="Open sit — no set length, Done ends it">∞</button></div>
          <div class="minute-stepper">
            <button class="btn" id="ls-m5">−5</button><button class="btn" id="ls-m1">−1</button>
            <div class="val"><span id="ls-min"></span><span style="font-size:14px;color:#887a9a">m</span></div>
            <button class="btn" id="ls-p1">+1</button><button class="btn" id="ls-p5">+5</button>
          </div>
          <div class="field-label">When (for “Log it”)</div>
          <div class="preset-row">
            <button class="btn small ls-day" data-d="0">Today</button>
            <button class="btn small ls-day" data-d="1">Yesterday</button>
            <input class="mini" type="date" id="ls-date" value="${todayStr()}" max="${todayStr()}" aria-label="Date practised">
          </div>
        </div>
        <div class="sheet-foot">
          <button class="btn primary" id="ls-log">➕ Log it</button>
          <button class="btn accent" id="ls-timer">⏱ Start Timer</button>
        </div>
      </div>
    </div>`);
  drawMin();
  const setMin = (n) => { mins = Math.min(180, Math.max(1, n)); drawMin(); };
  $('ls-close').addEventListener('click', closeOverlay);
  $('ls-ov').addEventListener('click', (e) => { if (e.target.id === 'ls-ov') closeOverlay(); });
  document.querySelectorAll('.ls-preset').forEach((b) => b.addEventListener('click', () => { const n = +b.dataset.n; if (n === 0) { mins = 0; drawMin(); } else setMin(n); }));
  $('ls-m5').addEventListener('click', () => setMin(mins - 5));
  $('ls-m1').addEventListener('click', () => setMin(mins - 1));
  $('ls-p1').addEventListener('click', () => setMin(mins + 1));
  $('ls-p5').addEventListener('click', () => setMin(mins + 5));
  const lsVar = $('ls-var');
  if (lsVar) lsVar.addEventListener('change', () => {
    varId = lsVar.value || null;
    setMin(suggestedMin(ex, getVar(exId, varId)));
  });
  document.querySelectorAll('.ls-day').forEach((b) => b.addEventListener('click', () => {
    const d = new Date();
    d.setDate(d.getDate() - (+b.dataset.d));
    $('ls-date').value = todayStr(d);
  }));
  $('ls-log').addEventListener('click', () => { const day = $('ls-date').value; closeOverlay(); logOn(exId, varId, mins || suggestedMin(ex, getVar(exId, varId)), day); });
  $('ls-timer').addEventListener('click', () => { closeOverlay(); startTimer({ exId: exId, varId: varId, min: mins }); });
  if (mode === 'timer') { /* default focus on timer path — same sheet, user taps Start */ }
}
function startTimerFor(exId, varId) {
  event.stopPropagation();
  const ex = exFor(exId);
  startTimer({ exId: exId, varId: varId, min: suggestedMin(ex, getVar(exId, varId)) });
}

/* ==================================================================
   TIMER (single practice + plan runner share this overlay)
   ================================================================== */
let T = null; // {queue:[{exId,varId,min}], idx, endTs, remainMs, paused, planId, planName, logged:[], lastBellMin}
let _timerT = null;
let _wakeLock = null;
async function grabWakeLock() {
  try { _wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { _wakeLock = null; }
}
function releaseWakeLock() { try { if (_wakeLock) _wakeLock.release(); } catch (e) {} _wakeLock = null; }
document.addEventListener('visibilitychange', () => { if (T && !T.paused && document.visibilityState === 'visible') grabWakeLock(); });

function startTimer(opts) {
  startPlanQueue([{ exId: opts.exId, varId: opts.varId || null, min: opts.min }], null, null);
}
function startPlanQueue(queue, planId, planName) {
  T = { queue: queue, idx: 0, planId: planId, planName: planName, logged: [], paused: false };
  beginStep();
}
function stepsFor(step) {
  const ex = exFor(step.exId);
  const v = getVar(step.exId, step.varId);
  return (v && v.movement) || (ex && ex.general && ex.general.movement) || [];
}
function beginStep() {
  const step = T.queue[T.idx];
  T.stepStart = Date.now();
  T.open = !step.min; // 0 minutes = open sit: count up until Done
  T.durMs = step.min * 60000;
  T.endTs = Date.now() + T.durMs;
  T.paused = false;
  T.lastBellMin = 0;
  if (T.idx === 0 && state.sound.prepSec > 0 && !T.prepped) { T.prepped = true; runPrep(); return; }
  bell(1);
  runTimer();
}
/* A few quiet seconds before the opening bell, so the sit doesn't start while the phone is
   still being put down. Only ahead of the first step; a plan flows on after that. Nothing is
   persisted until the bell — a sit that never began is nothing to resume. */
function runPrep() {
  T.prepping = true;
  T.steps = stepsFor(T.queue[T.idx]);
  T.cueIdx = -1;
  drawTimer();
  grabWakeLock();
  const end = Date.now() + state.sound.prepSec * 1000;
  const tick = () => {
    const left = Math.ceil((end - Date.now()) / 1000);
    if (left <= 0) return endPrep();
    const count = $('t-count'), cue = $('t-cue');
    if (count) count.textContent = String(left);
    if (cue) { cue.style.display = ''; cue.innerHTML = '<span class="n">Settling in</span>Find your seat — the bell begins the sit.'; }
  };
  clearInterval(_timerT);
  _timerT = setInterval(tick, 250);
  tick();
}
function endPrep() {
  clearInterval(_timerT);
  T.prepping = false;
  T.stepStart = Date.now();
  T.endTs = Date.now() + T.durMs;
  bell(1);
  runTimer();
}
// draw + tick + keep the screen on + persist; shared by a fresh step and a resumed one
function runTimer() {
  T.steps = stepsFor(T.queue[T.idx]);
  T.cueIdx = -1;
  drawTimer();
  grabWakeLock();
  saveTimer();
  clearInterval(_timerT);
  _timerT = setInterval(timerTick, 250);
  timerTick();
}
/* Walk the atomic steps in time with the countdown: the practice's steps get an equal
   slice of the duration each, so the timer teaches the technique instead of just ending it.
   ponytail: even split — switch to per-step seconds if a content pack ever carries them. */
function paintCue() {
  const box = $('t-cue');
  if (!box) return;
  const list = T.steps || [];
  const i = T.cueIdx;
  if (!list.length || i < 0) { box.style.display = 'none'; return; }
  box.style.display = '';
  box.innerHTML = `<span class="n">Step ${i + 1} of ${list.length}</span>${list[i]}`;
  document.querySelectorAll('#t-steps li').forEach((li, k) => {
    li.classList.toggle('cur', k === i);
    li.classList.toggle('done', k < i);
  });
}
function timerTick() {
  if (!T || T.paused) return;
  if (T.open) { // count up; the sit ends when you say so
    const el = Date.now() - T.stepStart;
    const c = $('t-count');
    if (c) c.textContent = fmtClock(el / 1000);
    document.title = fmtClock(el / 1000) + ' · ' + APP_TITLE;
    const ivo = state.sound.intervalMin;
    if (ivo > 0) { const em = Math.floor(el / 60000); if (em > T.lastBellMin && em % ivo === 0) { T.lastBellMin = em; bell(1); } }
    return;
  }
  const left = T.endTs - Date.now();
  const el = $('t-count');
  if (el) el.textContent = fmtClock(left / 1000);
  document.title = fmtClock(left / 1000) + ' · ' + APP_TITLE; // the tab reads as a clock on desktop
  const ring = $('t-ring');
  if (ring) {
    const frac = Math.max(0, left / T.durMs);
    ring.setAttribute('stroke-dashoffset', String(628 * (1 - frac)));
  }
  const n = (T.steps || []).length;
  if (n) {
    const i = Math.min(n - 1, Math.max(0, Math.floor(((T.durMs - left) / T.durMs) * n)));
    if (i !== T.cueIdx) {
      const advanced = i > T.cueIdx && T.cueIdx >= 0; // step 1 already got the start bell
      T.cueIdx = i;
      paintCue();
      if (advanced && state.sound.stepCue) bell(1, true);
    }
  }
  const iv = state.sound.intervalMin;
  if (iv > 0) {
    const elapsedMin = Math.floor((T.durMs - left) / 60000);
    if (elapsedMin > T.lastBellMin && elapsedMin % iv === 0 && left > 1500) { T.lastBellMin = elapsedMin; bell(1); }
  }
  if (left <= 0) stepDone(true);
}
function stepDone(auto) {
  if (T.prepping) { endPrep(); return; } // Done during the countdown = start now
  const step = T.queue[T.idx];
  const actualMs = T.open ? (T.paused ? T.elapsedMs : Date.now() - T.stepStart)
    : T.paused ? (T.durMs - T.remainMs) : Math.min(T.durMs, Date.now() - T.stepStart);
  const actualMin = Math.max(1, Math.round(actualMs / 60000));
  T.logged.push({ exId: step.exId, varId: step.varId, min: auto ? step.min : actualMin });
  if (T.idx < T.queue.length - 1) {
    bell(2);
    T.idx++;
    beginStep();
  } else {
    finishTimer();
  }
}
function skipStep() { // drop current step without logging it
  if (T.idx < T.queue.length - 1) { T.idx++; beginStep(); }
  else finishTimer();
}
/* A phone can discard a backgrounded tab mid-practice. Persist the running timer so a
   reload offers to pick it up instead of silently losing the session. */
const TIMER_KEY = 'ih_timer_v1';
function saveTimer() {
  if (!T) { localStorage.removeItem(TIMER_KEY); return; }
  localStorage.setItem(TIMER_KEY, JSON.stringify({
    queue: T.queue, idx: T.idx, planId: T.planId, planName: T.planName, logged: T.logged,
    endTs: T.endTs, durMs: T.durMs, paused: T.paused, remainMs: T.remainMs, stepStart: T.stepStart, elapsedMs: T.elapsedMs, savedAt: Date.now(),
  }));
}
async function resumeTimer() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(TIMER_KEY) || 'null'); } catch (e) { s = null; }
  localStorage.removeItem(TIMER_KEY);
  if (!s || !Array.isArray(s.queue) || !s.queue.length || !s.queue[s.idx]) return;
  const step = s.queue[s.idx];
  const open = !step.min;
  const elapsed = open ? (s.paused ? (s.elapsedMs || 0) : Date.now() - (s.stepStart || s.savedAt)) : 0;
  const left = Math.max(0, s.paused ? (s.remainMs || 0) : s.endTs - Date.now());
  const pick = await choiceDialog({
    title: '⏱ Timer interrupted',
    msg: displayName(step.exId, step.varId) + (open ? ' — open sit, ' + fmtClock(elapsed / 1000) + ' so far.' : left > 1000
      ? ' — ' + fmtClock(left / 1000) + ' still to run.'
      : ' — its time ran out while the app was closed.'),
    buttons: [
      { label: open || left > 1000 ? 'Resume' : 'Finish it', value: 'go', kind: 'primary' },
      { label: 'Discard', value: 'no' },
    ],
  });
  T = {
    queue: s.queue, idx: s.idx, planId: s.planId, planName: s.planName, logged: s.logged || [],
    paused: false, durMs: s.durMs, endTs: Date.now() + left, lastBellMin: 0, open: open, prepped: true,
    stepStart: open ? Date.now() - elapsed : Date.now() - (s.durMs - left),
  };
  if (pick === 'go') runTimer();
  else cancelTimer(); // keeps whatever steps had already completed
}
function finishTimer() {
  clearInterval(_timerT);
  releaseWakeLock();
  document.title = APP_TITLE;
  bell(state.sound.endBells || 2);
  const logged = T.logged, planId = T.planId, planName = T.planName;
  T = null;
  saveTimer();
  closeOverlay();
  if (logged.length) {
    if (!active) { startSession(); }
    if (planId && !active.planId) { active.planId = planId; active.planName = planName; }
    logged.forEach((l) => logEntry(l.exId, l.varId, l.min, { quiet: true }));
    renderAll();
    toast('Logged ' + logged.length + ' practice' + (logged.length === 1 ? '' : 's') + ' · ' + fmtMin(logged.reduce((t, l) => t + l.min, 0)));
  }
}
function cancelTimer() {
  clearInterval(_timerT);
  releaseWakeLock();
  document.title = APP_TITLE;
  const logged = T ? T.logged : [];
  const planId = T && T.planId, planName = T && T.planName;
  T = null;
  saveTimer();
  closeOverlay();
  // keep what was already completed in a plan run; the current step is abandoned
  if (logged && logged.length) {
    if (!active) startSession();
    if (planId && !active.planId) { active.planId = planId; active.planName = planName; }
    logged.forEach((l) => logEntry(l.exId, l.varId, l.min, { quiet: true }));
    renderAll();
  }
}
function pauseResume() {
  if (!T) return;
  if (T.paused) {
    T.endTs = Date.now() + T.remainMs;
    T.stepStart = T.open ? Date.now() - T.elapsedMs : Date.now() - (T.durMs - T.remainMs);
    T.paused = false;
    grabWakeLock();
    $('t-pause').textContent = '⏸ Pause';
  } else {
    T.remainMs = Math.max(0, T.endTs - Date.now());
    T.elapsedMs = Date.now() - T.stepStart;
    T.paused = true;
    releaseWakeLock();
    $('t-pause').textContent = '▶ Resume';
  }
  saveTimer();
}
function plusMinute() { if (T) { T.endTs += 60000; T.durMs += 60000; saveTimer(); } }
function drawTimer() {
  const step = T.queue[T.idx];
  const ex = exFor(step.exId) || { title: step.exId, general: null };
  const v = getVar(step.exId, step.varId);
  const steps = T.steps || stepsFor(step);
  const setup = (v && v.setup) || (ex.general && ex.general.setup) || [];
  const next = T.queue[T.idx + 1];
  showOverlay(`
    <div class="timer-wrap" id="timer-ov">
      ${T.planName || T.queue.length > 1 ? `<div class="timer-step-label">${esc(T.planName || 'Plan')}${T.queue.length > 1
        ? ` · Step ${T.idx + 1}/${T.queue.length}${next ? ' · Next: ' + esc(displayName(next.exId, next.varId)) : ' · Final step'}` : ''}</div>` : ''}
      <div class="timer-name">${esc(v ? v.title : ex.title)}</div>
      ${(v && v.sanskrit) || ex.sanskrit ? `<div class="timer-sanskrit">${esc((v && v.sanskrit) || ex.sanskrit)}</div>` : ''}
      ${state.avatar ? '<div class="avatar-box" id="av-box" title="Drag to turn"></div>' : ''}
      <div class="timer-cue" id="t-cue" aria-live="polite"></div>
      <div class="timer-ring-box${state.hideCount ? ' blind' : ''}" id="t-ringbox" title="Tap to hide or show the time">
        <svg viewBox="0 0 220 220">
          <circle cx="110" cy="110" r="100" fill="none" stroke="#1f1830" stroke-width="10"/>
          <circle id="t-ring" cx="110" cy="110" r="100" fill="none" stroke="#b48aff" stroke-width="10" stroke-linecap="round" stroke-dasharray="628" stroke-dashoffset="0"/>
        </svg>
        <div class="t-time"><span id="t-count">${fmtClock(step.min * 60)}</span><span class="t-sub">${step.min ? step.min + ' min' : 'open sit'}</span></div>
      </div>
      <div class="timer-controls">
        <button class="btn" id="t-pause"${T.prepping ? ' style="display:none"' : ''}>⏸ Pause</button>
        ${T.open ? '' : '<button class="btn" id="t-plus">+1 min</button>'}
        <button class="btn good" id="t-done">✔ Done</button>
        ${T.queue.length > 1 ? '<button class="btn" id="t-skip">⏭ Skip</button>' : ''}
        <button class="btn danger" id="t-cancel">✕</button>
      </div>
      ${steps.length || setup.length ? `<div class="timer-steps">
        ${setup.length ? `<div class="setup-line">Setup: ${setup.join(' · ')}</div>` : ''}
        ${steps.length ? `<div class="ts-title">Atomic steps</div>
        <ol id="t-steps">${steps.map((s) => `<li>${s}</li>`).join('')}</ol>` : ''}
        ${v && v.cue ? `<div class="setup-line" style="margin-top:8px">💡 ${v.cue}</div>` : ''}
      </div>` : ''}
    </div>`);
  $('t-pause').addEventListener('click', pauseResume);
  const plus = $('t-plus');
  if (plus) plus.addEventListener('click', plusMinute);
  $('t-ringbox').addEventListener('click', () => { state.hideCount = !state.hideCount; saveState(); $('t-ringbox').classList.toggle('blind', state.hideCount); });
  $('t-done').addEventListener('click', () => stepDone(false));
  $('t-cancel').addEventListener('click', cancelTimer);
  const sk = $('t-skip');
  if (sk) sk.addEventListener('click', skipStep);
  paintCue();
  if (state.avatar) AV.mount($('av-box'), { exId: step.exId, varId: step.varId });
}

/* ==================================================================
   PLANS
   ================================================================== */
const SEED_PLANS = IH_C.seedPlans || []; // curated plans ship with the content pack
function seedPlans() {
  if (!HAS_CONTENT) return; // seeded plans reference library ids — nothing to point at
  SEED_PLANS.forEach((sp) => {
    if (state.seededPlanIds.includes(sp.id)) return;
    state.seededPlanIds.push(sp.id);
    state.plans.push({ ...sp, steps: sp.steps.map((s) => ({ ...s })), seeded: true, updatedAt: Date.now() });
  });
  saveState();
}
function planMin(pl) { return pl.steps.reduce((t, s) => t + s.min, 0); }
function renderPlans() {
  const p = $('panel-plans');
  p.innerHTML = `
    <div class="btn-row" style="margin:0 0 10px 0"><button class="btn accent" id="new-plan-btn">➕ New Plan</button></div>
    ${state.plans.map((pl) => `
      <div class="plan-card">
        <div class="pt">${esc(pl.name)} <span class="muted">${fmtMin(planMin(pl))}</span></div>
        ${pl.desc ? `<div class="pd">${esc(pl.desc)}</div>` : ''}
        <div class="plan-steps-preview">${pl.steps.map((s) => esc(displayName(s.exId, s.varId)) + ' (' + s.min + 'm)').join(' → ')}</div>
        <div class="btn-row" style="margin-top:4px">
          <button class="btn accent small" onclick="startPlan('${pl.id}')">▶ Start</button>
          <button class="btn small" onclick="editPlan('${pl.id}')">✎ Edit</button>
          <button class="btn small" onclick="dupPlan('${pl.id}')">⧉ Copy</button>
          <button class="btn danger small" onclick="delPlan('${pl.id}')">✕</button>
        </div>
      </div>`).join('') || '<div class="no-results">No plans. Create one, or re-seed from Settings.</div>'}`;
  $('new-plan-btn').addEventListener('click', () => editPlan(null));
}
function startPlan(planId) {
  const pl = state.plans.find((x) => x.id === planId);
  if (!pl || !pl.steps.length) return;
  startPlanQueue(pl.steps.map((s) => ({ ...s })), pl.id, pl.name);
}
function dupPlan(planId) {
  const pl = state.plans.find((x) => x.id === planId);
  if (!pl) return;
  state.plans.push({ ...pl, id: uid(), name: pl.name + ' (copy)', steps: pl.steps.map((s) => ({ ...s })), seeded: false, updatedAt: Date.now() });
  saveState();
  renderPlans();
}
function delPlan(planId) {
  const i = state.plans.findIndex((x) => x.id === planId);
  if (i < 0) return;
  const gone = state.plans.splice(i, 1)[0];
  saveState();
  renderPlans();
  toast('Deleted “' + gone.name + '”', () => {
    state.plans.splice(i, 0, gone);
    saveState();
    renderPlans();
  });
}
function editPlan(planId, resumeDraft) {
  const existing = planId ? state.plans.find((x) => x.id === planId) : null;
  const draft = resumeDraft || (existing
    ? { id: existing.id, name: existing.name, desc: existing.desc || '', steps: existing.steps.map((s) => ({ ...s })) }
    : { id: uid(), name: '', desc: '', steps: [] });
  const draw = () => {
    $('pe-steps').innerHTML = draft.steps.map((s, i) => {
      const vs = (exFor(s.exId) || {}).variations || [];
      return `
      <div class="plan-step-row">
        <button class="btn small" data-up="${i}" ${i === 0 ? 'disabled style="opacity:0.3"' : ''} aria-label="Move up">↑</button>
        <button class="btn small" data-down="${i}" ${i === draft.steps.length - 1 ? 'disabled style="opacity:0.3"' : ''} aria-label="Move down">↓</button>
        <div class="n">${esc(displayName(s.exId, s.varId))}</div>
        <div class="mins"><button class="btn small" data-mless="${i}" aria-label="One minute less">−</button> ${s.min}m <button class="btn small" data-mmore="${i}" aria-label="One minute more">+</button></div>
        <button class="entry-x" data-rm="${i}" aria-label="Remove step">✕</button>
        ${vs.length ? `<select class="mini step-var" data-var="${i}" aria-label="Variation">
          <option value="">${esc(exFor(s.exId).title)} (general)</option>
          ${vs.map((v) => `<option value="${v.id}" ${s.varId === v.id ? 'selected' : ''}>${esc(v.title)}</option>`).join('')}
        </select>` : ''}
      </div>`;
    }).join('') || '<div class="muted">No steps yet.</div>';
    document.querySelectorAll('#pe-steps [data-var]').forEach((sel) => sel.addEventListener('change', () => {
      draft.steps[+sel.dataset.var].varId = sel.value || null;
      draw();
    }));
    const swap = (i, j) => { const t = draft.steps[i]; draft.steps[i] = draft.steps[j]; draft.steps[j] = t; draw(); };
    document.querySelectorAll('#pe-steps [data-up]').forEach((b) => b.addEventListener('click', () => {
      const i = +b.dataset.up; if (i > 0) swap(i, i - 1);
    }));
    document.querySelectorAll('#pe-steps [data-down]').forEach((b) => b.addEventListener('click', () => {
      const i = +b.dataset.down; if (i < draft.steps.length - 1) swap(i, i + 1);
    }));
    document.querySelectorAll('#pe-steps [data-rm]').forEach((b) => b.addEventListener('click', () => { draft.steps.splice(+b.dataset.rm, 1); draw(); }));
    document.querySelectorAll('#pe-steps [data-mless]').forEach((b) => b.addEventListener('click', () => { const s = draft.steps[+b.dataset.mless]; s.min = Math.max(1, s.min - 1); draw(); }));
    document.querySelectorAll('#pe-steps [data-mmore]').forEach((b) => b.addEventListener('click', () => { const s = draft.steps[+b.dataset.mmore]; s.min = Math.min(120, s.min + 1); draw(); }));
  };
  showOverlay(`
    <div class="overlay" id="pe-ov">
      <div class="sheet">
        <div class="sheet-head"><div class="t">${existing ? 'Edit plan' : 'New plan'}</div><button class="btn small" id="pe-close">✕</button></div>
        <div class="sheet-body">
          <div class="field-label">Name</div>
          <input class="text-input" id="pe-name" value="${esc(draft.name)}" placeholder="e.g. Lunch-break Reset">
          <div class="field-label">Description</div>
          <input class="text-input" id="pe-desc" value="${esc(draft.desc)}" placeholder="Optional">
          <div class="field-label">Steps</div>
          <div id="pe-steps"></div>
          <div class="btn-row"><button class="btn" id="pe-add">➕ Add step</button></div>
        </div>
        <div class="sheet-foot"><button class="btn accent" id="pe-save">Save Plan</button></div>
      </div>
    </div>`);
  draw();
  $('pe-close').addEventListener('click', closeOverlay);
  $('pe-add').addEventListener('click', () => {
    draft.name = $('pe-name').value; draft.desc = $('pe-desc').value;
    openPicker((exId) => {
      const ex = exFor(exId);
      draft.steps.push({ exId: exId, varId: null, min: suggestedMin(ex, null) });
      editPlan(planId, draft); // reopen the editor with the draft intact
    });
  });
  $('pe-save').addEventListener('click', async () => {
    draft.name = $('pe-name').value.trim();
    draft.desc = $('pe-desc').value.trim();
    if (!draft.name) { toast('Give the plan a name'); return; }
    if (!draft.steps.length) { toast('Add at least one step'); return; }
    if (existing) Object.assign(existing, { name: draft.name, desc: draft.desc, steps: draft.steps, updatedAt: Date.now() });
    else state.plans.push({ id: draft.id, name: draft.name, desc: draft.desc, steps: draft.steps, seeded: false, updatedAt: Date.now() });
    saveState();
    closeOverlay();
    renderPlans();
    toast('Plan saved');
  });
}
/* ==================================================================
   HISTORY
   ================================================================== */
let calMonth = null; // 'YYYY-MM'
let calSelDay = null;
function renderHistory() {
  const p = $('panel-history');
  if (!calMonth) calMonth = todayStr().slice(0, 7);
  const [yy, mm] = calMonth.split('-').map(Number);
  const first = new Date(yy, mm - 1, 1);
  const days = dayTotals();
  const startDow = (first.getDay() + 6) % 7; // Monday first
  const dim = new Date(yy, mm, 0).getDate();
  let cells = '';
  for (let i = 0; i < startDow; i++) cells += '<div class="cal-day out"></div>';
  for (let d = 1; d <= dim; d++) {
    const ds = calMonth + '-' + String(d).padStart(2, '0');
    const min = days[ds] || 0;
    const dot = min ? (min >= 30 ? 'd3' : min >= 15 ? 'd2' : 'd1') : '';
    cells += `<div class="cal-day ${ds === todayStr() ? 'today' : ''} ${ds === calSelDay ? 'sel' : ''}" data-day="${ds}" tabindex="0" role="button" aria-label="${ds}${min ? ', ' + min + ' minutes' : ''}"><span>${d}</span><span class="dot ${dot}"></span></div>`;
  }
  const monthName = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const list = state.sessions.slice().reverse().filter((s) => !calSelDay || s.date === calSelDay);
  p.innerHTML = `
    <div class="card">
      <div class="cal-head">
        <button class="btn small" id="cal-prev">‹</button>
        <div class="m">${monthName}</div>
        <button class="btn small" id="cal-next">›</button>
      </div>
      <div class="cal-grid">
        ${['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => `<div class="cal-dow">${d}</div>`).join('')}
        ${cells}
      </div>
      ${calSelDay ? `<div class="btn-row"><button class="btn small" id="cal-clear">Show all sessions</button></div>` : ''}
    </div>
    ${list.map((s) => `
      <div class="sess-card" data-sid="${s.id}">
        <div class="sess-head" tabindex="0" role="button" aria-expanded="false" onclick="toggleSess('${s.id}')">
          <div class="chevron">▶</div>
          <div class="d">${dateLabel(s.date)} ${s.feel ? `<span title="${FEELS[s.feel].l}">${FEELS[s.feel].i}</span>` : ''} ${s.planName ? `<span class="plan-chip">${esc(s.planName)}</span>` : ''}</div>
          <div class="m">${fmtMin(sessionMin(s))} · ${s.entries.length} practice${s.entries.length === 1 ? '' : 's'}</div>
        </div>
        <div class="sess-body">
          ${s.entries.map((e) => `
            <div class="entry-row">
              <div class="e-icon">${icons[(exFor(e.exId) || {}).icon] || icons.meditation || ''}</div>
              <div class="e-name">${esc(displayName(e.exId, e.varId))}</div>
              <input class="e-min-edit" type="number" min="1" max="600" value="${e.min}" aria-label="Minutes — ${esc(displayName(e.exId, e.varId))}" onchange="setEntryMin('${s.id}','${e.id}',this.value)">
              <button class="entry-x" onclick="delHistEntry('${s.id}','${e.id}')" aria-label="Remove">✕</button>
            </div>`).join('')}
          <div class="field-label">How did it feel?</div>
          <div class="feel-row">${[1, 2, 3, 4, 5].map((n) => `
            <button type="button" class="feel ${s.feel === n ? 'on' : ''}" aria-pressed="${s.feel === n}" onclick="setSessFeel('${s.id}',${n})">${FEELS[n].i}<span class="fl">${FEELS[n].l}</span></button>`).join('')}</div>
          <textarea class="session-note" placeholder="Session notes — what did you notice?" onchange="setSessNote('${s.id}',this.value)">${esc(s.notes || '')}</textarea>
          <div class="btn-row">
            <button class="btn accent small" onclick="repeatSession('${s.id}')">🔁 Practice this again</button>
            <button class="btn danger small" onclick="delSession('${s.id}')">Delete session</button>
          </div>
        </div>
      </div>`).join('') || '<div class="no-results">No sessions yet. Your history will appear here.</div>'}`;
  $('cal-prev').addEventListener('click', () => { calMonth = shiftMonth(calMonth, -1); renderHistory(); });
  $('cal-next').addEventListener('click', () => { calMonth = shiftMonth(calMonth, 1); renderHistory(); });
  const cc = $('cal-clear');
  if (cc) cc.addEventListener('click', () => { calSelDay = null; renderHistory(); });
  document.querySelectorAll('.cal-day[data-day]').forEach((c) => c.addEventListener('click', () => {
    calSelDay = calSelDay === c.dataset.day ? null : c.dataset.day;
    renderHistory();
  }));
}
function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}
function toggleSess(sid) { setExpanded(document.querySelector(`.sess-card[data-sid="${sid}"]`), '.sess-head'); }
/* a finished session stays editable: rate it, annotate it, or run it again */
function setSessFeel(sid, n) {
  const s = state.sessions.find((x) => x.id === sid);
  if (!s) return;
  s.feel = s.feel === n ? null : n;
  s.updatedAt = Date.now();
  saveState();
  renderHistory();
  toggleSess(sid); // re-open the card we just redrew
}
function setSessNote(sid, text) {
  const s = state.sessions.find((x) => x.id === sid);
  if (!s) return;
  s.notes = String(text == null ? '' : text).slice(0, 2000);
  s.updatedAt = Date.now();
  saveState();
}
function repeatSession(sid) {
  const s = state.sessions.find((x) => x.id === sid);
  if (!s || !s.entries.length) return;
  startPlanQueue(s.entries.map((e) => ({ exId: e.exId, varId: e.varId, min: e.min })), null, 'Repeat of ' + dateLabel(s.date));
}
/* deletions are undoable rather than confirmed: one tap to fix a mistake beats a
   dialog on every correct delete. Clear-all keeps its double confirmation. */
function delSession(sid) {
  const i = state.sessions.findIndex((s) => s.id === sid);
  if (i < 0) return;
  const gone = state.sessions.splice(i, 1)[0];
  saveState();
  renderAll();
  toast('Deleted ' + dateLabel(gone.date) + ' session', () => {
    state.sessions.splice(i, 0, gone);
    saveState();
    renderAll();
  });
}
function delHistEntry(sid, eid) {
  const s = state.sessions.find((x) => x.id === sid);
  if (!s) return;
  const i = s.entries.findIndex((e) => e.id === eid);
  if (i < 0) return;
  const gone = s.entries.splice(i, 1)[0];
  s.updatedAt = Date.now();
  const alsoDropped = !s.entries.length;
  if (alsoDropped) state.sessions = state.sessions.filter((x) => x.id !== sid);
  saveState();
  renderAll();
  toast('Removed ' + displayName(gone.exId, gone.varId), () => {
    s.entries.splice(i, 0, gone);
    if (alsoDropped) { state.sessions.push(s); sortSessions(); }
    saveState();
    renderAll();
  });
}

/* ==================================================================
   STATS
   ================================================================== */
function weekStart(d) {
  const x = new Date(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return todayStr(x);
}
/* a year of practice, one square per day. Columns are weeks starting Monday, so the
   grid is filled column-first (see .heat-grid) and the first column is a Monday. */
function heatmapHtml(days) {
  const start = new Date();
  start.setDate(start.getDate() - 363);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const today = todayStr();
  const cells = [], months = [];
  let lastMonth = -1;
  for (const d = new Date(start); todayStr(d) <= today; d.setDate(d.getDate() + 1)) {
    const ds = todayStr(d);
    const m = days[ds] || 0;
    const lvl = m >= 45 ? 4 : m >= 25 ? 3 : m >= 10 ? 2 : m > 0 ? 1 : 0;
    cells.push(`<div class="heat-cell${lvl ? ' h' + lvl : ''}${ds === today ? ' today' : ''}" title="${ds}${m ? ' · ' + fmtMin(m) : ' · rest'}"></div>`);
    if (d.getDay() === 1) {
      months.push(d.getMonth() !== lastMonth ? `<div>${d.toLocaleDateString(undefined, { month: 'short' })}</div>` : '<div></div>');
      lastMonth = d.getMonth();
    }
  }
  return `<div class="heat-wrap">
      <div class="heat-months">${months.join('')}</div>
      <div class="heat-grid">${cells.join('')}</div>
    </div>
    <div class="heat-legend">less ${[0, 1, 2, 3, 4].map((l) => `<span class="heat-cell${l ? ' h' + l : ''}"></span>`).join('')} more</div>`;
}
/* everything you've done with one practice: totals, and how it has come and gone */
function openExStats(exId) {
  const ex = exFor(exId);
  if (!ex) return;
  const h = exHistory(exId);
  const weeks = [];
  for (let i = 11; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i * 7); weeks.push({ key: weekStart(d), min: 0 }); }
  allSessions().forEach((s) => s.entries.forEach((e) => {
    if (e.exId !== exId) return;
    const w = weeks.find((x) => x.key === weekStart(new Date(s.date + 'T12:00:00')));
    if (w) w.min += e.min;
  }));
  const max = Math.max(1, ...weeks.map((w) => w.min));
  const W = 320, H = 90, bw = W / 12;
  const bars = weeks.map((w, i) => {
    const bh = (w.min / max) * (H - 12);
    return `<rect x="${(i * bw + 3).toFixed(1)}" y="${(H - bh).toFixed(1)}" width="${(bw - 6).toFixed(1)}" height="${bh.toFixed(1)}" rx="3" fill="#b48aff"/>`;
  }).join('');
  showOverlay(`
    <div class="overlay" id="xs-ov">
      <div class="sheet">
        <div class="sheet-head"><div class="t">${esc(ex.title)}</div><button class="btn small" id="xs-close" aria-label="Close">✕</button></div>
        <div class="sheet-body">
          ${h.n ? `
            <div class="tile-grid">
              <div class="tile"><div class="v">${h.n}</div><div class="l">times practised</div></div>
              <div class="tile"><div class="v">${fmtMin(h.min)}</div><div class="l">total</div></div>
              <div class="tile"><div class="v">${Math.round(h.min / h.n)}<span style="font-size:12px;color:#887a9a">m</span></div><div class="l">typical</div></div>
              <div class="tile"><div class="v" style="font-size:15px">${dateLabel(h.last)}</div><div class="l">last practised</div></div>
            </div>
            <h2 style="font-size:13px;margin:6px 0">Last 12 weeks</h2>
            <div class="chart-box"><svg viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="none" style="max-height:100px">${bars}</svg></div>
          ` : '<div class="no-results">You haven’t practised this yet.</div>'}
        </div>
        <div class="sheet-foot">
          <button class="btn accent" id="xs-practice">⏱ Practice</button>
          <button class="btn" id="xs-log">➕ Log</button>
        </div>
      </div>
    </div>`);
  $('xs-close').addEventListener('click', closeOverlay);
  $('xs-ov').addEventListener('click', (e) => { if (e.target.id === 'xs-ov') closeOverlay(); });
  $('xs-practice').addEventListener('click', () => { closeOverlay(); openLogSheet(exId, 'timer'); });
  $('xs-log').addEventListener('click', () => { closeOverlay(); openLogSheet(exId, 'log'); });
}
function renderStats() {
  const p = $('panel-stats');
  const days = dayTotals();
  const s = streaks();
  const totalMin = Object.values(days).reduce((a, b) => a + b, 0);
  const sessCount = state.sessions.length + (active && active.entries.length ? 1 : 0);
  const explored = new Set();
  allSessions().forEach((ss) => ss.entries.forEach((e) => explored.add(e.exId)));
  const thisWeek = Object.entries(days).filter(([ds]) => weekStart(new Date(ds + 'T12:00:00')) === weekStart(new Date())).reduce((t, [, m]) => t + m, 0);
  const feels = allSessions().map((ss) => ss.feel).filter((f) => f >= 1 && f <= 5);
  const avgFeel = feels.length ? feels.reduce((a, b) => a + b, 0) / feels.length : 0;

  // last 12 weeks bars
  const weeks = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i * 7);
    weeks.push({ key: weekStart(d), min: 0 });
  }
  Object.entries(days).forEach(([ds, m]) => {
    const wk = weekStart(new Date(ds + 'T12:00:00'));
    const w = weeks.find((x) => x.key === wk);
    if (w) w.min += m;
  });
  const maxWk = Math.max(state.goal.weeklyMin, ...weeks.map((w) => w.min), 1);
  const W = 320, H = 110, bw = W / 12;
  const goalY = H - (state.goal.weeklyMin / maxWk) * (H - 14);
  const bars = weeks.map((w, i) => {
    const h = (w.min / maxWk) * (H - 14);
    return `<rect x="${(i * bw + 3).toFixed(1)}" y="${(H - h).toFixed(1)}" width="${(bw - 6).toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${w.min >= state.goal.weeklyMin ? '#5fd068' : '#b48aff'}"/>` +
      (w.min ? `<text x="${(i * bw + bw / 2).toFixed(1)}" y="${(H - h - 3).toFixed(1)}" text-anchor="middle" font-size="8" fill="#887a9a">${w.min}</text>` : '');
  }).join('');

  // mega split
  const megaMin = {};
  allSessions().forEach((ss) => ss.entries.forEach((e) => {
    const ex = EX_BY_ID[e.exId];
    if (ex) megaMin[ex.mega] = (megaMin[ex.mega] || 0) + e.min;
  }));
  const megaMax = Math.max(1, ...Object.values(megaMin));

  // day-of-week
  const dow = [0, 0, 0, 0, 0, 0, 0];
  Object.entries(days).forEach(([ds, m]) => { dow[(new Date(ds + 'T12:00:00').getDay() + 6) % 7] += m; });
  const dowMax = Math.max(1, ...dow);

  // time of day — only sessions actually run in the app (backdated ones have no real clock)
  const TOD = ['Night', 'Early', 'Morning', 'Midday', 'Evening', 'Late'];
  const tod = [0, 0, 0, 0, 0, 0];
  allSessions().forEach((ss) => {
    if (!ss.endedAt || !ss.startedAt) return;
    tod[Math.floor(new Date(ss.startedAt).getHours() / 4)] += sessionMin(ss);
  });
  const todMax = Math.max(1, ...tod);

  // top techniques
  const perEx = {};
  allSessions().forEach((ss) => ss.entries.forEach((e) => { perEx[e.exId] = (perEx[e.exId] || 0) + e.min; }));
  const top = Object.entries(perEx).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const topMax = Math.max(1, ...(top.map((t) => t[1])));

  // milestones
  const hours = totalMin / 60;
  const mile = (label, icon, value, ladder, fmt) => {
    const next = ladder.find((l) => value < l);
    const done = ladder.filter((l) => value >= l);
    const prog = next ? Math.min(1, value / next) : 1;
    return `<div class="mile-row ${!next ? 'done' : ''}">
      <div class="icon">${icon}</div>
      <div class="info">
        <div class="n">${label}: ${done.length ? (fmt || ((x) => x))(done[done.length - 1]) + ' reached' : 'first target ' + (fmt || ((x) => x))(ladder[0])}</div>
        <div class="p">${next ? (fmt || ((x) => x))(value) + ' of ' + (fmt || ((x) => x))(next) + ' · ' + done.length + '/' + ladder.length + ' tiers' : 'All ' + ladder.length + ' tiers complete 🏆'}</div>
        <div class="mile-bar"><div class="f" style="width:${(prog * 100).toFixed(0)}%"></div></div>
      </div>
    </div>`;
  };
  const fmtH = (h) => (Math.round(h * 10) / 10) + 'h';
  const sessMins = allSessions().filter((ss) => ss.entries.length).map(sessionMin);
  const longest = sessMins.length ? fmtMin(Math.max(...sessMins)) : '–';
  const avgSess = sessMins.length ? fmtMin(Math.round(sessMins.reduce((a, b) => a + b, 0) / sessMins.length)) : '–';

  p.innerHTML = `
    <div class="tile-grid">
      <div class="tile hot"><div class="v">🔥 ${s.current}</div><div class="l">day streak</div></div>
      <div class="tile"><div class="v">${s.best}</div><div class="l">best streak</div></div>
      <div class="tile"><div class="v">${longest}</div><div class="l">longest sit</div></div>
      <div class="tile"><div class="v">${avgSess}</div><div class="l">avg session</div></div>
      <div class="tile"><div class="v">${fmtH(hours)}</div><div class="l">total practice</div></div>
      <div class="tile"><div class="v">${sessCount}</div><div class="l">sessions</div></div>
      <div class="tile"><div class="v">${explored.size}${HAS_CONTENT ? `<span style="font-size:12px;color:#887a9a">/${exercises.length}</span>` : ''}</div><div class="l">explored</div></div>
      <div class="tile"><div class="v">${thisWeek}<span style="font-size:12px;color:#887a9a">/${state.goal.weeklyMin}m</span></div><div class="l">this week</div></div>
      <div class="tile"><div class="v">${avgFeel ? FEELS[Math.round(avgFeel)].i + ' ' + avgFeel.toFixed(1) : '—'}</div><div class="l">avg feel</div></div>
    </div>
    <div class="card">
      <h2>Minutes per week <span class="muted">(goal ${state.goal.weeklyMin}m)</span></h2>
      <div class="chart-box"><svg viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="none" style="max-height:130px">
        ${bars}
        <line x1="0" x2="${W}" y1="${goalY.toFixed(1)}" y2="${goalY.toFixed(1)}" stroke="#5fd068" stroke-width="1" stroke-dasharray="4,3" opacity="0.7"/>
      </svg></div>
    </div>
    <div class="card">
      <h2>The last year</h2>
      ${heatmapHtml(days)}
    </div>
    <div class="card">
      <h2>Practice by category</h2>
      ${Object.entries(megaMin).sort((a, b) => b[1] - a[1]).map(([m, v]) => `
        <div class="hbar-row"><div class="hl">${MEGA_LABELS[m] || m}</div><div class="hbar-track"><div class="hbar-fill" style="width:${(v / megaMax * 100).toFixed(0)}%;background:${megaColor(m)}"></div></div><div class="hv">${fmtMin(v)}</div></div>`).join('') || '<div class="muted">Log a session to see your split.</div>'}
    </div>
    <div class="card">
      <h2>Day of week</h2>
      ${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => `
        <div class="hbar-row"><div class="hl">${d}</div><div class="hbar-track"><div class="hbar-fill" style="width:${(dow[i] / dowMax * 100).toFixed(0)}%"></div></div><div class="hv">${dow[i] ? fmtMin(dow[i]) : ''}</div></div>`).join('')}
    </div>
    <div class="card">
      <h2>Time of day</h2>
      ${tod.some((v) => v) ? TOD.map((label, i) => `
        <div class="hbar-row"><div class="hl">${label} ${i * 4}–${i * 4 + 4}</div><div class="hbar-track"><div class="hbar-fill" style="width:${(tod[i] / todMax * 100).toFixed(0)}%"></div></div><div class="hv">${tod[i] ? fmtMin(tod[i]) : ''}</div></div>`).join('')
        : '<div class="muted">Run a session in the app to see when you practise.</div>'}
    </div>
    <div class="card">
      <h2>Most practiced <span class="muted">— tap for detail</span></h2>
      ${top.map(([id, v]) => `
        <div class="hbar-row tap" tabindex="0" role="button" onclick="openExStats('${id}')"><div class="hl">${esc(displayName(id, null))}</div><div class="hbar-track"><div class="hbar-fill" style="width:${(v / topMax * 100).toFixed(0)}%"></div></div><div class="hv">${fmtMin(v)}</div></div>`).join('') || '<div class="muted">Nothing logged yet.</div>'}
    </div>
    <div class="card">
      <h2>🏅 The Hunter’s Path</h2>
      ${mile('Hours of practice', '⏳', hours, [1, 3, 10, 31.5, 100, 315], fmtH)}
      ${mile('Longest streak', '🔥', s.best, [3, 7, 21, 54, 108], (x) => x + 'd')}
      ${mile('Sessions', '🧘', sessCount, [10, 31, 108, 315])}
      ${HAS_CONTENT ? mile('Techniques explored', '🧭', explored.size, [10, 31, 81, exercises.length]) : ''}
    </div>`;
  // a year is wider than a phone: open on the recent end, which is the end you care about
  const hw = p.querySelector('.heat-wrap');
  if (hw) hw.scrollLeft = hw.scrollWidth;
}

/* ==================================================================
   SETTINGS
   ================================================================== */
function renderSettings() {
  const p = $('panel-settings');
  p.innerHTML = `
    <div class="card">
      <h2>🔔 Sound & cues</h2>
      <div class="set-row">
        <div class="sl">Bell<br><span class="d">Chime at timer start, end, and step changes</span></div>
        <label class="switch"><input type="checkbox" id="set-bell" ${state.sound.bell ? 'checked' : ''}><span class="sl-track"></span></label>
      </div>
      <div class="set-row">
        <div class="sl">Volume</div>
        <input type="range" id="set-vol" min="0.05" max="1" step="0.05" value="${state.sound.volume}">
        <button class="btn small" id="set-test">Test</button>
      </div>
      <div class="set-row">
        <div class="sl">Interval bell<br><span class="d">Soft chime every N minutes during a timer</span></div>
        <select class="mini" id="set-interval">
          ${[0, 1, 2, 5, 10].map((n) => `<option value="${n}" ${state.sound.intervalMin === n ? 'selected' : ''}>${n === 0 ? 'Off' : 'Every ' + n + 'm'}</option>`).join('')}
        </select>
      </div>
      <div class="set-row">
        <div class="sl">Step cue<br><span class="d">A short tone when the timer moves to the next atomic step</span></div>
        <label class="switch"><input type="checkbox" id="set-stepcue" ${state.sound.stepCue ? 'checked' : ''}><span class="sl-track"></span></label>
      </div>
      <div class="set-row">
        <div class="sl">Settling-in countdown<br><span class="d">Quiet seconds before the opening bell</span></div>
        <select class="mini" id="set-prep">
          ${[0, 5, 10, 15, 30, 60].map((n) => `<option value="${n}" ${state.sound.prepSec === n ? 'selected' : ''}>${n === 0 ? 'Off' : n + 's'}</option>`).join('')}
        </select>
      </div>
      <div class="set-row">
        <div class="sl">Closing bell<br><span class="d">How many times it sounds when the sit ends</span></div>
        <select class="mini" id="set-endbells">
          ${[1, 2, 3].map((n) => `<option value="${n}" ${state.sound.endBells === n ? 'selected' : ''}>${n}×</option>`).join('')}
        </select>
      </div>
      <div class="set-row">
        <div class="sl">Vibrate<br><span class="d">Buzz with each bell — works with the sound off, for a silent sit</span></div>
        <label class="switch"><input type="checkbox" id="set-haptics" ${state.sound.haptics ? 'checked' : ''}><span class="sl-track"></span></label>
      </div>
    </div>
    <div class="card">
      <h2>🧍 Practice avatar</h2>
      <div class="set-row">
        <div class="sl">Show a 3D figure in the timer<br><span class="d">A stick figure performs the practice while you time it. Drag it to turn.</span></div>
        <label class="switch"><input type="checkbox" id="set-avatar" ${state.avatar ? 'checked' : ''}><span class="sl-track"></span></label>
      </div>
      <div class="avatar-box preview" id="av-preview" title="Drag to turn"></div>
      <div class="muted">${AV_REDUCED ? 'Your system asks for reduced motion, so the figure holds a still pose.' : 'Motions come from the content pack; practices without one breathe in a neutral pose.'}</div>
    </div>
    <div class="card">
      <h2>🎯 Goal</h2>
      <div class="set-row">
        <div class="sl">Weekly minutes target</div>
        <input class="mini" type="number" id="set-goal" min="10" max="2000" step="10" value="${state.goal.weeklyMin}" style="width:80px">
      </div>
    </div>
    <div class="card">
      <h2>⏰ Daily reminder</h2>
      <div class="set-row">
        <div class="sl">Calendar reminder<br><span class="d">Saves a repeating daily event that opens the app. No notifications to grant, no server.</span></div>
        <input class="mini" type="time" id="set-rem-time" value="${esc(state.reminder.time || '07:00')}" aria-label="Reminder time">
        <button class="btn small" id="set-rem-ics">📅 Add</button>
      </div>
      ${'setAppBadge' in navigator ? `<div class="set-row">
        <div class="sl">Badge until today’s sit<br><span class="d">A dot on the installed app icon until something is logged today</span></div>
        <label class="switch"><input type="checkbox" id="set-badge" ${state.reminder.badge ? 'checked' : ''}><span class="sl-track"></span></label>
      </div>` : ''}
    </div>
    <div class="card">
      <h2>🔤 Font</h2>
      <div class="set-row">
        <div class="sl">Reading font<br><span class="d">Atkinson Hyperlegible by default. The choice is shared by every app on this site.</span></div>
        ${window.appFont ? `<select class="mini" id="set-font" aria-label="Reading font">${window.appFont.options.map((o) => `<option value="${o.id}" ${window.appFont.get() === o.id ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`
          : '<span class="muted">Available on the hosted copy</span>'}
      </div>
    </div>
    <div class="card">
      <h2>💾 Data</h2>
      <div class="btn-row">
        <button class="btn" id="set-export">⬇ Export JSON</button>
        <button class="btn" id="set-import">⬆ Import JSON</button>
        <button class="btn" id="set-csv">⬇ Export CSV</button>
        <button class="btn" id="set-copy">📋 Copy summary</button>
        ${navigator.share ? '<button class="btn" id="set-share">📤 Share summary</button>' : ''}
        <button class="btn" id="set-reseed">🌱 Re-seed plans</button>
        <button class="btn danger" id="set-clear">🗑 Clear all data</button>
      </div>
      <input type="file" id="set-import-file" accept=".json,application/json" style="display:none">
      <div class="muted" style="margin-top:8px">Everything lives in this browser’s localStorage. Export regularly — the JSON file is your backup.</div>
    </div>
    ${driveSettingsHtml()}
    <div class="card">
      <h2>🤝 Practice coach</h2>
      <div class="muted">Share your own log with an AI agent through a folder on this device, and read its note here. Nothing leaves the device unless you sync that folder yourself. Replies wait for your review by default.</div>
      <div class="coach-reply" id="coach-reply" ${getCoachReply() ? '' : 'hidden'}>${esc(getCoachReply())}</div>
      <div id="coach-slot"></div>
    </div>
    <div class="card">
      <h2>ℹ️ About</h2>
      <div class="about-block">
        <strong>🏹 InsightHunter</strong> · ${APP_BUILD}<br>
        A single-file practice tracker for meditation, yoga, breathwork & mind-body work —
        a sibling of <strong>GymTracker315</strong>.<br><br>
        <strong>Content pack:</strong> ${HAS_CONTENT
          ? `loaded — ${exercises.length} practices, ${exercises.reduce((n, ex) => n + ((ex.variations || []).length), 0)} variations, ${glossary.length} glossary terms.`
          : 'none loaded. The app runs standalone; drop a <code>content-pack.js</code> beside it to add a practice library and glossary.'}<br><br>
        ${HAS_CONTENT ? `<strong>Educational only.</strong> This app is a personal practice log built by a software developer —
        not a doctor, physiotherapist, or meditation teacher. Its steps, cues, and dosages are educational and
        may not be right for you; several traditions represented here are normally learned with an experienced
        teacher. Move gently, never force a stretch or a breath hold, and stop on pain, dizziness, or distress.
        Consult a qualified professional where appropriate — you use this app entirely at your own risk.<br><br>` : ''}
        <strong>Privacy:</strong> no account, no servers, no analytics. Your data never leaves your device
        unless you export it.
      </div>
    </div>`;
  $('set-bell').addEventListener('change', (e) => { state.sound.bell = e.target.checked; saveState(); });
  $('set-avatar').addEventListener('change', (e) => { state.avatar = e.target.checked; saveState(); renderSettings(); });
  if (state.avatar) AV.mount($('av-preview'), { clip: AV_CLIPS_BUILTIN.seated });
  else $('av-preview').style.display = 'none';
  $('set-vol').addEventListener('change', (e) => { state.sound.volume = +e.target.value; saveState(); });
  $('set-test').addEventListener('click', () => { const was = state.sound.bell; state.sound.bell = true; bell(1); state.sound.bell = was; });
  $('set-interval').addEventListener('change', (e) => { state.sound.intervalMin = +e.target.value; saveState(); });
  $('set-stepcue').addEventListener('change', (e) => { state.sound.stepCue = e.target.checked; saveState(); if (e.target.checked) bell(1, true); });
  $('set-prep').addEventListener('change', (e) => { state.sound.prepSec = +e.target.value; saveState(); });
  $('set-endbells').addEventListener('change', (e) => { state.sound.endBells = +e.target.value; saveState(); });
  $('set-haptics').addEventListener('change', (e) => { state.sound.haptics = e.target.checked; saveState(); if (e.target.checked && navigator.vibrate) navigator.vibrate(180); });
  $('set-goal').addEventListener('change', (e) => { state.goal.weeklyMin = Math.max(10, Math.min(2000, +e.target.value || 90)); saveState(); });
  $('set-rem-time').addEventListener('change', (e) => { state.reminder.time = e.target.value; saveState(); });
  $('set-rem-ics').addEventListener('click', () => { state.reminder.time = $('set-rem-time').value || '07:00'; saveState(); downloadBlob('insight-hunter-reminder.ics', reminderIcs(), 'text/calendar'); toast('Reminder saved — open it to add it to your calendar'); });
  const fontSel = $('set-font');
  if (fontSel) fontSel.addEventListener('change', (e) => window.appFont.set(e.target.value));
  const badge = $('set-badge');
  if (badge) badge.addEventListener('change', (e) => { state.reminder.badge = e.target.checked; saveState(); updateBadge(); });
  $('set-csv').addEventListener('click', () => { downloadBlob('insight-hunter-' + todayStr() + '.csv', csvText(), 'text/csv'); toast('CSV exported'); });
  const share = $('set-share');
  if (share) share.addEventListener('click', () => navigator.share({ title: 'InsightHunter', text: summaryText() }).catch(() => {}));
  $('set-export').addEventListener('click', exportJson);
  $('set-import').addEventListener('click', () => $('set-import-file').click());
  $('set-import-file').addEventListener('change', importJson);
  bindDriveSettings();
  mountCoach($('coach-slot'));
  $('set-copy').addEventListener('click', copySummary);
  $('set-reseed').addEventListener('click', () => { state.seededPlanIds = []; state.plans = state.plans.filter((pl) => !pl.seeded); seedPlans(); toast('Seed plans restored'); });
  $('set-clear').addEventListener('click', clearAll);
}
function downloadBlob(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: type || 'application/json' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
function backupPayload() {
  return JSON.stringify({ app: 'InsightHunter', version: 1, savedAt: Date.now(), state: state }, null, 1);
}
/* One row per logged practice, for spreadsheets. */
function csvText() {
  const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const rows = [['date', 'session_start', 'practice', 'variation', 'minutes', 'feel', 'plan', 'notes']];
  allSessions().slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)).forEach((s) => s.entries.forEach((e) => {
    const ex = exFor(e.exId), v = getVar(e.exId, e.varId);
    rows.push([s.date, s.startedAt ? new Date(s.startedAt).toISOString() : '', ex ? ex.title : e.exId, v ? v.title : '', e.min, s.feel || '', s.planName || '', s.notes || '']);
  }));
  return rows.map((r) => r.map(q).join(',')).join('\r\n');
}
/* A repeating calendar event is the one daily reminder that needs no permission and no server.
   Floating local time on purpose: 7:00 means 7:00 wherever you wake up. */
function reminderIcs() {
  const hhmm = (state.reminder.time || '07:00').replace(':', '') + '00';
  const url = location.href.split(/[?#]/)[0];
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//InsightHunter//EN', 'BEGIN:VEVENT',
    'UID:insight-hunter-daily-' + hhmm + '@insight-hunter', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z',
    'DTSTART:' + todayStr().replace(/-/g, '') + 'T' + hhmm, 'DURATION:PT15M', 'RRULE:FREQ=DAILY',
    'SUMMARY:Sit — InsightHunter', 'DESCRIPTION:Your daily practice. Open the app: ' + url, 'URL:' + url,
    'BEGIN:VALARM', 'TRIGGER:PT0M', 'ACTION:DISPLAY', 'DESCRIPTION:Time to sit', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
}
function updateBadge() {
  if (!('setAppBadge' in navigator)) return;
  const due = state.reminder.badge && !dayTotals()[todayStr()];
  try { (due ? navigator.setAppBadge(1) : navigator.clearAppBadge()).catch(() => {}); } catch (e) { /* not installed */ }
}
function exportJson() {
  state.lastExportAt = Date.now();
  state.backupNudgedAt = 0;
  saveState();
  downloadBlob('insight-hunter-backup-' + todayStr() + '.json', backupPayload());
  toast('Backup exported');
}
async function importJson(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  let obj;
  try { obj = JSON.parse(await file.text()); } catch (err) { toast('Not a valid JSON file'); return; }
  await applyBackup(obj, 'Import backup');
}
/* one restore path for a file on disk and a file in Drive */
async function applyBackup(obj, title) {
  const imp = obj && obj.app === 'InsightHunter' ? obj.state : (obj && Array.isArray(obj.sessions) ? obj : null);
  if (!imp) { toast('Not an InsightHunter backup'); return false; }
  const mode = await choiceDialog({
    title: title,
    msg: (imp.sessions || []).length + ' sessions · ' + (imp.plans || []).length + ' plans found.\n\nMerge keeps everything from both (imported wins on conflicts). Overwrite replaces all current data.',
    buttons: [{ label: 'Merge', value: 'merge', kind: 'primary' }, { label: 'Overwrite', value: 'overwrite', kind: 'danger' }, { label: 'Cancel', value: null }],
  });
  if (!mode) return false;
  if (mode === 'overwrite') {
    // the OAuth client id is device config, not user data — never lose it to a restore
    const keepCid = (state.sync && state.sync.driveClientId) || '';
    state = { ...defaultState(), ...imp };
    state.sync = { ...defaultState().sync, ...(imp.sync || {}) };
    if (!state.sync.driveClientId) state.sync.driveClientId = keepCid;
  } else {
    const byId = (arr) => { const m = {}; (arr || []).forEach((x) => { m[x.id] = x; }); return m; };
    const mergeArr = (cur, inc) => {
      const m = byId(cur);
      (inc || []).forEach((x) => {
        const ex = m[x.id];
        if (!ex || (x.updatedAt || 0) >= (ex.updatedAt || 0)) m[x.id] = x;
      });
      return Object.values(m);
    };
    state.sessions = mergeArr(state.sessions, imp.sessions).sort((a, b) => a.date < b.date ? -1 : 1);
    state.plans = mergeArr(state.plans, imp.plans);
    state.seededPlanIds = Array.from(new Set([...(state.seededPlanIds || []), ...(imp.seededPlanIds || [])]));
    state.favorites = { ...(imp.favorites || {}), ...state.favorites };
  }
  saveState();
  renderAll();
  renderLibrary();
  toast(title + ' complete (' + mode + ')');
  return true;
}
function summaryText() {
  const days = dayTotals();
  const s = streaks();
  const totalMin = Object.values(days).reduce((a, b) => a + b, 0);
  const recent = Object.entries(days).sort((a, b) => b[0] < a[0] ? -1 : 1).slice(0, 14);
  const feels = state.sessions.map((x) => x.feel).filter((f) => f >= 1 && f <= 5);
  const lines = [
    'InsightHunter practice summary — ' + todayStr(),
    'Total: ' + fmtMin(totalMin) + ' across ' + state.sessions.length + ' sessions · streak ' + s.current + 'd (best ' + s.best + 'd)',
    feels.length ? 'Average feel: ' + (feels.reduce((a, b) => a + b, 0) / feels.length).toFixed(1) + '/5 over ' + feels.length + ' rated sessions' : '',
    '',
    'Last 14 practiced days:',
    ...recent.map(([d, m]) => '  ' + d + '  ' + fmtMin(m)),
  ];
  return lines.join('\n');
}
function copySummary() {
  const text = summaryText();
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => toast('Summary copied'), () => toast('Copy failed'));
  else {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('Summary copied'); } catch (e) { toast('Copy failed'); }
    ta.remove();
  }
}
const appKeys = () => [STORAGE_KEY, PENDING_KEY, TAB_KEY, TIMER_KEY, LIBVIEW_KEY, LIBSORT_KEY, COACH_KEY, COWORK_STATE_KEY];
async function clearAll() {
  const a = await choiceDialog({ title: 'Clear all data?', msg: 'Sessions, plans, favorites and settings will be erased from this device. Your other apps on this site keep their data, and any Google Drive backup is not touched.', buttons: [{ label: 'Continue', value: true, kind: 'danger' }, { label: 'Cancel', value: false }] });
  if (!a) return;
  const b = await choiceDialog({ title: 'Really erase everything?', msg: 'This cannot be undone. Export a backup first if in doubt.', buttons: [{ label: 'Erase it all', value: true, kind: 'danger' }, { label: 'Cancel', value: false }] });
  if (!b) return;
  // Only this app's own keys: every app shares this origin, so never wipe the whole store.
  appKeys().forEach((k) => localStorage.removeItem(k));
  T = null;
  state = defaultState();
  active = null;
  seedPlans();
  renderAll();
  renderLibrary();
  toast('All data cleared — Drive backup untouched');
}

/* ==================================================================
   COWORK — the practice coach, through the maker's shared panel
   (https://adervec.github.io/cowork.js, folder mode). It writes request files into a folder you
   choose on this device and reads the reply an agent leaves there; nothing goes over the network.
   Only your own log is sent: dates, minutes, practice names, feel and notes. Never the library's
   steps or cues.
   ================================================================== */
const COACH_KEY = 'ih_coach_reply';
const COWORK_STATE_KEY = 'cowork-state:insightmaster'; // the engine's own per-app state
function loadCowork() {
  if (window.cowork) return Promise.resolve(window.cowork);
  return new Promise((res) => {
    try {
      const s = document.createElement('script');
      s.src = 'https://adervec.github.io/cowork.js'; s.async = true;
      s.onload = () => res(window.cowork || null); s.onerror = () => res(null);
      document.head.appendChild(s);
    } catch (e) { res(null); }
  });
}
// djb2, as the cowork protocol and the sibling apps use it
function coworkHash(text) { let h = 5381; for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0; return h.toString(16); }
const COWORK_MANIFEST = { protocol: 'cowork-manifest', protocolVersion: 1, app: 'insightmaster', channels: [
  { name: 'coach', request: ['coach/request.json'], instructions: 'coach/INSTRUCTIONS.md', replyPath: 'coach/reply.json' }] };
function coachPayload() {
  const s = streaks(), days = dayTotals();
  const recent = allSessions().filter((x) => x.entries.length).slice(-40).map((x) => ({
    date: x.date, minutes: sessionMin(x), feel: x.feel || null, notes: x.notes || '', plan: x.planName || null,
    practices: x.entries.map((e) => ({ name: displayName(e.exId, e.varId), minutes: e.min })),
  }));
  const week = Object.entries(days).filter(([d]) => weekStart(new Date(d + 'T12:00:00')) === weekStart(new Date())).reduce((t, [, m]) => t + m, 0);
  return {
    today: todayStr(), streak: s.current, bestStreak: s.best, weeklyGoalMin: state.goal.weeklyMin, thisWeekMin: week,
    totalMin: Object.values(days).reduce((a, b) => a + b, 0), recentSessions: recent,
    plans: state.plans.map((p) => ({ name: p.name, steps: p.steps.map((st) => ({ name: displayName(st.exId, st.varId), minutes: st.min })) })),
  };
}
const COACH_INSTRUCTIONS = [
  '# InsightMaster — practice coach channel', '',
  'Read `coach/request.json`. `payload` is the practitioner\'s own log: streak and best streak, the weekly',
  'goal and minutes so far this week, the last 40 sessions (date, minutes, how it felt 1-5, notes, the',
  'practices done) and their saved plans.', '',
  'Write `coach/reply.json`:', '', '```json',
  '{ "requestHash": "<copy the request\'s requestHash verbatim>",',
  '  "reply": "<a short practice note in plain text or light markdown: one pattern you notice in their log, a realistic plan for the coming week that fits their goal, and one thing they are doing well. Warm, specific, never pushy. Do not prescribe breath holds, fasting or anything risky; suggest a teacher for anything advanced.>" }',
  '```', '',
  'If you cannot do the job, write `coach/error.json` with `{ "requestHash": "…", "error": "why" }` instead.', '',
].join('\n');
function coachFiles() {
  const payload = coachPayload();
  return {
    'coach/request.json': { protocol: 'insightmaster-coach', protocolVersion: 1, kind: 'request', generatedAt: new Date().toISOString(),
      requestHash: coworkHash(JSON.stringify(payload)), payload },
    'coach/INSTRUCTIONS.md': COACH_INSTRUCTIONS,
  };
}
function coachReplyText(r) {
  return typeof r === 'string' ? r : (r && (r.reply || (r.payload && r.payload.reply))) || JSON.stringify(r, null, 2);
}
function getCoachReply() { try { return localStorage.getItem(COACH_KEY) || ''; } catch (e) { return ''; } }
function setCoachReply(text) {
  try { if (text) localStorage.setItem(COACH_KEY, text); else localStorage.removeItem(COACH_KEY); } catch (e) { /* quota */ }
  const out = $('coach-reply');
  if (out) { out.textContent = text; out.hidden = !text; }
}
const COACH_CHANNEL = {
  label: 'Practice coach',
  preview: (r) => [{ id: 'reply', label: 'Show this advice in Settings (replaces the current note)', detail: coachReplyText(r).slice(0, 600) }],
  apply: (r) => { const prev = getCoachReply(); setCoachReply(coachReplyText(r)); return { summary: 'new coach note shown', undo: { prev } }; },
  undo: (d) => setCoachReply((d && d.prev) || ''),
};
function coachBrief() {
  const p = coachPayload();
  const last = p.recentSessions.slice(-7).reverse().map((x) => '- ' + x.date + ': ' + fmtMin(x.minutes) + (x.feel ? ' · felt ' + x.feel + '/5' : ''));
  return {
    markdown: '# InsightMaster brief\n\nStreak ' + p.streak + ' days (best ' + p.bestStreak + '). This week ' + p.thisWeekMin + ' of ' + p.weeklyGoalMin + ' min.\n\n## Last sessions\n\n' + (last.join('\n') || '- (none yet)') + '\n',
    data: { app: 'insightmaster', generatedAt: new Date().toISOString(), streak: p.streak, bestStreak: p.bestStreak, thisWeekMin: p.thisWeekMin, weeklyGoalMin: p.weeklyGoalMin },
  };
}
// The panel lives in one host element that survives Settings re-renders, so it mounts once.
let _coachHost = null;
function mountCoach(slot) {
  if (!slot) return;
  if (!_coachHost) {
    _coachHost = document.createElement('div');
    _coachHost.id = 'coach-host';
    loadCowork().then((cw) => {
      if (!cw) { _coachHost.textContent = 'The cowork panel loads on the hosted copy, when online.'; return; }
      cw.mount(_coachHost, {
        app: 'insightmaster', manifest: COWORK_MANIFEST, files: coachFiles,
        apply: (_ch, r) => COACH_CHANNEL.apply(r), // v1 fallback
        channels: { coach: COACH_CHANNEL },
        brief: coachBrief,
      });
    });
  }
  slot.appendChild(_coachHost);
}

/* ==================================================================
   GLOSSARY (ported from the guide)
   ================================================================== */
let glossSearch = '';
let glossCat = 'all';
function renderGlossCats() {
  const el = $('gloss-cat-filter');
  el.innerHTML = glossaryCategories.map((c) => `<div class="gloss-cat-pill ${c.id === glossCat ? 'active' : ''}" data-cat="${c.id}" tabindex="0" role="button" aria-pressed="${c.id === glossCat}">${c.label}</div>`).join('');
  el.querySelectorAll('.gloss-cat-pill').forEach((p) => {
    p.addEventListener('click', () => { glossCat = p.dataset.cat; renderGlossCats(); renderGlossary(); });
  });
}
function renderGlossary() {
  const body = $('gloss-body');
  const q = glossSearch.toLowerCase();
  const filtered = glossary.filter((g) => {
    if (glossCat !== 'all' && g.cat !== glossCat) return false;
    if (!q) return true;
    return g.term.toLowerCase().includes(q) || (g.aka && g.aka.toLowerCase().includes(q)) || g.def.toLowerCase().includes(q);
  });
  filtered.sort((a, b) => a.term.toLowerCase().localeCompare(b.term.toLowerCase()));
  if (filtered.length === 0) {
    body.innerHTML = glossary.length
      ? '<div class="gloss-no-results">No terms match. Try a different search or category.</div>'
      : '<div class="gloss-no-results">No content pack loaded — the glossary lives in <code>content-pack.js</code>.</div>';
    return;
  }
  const groups = {};
  filtered.forEach((g) => {
    const letter = g.term.charAt(0).toUpperCase();
    const key = /[0-9]/.test(letter) ? '#' : letter;
    (groups[key] = groups[key] || []).push(g);
  });
  const letters = Object.keys(groups).sort((a, b) => (a === '#' ? -1 : b === '#' ? 1 : a.localeCompare(b)));
  const catLabels = {}; // glossary category vocabulary also comes from the pack
  glossaryCategories.forEach((c) => { catLabels[c.id] = c.label; });
  body.innerHTML = `<div class="gloss-count">${filtered.length} term${filtered.length === 1 ? '' : 's'}</div>` +
    letters.map((L) => `
      <div class="gloss-letter-header">${L}</div>
      ${groups[L].map((g) => `
        <div class="gloss-entry">
          <div class="gloss-term-row">
            <span class="gloss-term">${g.term}</span>
            ${g.aka ? `<span class="gloss-aka">${g.aka}</span>` : ''}
            <span class="gloss-cat-badge ${g.cat}">${catLabels[g.cat] || g.cat}</span>
          </div>
          <div class="gloss-def">${g.def}</div>
        </div>`).join('')}
    `).join('');
}
function openGloss() {
  $('gloss-panel').classList.add('open');
  $('gloss-backdrop').classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => $('gloss-search').focus(), 350);
}
function closeGloss() {
  $('gloss-panel').classList.remove('open');
  $('gloss-backdrop').classList.remove('open');
  document.body.style.overflow = '';
}

/* ==================================================================
   BOOT
   ================================================================== */
function boot() {
  $('build-stamp').textContent = APP_BUILD;
  seedPlans();

  const tabs = [...document.querySelectorAll('#tabbar .tab')];
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => switchTab(t.dataset.tab));
    t.addEventListener('keydown', (e) => { // the tablist pattern: arrows move between tabs
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      const next = tabs[(i + d + tabs.length) % tabs.length];
      next.focus();
      switchTab(next.dataset.tab);
    });
  });

  // library bindings
  $('search').addEventListener('input', (e) => { currentSearch = e.target.value.trim().toLowerCase(); renderLibrary(); });
  $('search').addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.target.value = ''; currentSearch = ''; renderLibrary(); } });
  $('clear-btn').addEventListener('click', () => { $('search').value = ''; currentSearch = ''; renderLibrary(); $('search').focus(); });
  $('lib-sort').value = libSort;
  $('lib-sort').addEventListener('change', (e) => { libSort = e.target.value; localStorage.setItem(LIBSORT_KEY, libSort); renderLibrary(); });
  $('lib-random').addEventListener('click', randomPractice);
  renderMegaFilter();
  renderSubFilters();
  renderLibrary();

  // glossary bindings
  $('gloss-btn').addEventListener('click', openGloss);
  $('gloss-close').addEventListener('click', closeGloss);
  $('gloss-backdrop').addEventListener('click', closeGloss);
  $('gloss-search').addEventListener('input', (e) => { glossSearch = e.target.value.trim(); renderGlossary(); });
  $('gloss-clear').addEventListener('click', () => { $('gloss-search').value = ''; glossSearch = ''; renderGlossary(); $('gloss-search').focus(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('gloss-panel').classList.contains('open')) closeGloss(); });
  renderGlossCats();
  renderGlossary();

  // PWA shortcut targets. Closed whitelist — this value comes straight off the URL.
  const go = new URLSearchParams(location.search).get('go');
  if (go === 'session') { currentTab = 'practice'; if (!active) startSession(); }
  else if (go === 'library' || go === 'plans' || go === 'history' || go === 'stats') currentTab = go;

  switchTab(currentTab);
  renderStreakChip();
  resumeTimer(); // offer to pick up a timer the browser interrupted
  // reuse an existing Drive grant so auto-backup can fire; never pops a sign-in
  if (state.sync.auto && driveClientId()) driveConnect({ silent: true }).catch(() => {});

  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* ask the browser not to evict years of history */ }
  if (location.protocol.startsWith('http') && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then((reg) => {
      // a new build installed behind the running one: offer the reload instead of waiting for the next launch
      const offer = () => toast('Update ready', () => { if (reg.waiting) reg.waiting.postMessage('skipWaiting'); location.reload(); }, 'Reload');
      if (reg.waiting && navigator.serviceWorker.controller) offer();
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        if (w) w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) offer(); });
      });
      let lastCheck = 0; // an installed app left open for days still finds new builds
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && Date.now() - lastCheck > 60000) { lastCheck = Date.now(); reg.update().catch(() => {}); }
      });
    }).catch(() => {});
  }
}
boot();
