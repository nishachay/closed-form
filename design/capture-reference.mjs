import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';

const PROTO = 'http://127.0.0.1:8123/closed-form-ui-v5.html';
mkdirSync('design/reference', { recursive: true });

const PAGES = [
  { name: 'home', hash: '#' },
  { name: 'archive', hash: '#archive' },
  { name: 'entry-017', hash: '#017' },
  { name: 'entry-001', hash: '#001' },
  { name: 'about', hash: '#about' },
];

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
for (const pg of PAGES) {
  await p.goto(PROTO + pg.hash, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1000);
  const html = await p.evaluate(() => {
    const views = ['home', 'arch', 'entry', 'ab'];
    const vis = views.find((v) => {
      const el = document.getElementById(v);
      return el && !el.hidden;
    });
    if (!vis) return 'NO-VISIBLE-VIEW';
    return document.getElementById(vis).outerHTML;
  });
  writeFileSync(`design/reference/${pg.name}.html`, html);
  console.log('saved', pg.name, html.length, 'chars');
}
await b.close();
