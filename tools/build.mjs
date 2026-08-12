// tools/build.mjs — assemble insight-hunter.html from src/ + content/starter.json.
//
// The output is one self-contained file: the app, plus the starter module inlined. It also
// looks for a content-pack.js sitting next to it, which REPLACES the starter — that is how
// you load a library of your own without touching the app. An empty placeholder ships so a
// deployed copy never 404s looking for one.
//
// Run: node tools/build.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (...p) => readFileSync(join(root, ...p), 'utf8');

// The whole content contract. A pack must be able to supply all of it; the bindings below
// give every key an empty default so a partial pack — or none at all — still runs.
const CONTENT_KEYS = [
  'icons', 'importanceMap', 'importanceDefaults', 'difficultyOverrides', 'esotericMap',
  'esotericDefaults', 'bodyLabels', 'equipLabels', 'positionDefaults', 'exercises',
  'subFiltersByMega', 'glossary', 'glossaryCategories', 'seedPlans', 'megaLabels',
  'megaColors', 'avatarClips', 'avatarByEx', 'avatarDefaultsByMega',
];
const BINDINGS = `/* Content comes from window.IH_CONTENT. Every binding has an empty default, so the app
   runs with a partial pack or with none at all — it owns no practice content of its own. */
const IH_C = (typeof window !== 'undefined' && window.IH_CONTENT) || {};
const icons = IH_C.icons || {};
const importanceMap = IH_C.importanceMap || {};
const importanceDefaults = IH_C.importanceDefaults || {};
const difficultyOverrides = IH_C.difficultyOverrides || {};
const esotericMap = IH_C.esotericMap || {};
const esotericDefaults = IH_C.esotericDefaults || {};
const bodyLabels = IH_C.bodyLabels || {};
const equipLabels = IH_C.equipLabels || {};
const positionDefaults = IH_C.positionDefaults || {};
const exercises = IH_C.exercises || [];
const subFiltersByMega = IH_C.subFiltersByMega || {};
const glossary = IH_C.glossary || [];
const glossaryCategories = IH_C.glossaryCategories || [{ id: 'all', label: 'All' }];
const HAS_CONTENT = exercises.length > 0;
`;

/* ---------- load and check the starter module ---------- */
const starter = JSON.parse(read('content', 'starter.json'));
for (const key of Object.keys(starter)) {
  if (key.startsWith('_')) delete starter[key]; // notes to humans don't ship
}
const missing = CONTENT_KEYS.filter((k) => starter[k] === undefined);
if (missing.length) throw new Error('content/starter.json is missing: ' + missing.join(', '));
if (!starter.exercises.length) throw new Error('content/starter.json has no practices');
for (const ex of starter.exercises) {
  const hasSteps = (ex.general && ex.general.movement) || (ex.variations || []).some((v) => v.movement);
  if (!hasSteps) throw new Error(`practice "${ex.id}" has no atomic steps`);
  if (!starter.megaLabels[ex.mega]) throw new Error(`practice "${ex.id}" is in unlabelled category "${ex.mega}"`);
}
const exIds = new Set(starter.exercises.map((e) => e.id));
for (const plan of starter.seedPlans) {
  for (const step of plan.steps) {
    if (!exIds.has(step.exId)) throw new Error(`plan "${plan.id}" points at unknown practice "${step.exId}"`);
  }
}

/* ---------- assemble ---------- */
const shell = read('src', 'shell.html');
const app = ['avatar.js', 'drive.js', 'app.js'].map((f) => read('src', f)).join('\n');
const content = `<script>window.IH_CONTENT = ${JSON.stringify(starter)};</script>
<script src="content-pack.js" onerror="window.IH_PACK_MISSING=1"></script>`;

const html = shell
  .replace('<!--CONTENT-->', () => content)
  .replace('<!--DATA-->', () => BINDINGS + '\n' + read('src', 'render-helpers.js'))
  .replace('<!--APP-->', () => app);

writeFileSync(join(root, 'insight-hunter.html'), html);
console.log(`wrote insight-hunter.html (${(html.length / 1024).toFixed(0)} KB) — `
  + `${starter.exercises.length} practice(s), `
  + `${starter.exercises.reduce((n, e) => n + (e.variations || []).length, 0)} variations, `
  + `${starter.glossary.length} glossary terms`);
