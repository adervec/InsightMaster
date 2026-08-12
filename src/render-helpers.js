/* Badge and body-position rendering. Pure presentation over whatever the content pack
   supplies: no practice names, no taxonomy, no vocabulary of its own. A pack that rates
   nothing still renders — every lookup has a neutral fallback. */

/* ---------- importance (practice level, 1-5) ---------- */
function getImportance(id, mega) {
  const v = importanceMap[id];
  if (v >= 1 && v <= 5) return v;
  const d = importanceDefaults[mega];
  return d >= 1 && d <= 5 ? d : 3;
}
function importanceBadge(id, mega) {
  const score = getImportance(id, mega);
  const labels = { 5: 'Essential', 4: 'Important', 3: 'Useful', 2: 'Optional', 1: 'Niche' };
  const stars = '★'.repeat(score) + '☆'.repeat(5 - score);
  return `<span class="importance t${score}" title="${labels[score]}"><span class="importance-stars">${stars}</span></span>`;
}

/* ---------- difficulty (variation level) ---------- */
function getDifficulty(varId) {
  const d = difficultyOverrides[varId];
  return d === 'beg' || d === 'int' || d === 'adv' || d === 'exp' ? d : 'int';
}
function difficultyBadge(varId) {
  const diff = getDifficulty(varId);
  const labels = { beg: 'Beginner', int: 'Intermediate', adv: 'Advanced', exp: 'Expert' };
  return `<span class="difficulty ${diff}" title="${labels[diff]}">${labels[diff]}</span>`;
}

/* ---------- how far off the beaten track a practice is (1-5) ----------
   1 = found in any class or app, 5 = deep in a specific tradition. Packs that don't
   care can omit it entirely and everything reads as 1. */
function getEsoteric(id, mega) {
  const v = esotericMap[id];
  if (v >= 1 && v <= 5) return v;
  const d = esotericDefaults[mega];
  return d >= 1 && d <= 5 ? d : 1;
}
function esotericBadge(id, mega) {
  const score = getEsoteric(id, mega);
  const labels = { 1: 'Mainstream', 2: 'Common', 3: 'Specialized', 4: 'Obscure', 5: 'Hermetic' };
  const glyphs = { 1: '◯', 2: '◐', 3: '◉', 4: '❂', 5: '◈' };
  return `<span class="esoteric e${score}" title="${labels[score]}"><span class="esoteric-glyph">${glyphs[score]}</span>${labels[score]}</span>`;
}

/* ---------- body position & props table ----------
   A variation's own position overlays the family's defaults, field by field. */
function getPosition(variation, parentId) {
  const defaults = positionDefaults[parentId] || null;
  if (!variation || !variation.position) return defaults;
  if (!defaults) return variation.position;
  return {
    body: { ...(defaults.body || {}), ...(variation.position.body || {}) },
    equipment: { ...(defaults.equipment || {}), ...(variation.position.equipment || {}) },
  };
}
function renderPosition(uid, position) {
  if (!position) return '';
  const rows = (obj, labels) => Object.entries(obj || {}).map(([k, v]) =>
    `<div class="position-row"><div class="pos-label">${labels[k] || k.charAt(0).toUpperCase() + k.slice(1)}</div><div class="pos-val">${v}</div></div>`);
  const bodyRows = rows(position.body, bodyLabels);
  const equipRows = rows(position.equipment, equipLabels);
  if (!bodyRows.length && !equipRows.length) return '';
  return `<div class="position-wrap" data-pid="${uid}">
    <div class="position-toggle" tabindex="0" role="button" aria-expanded="false" onclick="togglePos('${uid}')"><span>📐 Body Position &amp; Props</span><span class="pos-chev">▶</span></div>
    <div class="position-table">
      ${bodyRows.length ? `<div class="position-section-title">Body</div>${bodyRows.join('')}` : ''}
      ${equipRows.length ? `<div class="position-section-title">Props &amp; Equipment</div>${equipRows.join('')}` : ''}
    </div>
  </div>`;
}
function togglePos(pid) {
  event.stopPropagation();
  setExpanded(document.querySelector(`.position-wrap[data-pid="${pid}"]`), '.position-toggle');
}
