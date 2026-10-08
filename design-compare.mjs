import { chromium } from '@playwright/test';

const PROTO = 'http://127.0.0.1:8123/closed-form-ui-v5.html';
const OURS = 'http://127.0.0.1:4322/closed-form/';

// Prototype is hash-routed; ours uses real routes.
const SHOTS = [
  { name: 'home', proto: '#', ours: '' },
  { name: 'archive', proto: '#archive', ours: 'archive/' },
  { name: 'archive-scrolled', proto: '#archive', ours: 'archive/', scroll: 2400 },
  { name: 'entry-017', proto: '#017', ours: 'e/openai-math-2026-017/' },
  { name: 'entry-001', proto: '#001', ours: 'e/openai-math-2026-001/' },
  { name: 'about', proto: '#about', ours: 'about/' },
];

const VIEWPORTS = [
  { name: '1440', width: 1440, height: 900 },
  { name: '390', width: 390, height: 844 },
];

const THEMES = ['light', 'dark'];

const b = await chromium.launch();
for (const theme of THEMES) {
  for (const vp of VIEWPORTS) {
    for (const s of SHOTS) {
      for (const [side, base, route] of [['proto', PROTO, s.proto], ['ours', OURS, s.ours]]) {
        const ctx = await b.newContext({
          viewport: { width: vp.width, height: vp.height },
          colorScheme: theme,
        });
        const p = await ctx.newPage();
        await p.goto(base + route, { waitUntil: 'networkidle' });
        await p.waitForTimeout(800);
        if (s.scroll) await p.evaluate((y) => window.scrollTo(0, y), s.scroll);
        await p.waitForTimeout(300);
        await p.screenshot({ path: `design/compare/${s.name}-${vp.name}-${theme}-${side}.png` });
        await ctx.close();
        console.log(`ok ${s.name} ${vp.name} ${theme} ${side}`);
      }
    }
  }
}
await b.close();
