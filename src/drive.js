/* ==================================================================
   GOOGLE DRIVE BACKUP — the same OAuth setup Tachyread uses:
   Google Identity Services token client, the private appDataFolder
   scope, one shared public client id gated to the authorized origin,
   and a bring-your-own-client-id escape hatch for forks.

   Nothing in here runs, and Google's script is never fetched, until
   you connect. The access token lives in memory only — never in
   localStorage, never in an export.
   ================================================================== */

const DRIVE_FILE_NAME = 'insight-hunter-backup.json';
// Public OAuth client id, shared with the sibling apps — an identifier, not a secret. It only
// works from the JavaScript origins registered with Google; the origin gate below ALSO refuses
// it app-side anywhere else, so a fork deployed elsewhere must supply its own id.
const BUILTIN_DRIVE_CLIENT_ID = '547617739897-br6dj2facmsc34qnkjb5u4dbfhju39pu.apps.googleusercontent.com';
const OAUTH_ORIGINS = ['https://adervec.github.io'];
// The private app-data folder for the backup, plus the standard identity scopes so the settings
// card can show which account is signed in. drive.appdata sees only this app's own folder.
const DRIVE_SCOPE = 'openid email profile https://www.googleapis.com/auth/drive.appdata';

function driveOriginAllowed() {
  try {
    const h = location.hostname;
    if (h === 'localhost' || h === '127.0.0.1' || h === '[::1]') return true; // local dev, any port
    return OAUTH_ORIGINS.indexOf(location.origin) !== -1;
  } catch (e) { return false; }
}
// A user-supplied id (fork / self-host) wins; otherwise the built-in id on the authorized
// origin. Empty means Drive backup simply isn't offered here.
function driveClientId() {
  const own = ((state.sync && state.sync.driveClientId) || '').trim();
  return own || (driveOriginAllowed() ? BUILTIN_DRIVE_CLIENT_ID : '');
}

let _gis = null;
function loadGis() {
  if (_gis) return _gis;
  _gis = new Promise((resolve, reject) => {
    if (window.google && window.google.accounts && window.google.accounts.oauth2) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load Google sign-in.'));
    document.head.appendChild(s);
  });
  return _gis;
}

let _driveToken = null;   // { value, exp } — memory only, so a shared device keeps no grant
let _driveProfile = null; // { name, email, picture } — cosmetic, for the settings card
function driveTokenValid() { return !!_driveToken && _driveToken.exp > Date.now() + 60000; }
function getDriveProfile() { return _driveProfile; }

async function fetchDriveProfile(token) {
  try {
    const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: 'Bearer ' + token } });
    if (r.ok) {
      const j = await r.json();
      _driveProfile = { name: j.name || j.email || 'Google account', picture: j.picture || '', email: j.email || '' }; window.appFont?.setAccount(_driveProfile);
    }
  } catch (e) { /* cosmetic only — never blocks a backup */ }
  return _driveProfile;
}

function requestDriveToken(clientId, prompt) {
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (resp) => {
        if (resp && resp.access_token) {
          _driveToken = { value: resp.access_token, exp: Date.now() + ((resp.expires_in || 3600) * 1000) };
          resolve(resp.access_token);
        } else reject(new Error((resp && resp.error) || 'Sign-in failed.'));
      },
      // Fires when the flow cannot produce a response at all (popup closed or blocked, network) —
      // without it the promise would hang forever on a dismissed popup.
      error_callback: (err) => reject(new Error((err && (err.message || err.type)) || 'Sign-in was dismissed.')),
    });
    // prompt '' → silent when a prior grant and an active Google session exist (boot / auto-backup);
    // 'consent' forces the account chooser and must come from a click.
    client.requestAccessToken({ prompt: prompt });
  });
}

/* silent: only reuse an existing grant — never open a sign-in popup */
async function driveConnect(opts) {
  const silent = !!(opts && opts.silent);
  const clientId = driveClientId();
  if (!clientId) throw new Error('Drive backup isn’t enabled here.');
  if (driveTokenValid()) {
    if (!_driveProfile) await fetchDriveProfile(_driveToken.value);
    return _driveToken.value;
  }
  await loadGis();
  let token;
  try {
    token = await requestDriveToken(clientId, '');          // existing grant, no popup
  } catch (e) {
    if (silent) throw e;                                    // auto/boot: stay quiet
    token = await requestDriveToken(clientId, 'consent');   // user asked for it: ask once
  }
  await fetchDriveProfile(token);
  return token;
}
function driveDisconnect() { _driveToken = null; _driveProfile = null; window.appFont?.setAccount(null); }

