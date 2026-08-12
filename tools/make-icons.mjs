// tools/make-icons.mjs — generate the PWA PNG icons (enso circle + arrow: the insight hunter),
// rasterized with the Playwright Chromium we already depend on. Run: node tools/make-icons.mjs
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const ACCENT = '#b48aff';
const BG = '#0c0a14';

// An enso (open brush circle) with a small arrowhead at the opening — sized to fit the
// maskable safe zone (central 80% of a 512 box).
function glyph() {
  return `
    <circle cx="256" cy="256" r="130" fill="none" stroke="${ACCENT}" stroke-width="34"
      stroke-linecap="round" stroke-dasharray="700 117" transform="rotate(-55 256 256)"/>
    <polygon points="332,112 396,96 380,160" fill="${ACCENT}"/>
    <circle cx="256" cy="256" r="26" fill="${ACCENT}"/>`;
}

function svg({ maskable }) {
  const rx = maskable ? 0 : 96;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
    <rect width="512" height="512" rx="${rx}" fill="${BG}"/>
    ${glyph()}
  </svg>`;
}

const TARGETS = [
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'icon-512-maskable.png', size: 512, maskable: true },
  { file: 'apple-touch-icon.png', size: 180, maskable: false },
];

const browser = await chromium.launch();
try {
  for (const t of TARGETS) {
    const page = await browser.newPage({ viewport: { width: t.size, height: t.size }, deviceScaleFactor: 1 });
    await page.setContent(
      `<!DOCTYPE html><meta charset="utf-8"><style>html,body{margin:0;padding:0}svg{display:block;width:${t.size}px;height:${t.size}px}</style>${svg({ maskable: t.maskable })}`,
      { waitUntil: 'load' },
    );
    const png = await page.locator('svg').screenshot();
    writeFileSync(join(root, t.file), png);
    console.log(`wrote ${t.file} (${t.size}x${t.size}${t.maskable ? ', maskable' : ''})`);
    await page.close();
  }
} finally {
  await browser.close();
}
