# InsightHunter

A single-file practice tracker for **meditation and mind-body work**. Run a guided timer that
walks you through a technique one step at a time, follow plans, keep a streak, and see where the
practice has actually gone — all offline, all in your browser, no account.

It ships with **one practice**: plain sitting meditation, in three variations. That is deliberate —
the app is a shell, and the content is data you can replace. See [Content](#content).

The whole thing is one file, [`insight-hunter.html`](insight-hunter.html) (~180 KB, inline
HTML/CSS/JS, no build step to use it; the one thing it loads is the house font module from the same site).

## Run it

Hosted copy: **https://adervec.github.io/InsightMaster/** — or open `insight-hunter.html` in a Chromium browser. For the full PWA experience
(service worker, offline cache, install prompt) run it from the local server:

```sh
npm run launch    # starts the server AND opens the app
npm run serve     # server only — http://127.0.0.1:4322/insight-hunter.html
```

On Windows you can also double-click **`launch.cmd`**.

## Install (PWA)

Open the served URL in Chrome and use **Install app** / **Add to Home Screen**. The manifest,
icons and offline-first service worker are wired, and the test suite asserts the installability
requirements. Installed, it runs standalone, portrait, fully offline, with home-screen shortcuts
into a new session, the library or history. A new build announces itself with a one-tap **Reload**
toast, and the app asks the browser for persistent storage so years of history aren't evicted.

## Features

- **Practice** — start a session, add practices, or run a full-screen **timer** (countdown ring,
  bell, optional interval bell, wake lock, +1 min, pause, a settling-in countdown before the opening
  bell, a 1–3× closing bell, vibration for silent sits, an **open-ended sit** that counts up until
  you say Done, and tap the ring to hide the clock). The timer **walks you through the
  technique's steps in time with the countdown** — the current step is called out above the ring
  and highlighted below it, so the timer teaches rather than just ending. If the browser discards
  the tab mid-practice, the next launch offers the timer back.
- **Logging** — log on an earlier day if you forgot, correct a duration in place, and rate **how
  the session felt** (1–5), which is tracked and averaged in Stats.
- **Library** — search, category filters, sorting, a 🎲 random pick, importance and difficulty
  badges, setup/steps/mistakes, body-position and props tables, dosages, favourites, and your own
  track record with each practice. Toggle to **recipe grid**: every practice as a card that opens a
  recipe-style sheet — ingredients, method, watch-outs, dose.
- **Plans** — seeded routines plus a full builder (reorder, per-step minutes, pin a variation per
  step). The **plan runner** chains timers with bells between steps and logs the session at the end.
- **History** — month calendar with intensity dots, in-place corrections, rating and annotating a
  past session, and **🔁 Practice this again** to replay one as a timed queue.
- **Stats** — streak, hours, sessions, average feel, weekly chart against your goal, a **year
  heatmap**, category split, day-of-week and time-of-day habits, a per-practice detail sheet, and
  milestone ladders.
- **Practice avatar** *(optional, off by default)* — a 3D stick figure in the timer that performs
  the practice while you time it and breathes at its pace. Hand-rolled 3D (joints projected into
  SVG) — no WebGL, no libraries. Honours `prefers-reduced-motion`.
- **Glossary** — a searchable slide-in panel, available from anywhere.
- **Reminders** — a repeating daily calendar event (.ics) that opens the app, and an optional badge
  on the installed icon until today's sit is logged. No notification permission, no server.
- **Keyboard & touch** — every control is focusable and operable from the keyboard (`/` searches,
  Enter opens, Escape closes), sheets trap and restore focus, and the phone's back button closes
  the open sheet instead of leaving the app. Deletions offer **Undo** rather than a confirmation.
- **Font** — Atkinson Hyperlegible by default, with a reader-chosen font under Settings that is
  shared by every app on this site.
- **Data** — JSON export/import (merge or overwrite), CSV export, copy or share a text summary, and an
  optional [Google Drive backup](#privacy).

## Content

The app knows no practices, categories or vocabulary of its own — it renders whatever a content
module gives it, including the category names and colours. There are two ways to supply one:

| | |
|---|---|
| **`content/starter.json`** | The module that ships. Edit it and run `npm run build` to bake your own library into the file. |
| **`content-pack.js`** | A file sitting next to the built app that sets `window.IH_CONTENT`. If present it **replaces** the starter, so you can extend a deployed copy without rebuilding. An empty placeholder ships. |

Both use the same shape. The minimum that renders is a practice with steps:

```js
window.IH_CONTENT = {
  megaLabels: { movement: 'Movement' },
  megaColors: { movement: '#2a6f3f' },
  icons: { walk: '<svg viewBox="0 0 100 100">…</svg>' },
  exercises: [{
    id: 'walking', title: 'Walking Practice', tag: 'Movement • Basics',
    mega: 'movement', icon: 'walk', quickCue: 'Slow enough to feel each step.',
    general: {
      setup:    ['Find ten paces of clear floor'],
      movement: ['Stand still and feel both feet', 'Step, slowly', 'Notice the shift of weight'],
      mistakes: ['Walking at normal speed'],
    },
    variations: [{ id: 'slow', title: 'Very Slow', movement: ['Halve the speed again'],
                   programming: { Time: '10 min' } }],
  }],
  glossary: [{ term: 'Pace', cat: 'method', def: 'How fast you are going.' }],
  glossaryCategories: [{ id: 'all', label: 'All' }, { id: 'method', label: 'Method' }],
  seedPlans: [{ id: 'p1', name: 'Ten Minutes', steps: [{ exId: 'walking', varId: null, min: 10 }] }],
};
```

Every other key is optional and defaults to empty — `importanceMap`, `importanceDefaults`,
`difficultyOverrides`, `esotericMap`, `esotericDefaults`, `bodyLabels`, `equipLabels`,
`positionDefaults`, `subFiltersByMega`, `avatarClips`, `avatarByEx`, `avatarDefaultsByMega`.
`npm run check` validates a module and will tell you exactly what is missing or dangling.

## Privacy

No account, no servers, no analytics. The app is static and keyless, and by default nothing it
does touches the network after it loads. Your log, plans and settings live in this browser's
`localStorage`, plus any JSON backups you export yourself.

The page loads one small script from this site's own origin, `https://adervec.github.io/font.js`, for
the house font (Atkinson Hyperlegible) and the reader's font choice. It stores only the chosen font name
in `localStorage` and talks to nothing else; offline, or from a downloaded copy, the app keeps the
system font.

Exactly one feature reaches out, and only if you turn it on:

| Feature | Talks to | What happens |
|---|---|---|
| Settings → **Cloud backup** | Google Identity Services + Drive API | **Only if you connect.** Loads Google's sign-in script, signs you in, and keeps one backup file in a **private app-data folder in your Drive** that only this app can see. What travels is the same JSON that Export writes. Your browser talks to Drive directly; nothing passes through any server of this app. The access token is kept in memory and never written to storage or an export. Google's privacy policy applies. |

Drive uses one **public** OAuth client ID (an identifier, not a secret) that Google honours only on
its registered JavaScript origins, plus an app-side origin gate so a fork deployed elsewhere can't
use it. The requested scope is `drive.appdata` only — the app cannot see the rest of your Drive. On
the official deployment and on `localhost` there is nothing to set up; anywhere else the settings
card asks for your own client ID, which is stored on that device.

`npm run check` fails the build if the scope ever widens, if a client secret or refresh token
appears in the published file, or if a token is written to storage.

## Develop & test

```sh
npm install                      # one-time (Playwright)
npx playwright install chromium  # one-time (test browser)

npm run build           # write insight-hunter.html from src/ + content/starter.json
npm run check           # build, then zero-dependency static checks
npm test                # the above, then Playwright drives the real file in headless
                        # Chromium (desktop + emulated Pixel)
npm run icons           # regenerate the PWA icons
```

`insight-hunter.html` is **generated** — edit `src/` or `content/starter.json` and rebuild; don't
edit it directly.

```
insight-hunter.html       the app (generated)
index.html                hands the site root off to the app (GitHub Pages)
content/starter.json      the practice module that ships
content-pack.js           empty placeholder; replace to load your own library
src/shell.html            HTML + CSS shell
src/app.js                app logic
src/avatar.js             3D avatar: pose vocabulary + SVG projection renderer
src/drive.js              Google Drive backup: OAuth + appDataFolder REST
src/render-helpers.js     badge and body-position rendering
tools/                    build.mjs · make-icons.mjs · serve.mjs
test/                     check.mjs (static) · app.spec.mjs · pwa.spec.mjs
                          pack-override.spec.mjs (proves a pack replaces the starter)
manifest.webmanifest, sw.js, icon-*.png   PWA shell
```

## Disclaimer

InsightHunter is a personal practice log built by a software developer — **not** a doctor,
physiotherapist, or meditation teacher. The bundled instructions are educational only and may not
be right for you, as is any content module you load. Sit comfortably, don't force a breath or a
stretch, and stop on pain, dizziness or distress. Consult a qualified professional where
appropriate — you use this app and follow its content entirely at your own risk. Provided "as is"
under the MIT License, without warranty of any kind.

## License

MIT © 2026 Adam Eryavec. Built with [Claude Code](https://claude.com/claude-code).