async function driveFind(token) {
  const q = encodeURIComponent("name='" + DRIVE_FILE_NAME + "' and trashed=false");
  const r = await fetch('https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=' + q + '&fields=files(id,name,modifiedTime)',
    { headers: { Authorization: 'Bearer ' + token } });
  if (!r.ok) throw new Error('Drive list failed (' + r.status + ').');
  const j = await r.json();
  return (j.files && j.files[0]) || null;
}
// ponytail: one multipart request. A practice log is tens of KB, so Drive's 5 MB multipart cap
// never bites — add the resumable protocol only if a backup ever approaches it.
async function driveUpload(token, text) {
  const existing = await driveFind(token);
  const meta = existing ? {} : { name: DRIVE_FILE_NAME, parents: ['appDataFolder'] };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
  form.append('file', new Blob([text], { type: 'application/json' }));
  const url = existing
    ? 'https://www.googleapis.com/upload/drive/v3/files/' + existing.id + '?uploadType=multipart'
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
  const r = await fetch(url, { method: existing ? 'PATCH' : 'POST', headers: { Authorization: 'Bearer ' + token }, body: form });
  if (!r.ok) throw new Error('Drive upload failed (' + r.status + ').');
}
async function driveDownload(token) {
  const f = await driveFind(token);
  if (!f) return null;
  const r = await fetch('https://www.googleapis.com/drive/v3/files/' + f.id + '?alt=media', { headers: { Authorization: 'Bearer ' + token } });
  if (!r.ok) throw new Error('Drive download failed (' + r.status + ').');
  return await r.text();
}

function driveErr(e) {
  const m = (e && e.message) || '';
  return /^[\x20-\x7e’]{1,90}$/.test(m) ? m : 'Drive request failed.';
}

/* ---------- the two things the app actually does with Drive ---------- */
async function driveBackupNow(opts) {
  const silent = !!(opts && opts.silent);
  try {
    const token = await driveConnect({ silent: silent });
    await driveUpload(token, backupPayload());
    state.sync.lastSync = Date.now();
    state.lastExportAt = Date.now(); // a Drive copy counts as a backup for the nudge
    state.backupNudgedAt = 0;
    saveState();
    if (!silent) { toast('Backed up to Drive'); renderSettings(); }
    return true;
  } catch (e) {
    if (!silent) { toast(driveErr(e)); renderSettings(); }
    return false;
  }
}
/* ---------- settings card ---------- */
function driveSettingsHtml() {
  const cid = driveClientId();
  const prof = getDriveProfile();
  const last = state.sync.lastSync;
  return `
    <div class="card">
      <h2>☁️ Cloud backup <span class="muted">— private Google Drive app folder</span></h2>
      ${cid ? `
        <div class="set-row">
          ${prof && prof.picture ? `<img class="drive-pic" src="${esc(prof.picture)}" alt="" referrerpolicy="no-referrer">` : ''}
          <div class="sl">${prof ? 'Signed in as <strong>' + esc(prof.name) + '</strong>' : 'Not connected'}
            <br><span class="d">${last ? 'Last Drive backup ' + dateLabel(todayStr(new Date(last))) + ', ' + new Date(last).toLocaleTimeString() : 'No Drive backup yet.'}</span></div>
        </div>
        <div class="set-row">
          <div class="sl">Back up when a session ends<br><span class="d">Silent — it never opens a sign-in popup by itself</span></div>
          <label class="switch"><input type="checkbox" id="set-drive-auto" ${state.sync.auto ? 'checked' : ''}><span class="sl-track"></span></label>
        </div>
        <div class="btn-row">
          <button class="btn accent" id="drive-backup">⬆ Back up now</button>
          <button class="btn" id="drive-restore">⬇ Restore from Drive</button>
          ${prof ? '<button class="btn" id="drive-signout">Sign out</button>' : ''}
        </div>
      ` : `
        <div class="muted">Drive backup isn’t enabled on this deployment. In the Google Cloud console create an
          <strong>OAuth client ID → Web application</strong>, add this page’s origin (<code>${esc(location.origin)}</code>)
          to its authorized JavaScript origins, enable the Drive API, then paste the client ID here — it stays on this device.</div>
        <div class="field-label">Google OAuth client ID</div>
        <input class="text-input" id="drive-cid" placeholder="xxxxx.apps.googleusercontent.com" value="${esc(state.sync.driveClientId || '')}">
      `}
      <div class="muted" style="margin-top:8px">Only this app can see the folder it writes to, and your browser talks to
        Drive directly — nothing passes through any server of this app. Google’s sign-in script loads only when you connect,
        and the access token is kept in memory, never saved.</div>
    </div>`;
}
function bindDriveSettings() {
  const cidInput = $('drive-cid');
  if (cidInput) {
    cidInput.addEventListener('change', () => {
      state.sync.driveClientId = cidInput.value.trim().slice(0, 200);
      saveState();
      renderSettings();
    });
    return;
  }
  $('drive-backup').addEventListener('click', () => driveBackupNow({}));
  $('drive-restore').addEventListener('click', driveRestore);
  $('set-drive-auto').addEventListener('change', (e) => { state.sync.auto = e.target.checked; saveState(); });
  const out = $('drive-signout');
  if (out) out.addEventListener('click', () => { driveDisconnect(); toast('Signed out of Drive'); renderSettings(); });
}

async function driveRestore() {
  try {
    const token = await driveConnect({});
    const text = await driveDownload(token);
    if (text === null) { toast('No backup in Drive yet'); return; }
    let obj = null;
    try { obj = JSON.parse(text); } catch (e) { toast('The Drive backup could not be read'); return; }
    await applyBackup(obj, 'Restore from Drive');
    renderSettings();
  } catch (e) { toast(driveErr(e)); }
}
