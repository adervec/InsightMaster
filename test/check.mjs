// test/check.mjs — Layer 1 static checks, zero dependencies. Every inline script must parse,
// no native dialogs, no stray external scripts, the starter module must be coherent, and the
// app itself must stay content-agnostic: it renders whatever a pack gives it and knows no
// practice, category or vocabulary of its own.
// Run: node test/check.mjs
import { readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import vm from 'node:vm';

const root = fileURLToPath(new URL('..', import.meta.url));
const html = readFileSync(join(root, 'insight-hunter.html'), 'utf8');
let failures = 0;
const fail = (msg) => { console.error('FAIL:', msg); failures++; };
const ok = (msg) => console.log('  ok:', msg);
const inlineScripts = (s) => [...s.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);

/* ---------------------------------------------------------------
   1. the file itself
   --------------------------------------------------------------- */
const scripts = inlineScripts(html);
if (scripts.length !== 3) fail(`expected 3 inline scripts (content, bindings, app), found ${scripts.length}`);
scripts.forEach((src, i) => {
  const name = ['content', 'bindings + render helpers', 'app'][i] || `#${i + 1}`;
  try { new vm.Script(src); ok(`${name} script parses (${(src.length / 1024).toFixed(0)} KB)`); }
  catch (e) { fail(`${name} script does not parse: ${e.message}`); }
});

const srcs = [...html.matchAll(/<script\s+[^>]*src="([^"]+)"/gi)].map((m) => m[1]);
// the optional pack, and the house font module served from this maker's own origin
const ALLOWED_SRC = ['content-pack.js', 'https://adervec.github.io/font.js'];
if (srcs.some((s) => !ALLOWED_SRC.includes(s))) fail(`unexpected external script(s): ${srcs.join(', ')}`);
else ok('external scripts: only the optional content pack and the house font module');

if (scripts.some((s) => s.includes('localStorage.clear('))) fail('localStorage.clear() would erase every app on this shared origin');
for (const bad of ['window.confirm(', 'window.alert(', 'window.prompt(', '\talert(', ' alert(', ' confirm(', ' prompt(', 'debugger']) {
  if (scripts.some((s) => s.includes(bad))) fail(`banned token in inline script: "${bad.trim()}"`);
}
ok('no native dialogs / debugger tokens');

for (const needle of ['manifest.webmanifest', 'id="panel-practice"', 'id="gloss-panel"', 'serviceWorker']) {
  if (!html.includes(needle)) fail(`missing shell essential: ${needle}`);
}
ok('shell essentials present');

if (!/url=insight-hunter\.html/.test(readFileSync(join(root, 'index.html'), 'utf8'))) fail('index.html must hand the site root off to insight-hunter.html');
else ok('index.html hands the site root off to the app');

const kb = html.length / 1024;
if (kb > 400) fail(`published app is ${kb.toFixed(0)} KB — larger than expected`);
else ok(`published app is ${kb.toFixed(0)} KB, self-contained`);

/* ---------------------------------------------------------------
   2. the app is content-agnostic — it should read as a shell that
      any pack can fill, with no taxonomy baked into it
   --------------------------------------------------------------- */
const styleBlock = /<style>([\s\S]*?)<\/style>/.exec(html);
if (styleBlock && /data-mega="[a-z]/.test(styleBlock[1])) fail('the stylesheet hardcodes category names — colours must come from the pack (megaColors)');
else ok('no category names in the stylesheet — colours come from the pack');

// the bindings must stand alone: with no pack at all the app still boots, empty
const bindCtx = { window: {} };
vm.createContext(bindCtx);
try {
  vm.runInContext(scripts[1] + ';__d={ex:exercises.length,gl:glossary.length,has:HAS_CONTENT}', bindCtx);
  const b = bindCtx.__d;
  if (b.ex !== 0 || b.gl !== 0 || b.has !== false) fail(`bindings are not empty without a pack: ${JSON.stringify(b)}`);
  else ok('with no pack the app binds empty content and sets HAS_CONTENT=false');
} catch (e) { fail(`bindings throw without a pack: ${e.message}`); }

// the shipped placeholder must stay empty — a real pack is something you add
const packPath = join(root, 'content-pack.js');
if (!existsSync(packPath)) fail('content-pack.js placeholder is missing (the app requests it)');
else {
  const pack = readFileSync(packPath, 'utf8');
  if (/IH_CONTENT/.test(pack.replace(/\/\*[\s\S]*?\*\//g, ''))) fail('the shipped content-pack.js is not an empty placeholder');
  else ok('content-pack.js ships as an empty placeholder');
}

/* ---------------------------------------------------------------
   3. the starter module
   --------------------------------------------------------------- */
const ctx = { window: {} };
vm.createContext(ctx);
try { vm.runInContext(scripts[0], ctx); ok('starter module evaluates'); }
catch (e) { fail(`starter module does not evaluate: ${e.message}`); }
const d = ctx.window.IH_CONTENT || {};

for (const key of ['icons', 'exercises', 'glossary', 'glossaryCategories', 'seedPlans',
  'megaLabels', 'megaColors', 'avatarByEx', 'avatarDefaultsByMega']) {
  if (d[key] === undefined) fail(`starter module is missing "${key}"`);
}
if (Object.keys(d).some((k) => k.startsWith('_'))) fail('editor notes (_ keys) leaked into the build');
else ok('starter module carries every contract key and no editor notes');

const exs = d.exercises || [];
if (!exs.length) fail('starter module has no practices');
else ok(`starter module: ${exs.length} practice(s), ${exs.reduce((n, e) => n + (e.variations || []).length, 0)} variations, ${(d.glossary || []).length} glossary terms`);

const noSteps = exs.filter((e) => !(e.general && e.general.movement) && !(e.variations || []).some((v) => v.movement));
if (noSteps.length) fail(`practices without atomic steps: ${noSteps.map((e) => e.id).join(', ')}`);
else ok('every practice breaks down into atomic steps');

const ids = new Set(exs.map((e) => e.id));
const badStep = (d.seedPlans || []).flatMap((p) => p.steps.map((s) => s.exId)).filter((id) => !ids.has(id));
if (badStep.length) fail(`seed plans point at unknown practices: ${[...new Set(badStep)].join(', ')}`);
else ok(`${(d.seedPlans || []).length} seed plans, all steps resolving`);

const badVar = (d.seedPlans || []).flatMap((p) => p.steps)
  .filter((s) => s.varId && !((exs.find((e) => e.id === s.exId) || {}).variations || []).some((v) => v.id === s.varId));
if (badVar.length) fail(`seed plan steps point at unknown variations: ${badVar.map((s) => s.varId).join(', ')}`);
else ok('seed plan variations all exist');

const megas = new Set(exs.map((e) => e.mega));
const unlabelled = [...megas].filter((m) => !(d.megaLabels || {})[m] || !(d.megaColors || {})[m]);
if (unlabelled.length) fail(`categories missing a label or colour: ${unlabelled.join(', ')}`);
else ok(`every one of the ${megas.size} categor${megas.size === 1 ? 'y has' : 'ies have'} a label and colour`);

const missingIcons = [...new Set(exs.map((e) => e.icon))].filter((i) => !(d.icons || {})[i]);
if (missingIcons.length) fail(`practices reference icons the pack does not define: ${missingIcons.join(', ')}`);
else ok('every practice icon is defined');

// avatar choreography must resolve to clips, and clips to poses the app actually knows
const poseBlock = /const AV_POSES = \{([\s\S]*?)\n\};/.exec(html);
if (!poseBlock) fail('could not find the avatar pose vocabulary in the app');
const appPoses = new Set([...(poseBlock ? poseBlock[1] : '').matchAll(/^ {2}(\w+): \{/gm)].map((m) => m[1]));
const clipNames = new Set(Object.keys(d.avatarClips || {}).concat(['still', 'seated', 'rest']));
const badClip = Object.entries(d.avatarByEx || {}).concat(Object.entries(d.avatarDefaultsByMega || {}))
  .filter(([, c]) => !clipNames.has(c));
if (badClip.length) fail(`avatar mapping points at unknown clips: ${badClip.map(([k, c]) => k + '->' + c).join(', ')}`);
else ok('avatar mappings resolve');
const badPose = [...new Set(Object.values(d.avatarClips || {}).flatMap((c) => (c.loop || []).map((k) => k.pose)))]
  .filter((p) => !appPoses.has(p));
if (badPose.length) fail(`avatar clips use poses the app does not define: ${badPose.join(', ')}`);
else ok(`avatar clips use only the ${appPoses.size} poses the app defines`);

/* ---------------------------------------------------------------
   4. Google Drive OAuth stays narrow
   --------------------------------------------------------------- */
const OAUTH_MUST_HAVE = [
  '547617739897-br6dj2facmsc34qnkjb5u4dbfhju39pu.apps.googleusercontent.com', // public id, not a secret
  "OAUTH_ORIGINS = ['https://adervec.github.io']",                            // origin gate
  'https://www.googleapis.com/auth/drive.appdata',                            // private app folder only
  'https://accounts.google.com/gsi/client',                                   // GIS, loaded on demand
];
const missingOauth = OAUTH_MUST_HAVE.filter((s) => !html.includes(s));
if (missingOauth.length) fail(`Drive OAuth setup is incomplete: ${missingOauth.join(' | ')}`);
else ok('Drive OAuth setup present (public client id, origin gate, appdata scope)');

for (const scope of ['auth/drive.file', 'auth/drive.readonly', "auth/drive'", 'auth/drive "']) {
  if (html.includes(scope)) fail(`Drive scope is wider than appdata: ${scope}`);
}
for (const secret of ['client_secret', 'GOCSPX-', 'refresh_token']) {
  if (html.includes(secret)) fail(`OAuth secret material in the published app: ${secret}`);
}
ok('Drive scope is app-data only, and no OAuth secret ships');

if (/setItem\([^)]*[Tt]oken/.test(html)) fail('an OAuth token is being persisted to storage');
else ok('OAuth access token is never persisted');

if (failures) { console.error(`\n${failures} check(s) failed`); process.exit(1); }
console.log(`\nAll static checks passed (${statSync(join(root, 'insight-hunter.html')).size} bytes).`);
