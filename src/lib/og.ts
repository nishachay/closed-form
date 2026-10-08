/**
 * OG card rendering (Phase 3, §14.6).
 *
 * 1200×630 PNGs built at build time with hand-built SVG + @resvg/resvg-js.
 * (Spec names Satori + resvg; see PR_NOTES.md for why Satori was skipped.)
 *
 * Card content per §14.6: light bg, top-left ∎ Closed Form, large
 * "Open since {firstStep}." (or "Entry NNN") line, headline (max 3 lines),
 * bottom trust dot + label · field. Home card is lab-neutral.
 */

import { Resvg } from '@resvg/resvg-js';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

// Schibsted Grotesk (SIL OFL 1.1), static instances cut from the site's variable font,
// so share cards use the same type as the site instead of whatever the build machine has.
const FONT_DIR = join(process.cwd(), 'src/assets/og-fonts');
const FONT_FILES = [400, 500, 600]
  .map((w) => join(FONT_DIR, `SchibstedGrotesk-${w}.ttf`))
  .filter((p) => existsSync(p));

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

// v5 dark palette (matches the site's dark theme).
const BG = '#0f0e0b';
const SURFACE = '#191714';
const INK = '#efece8';
const SECONDARY = '#bdbab5';
const TERTIARY = '#95928c';
const BORDER = '#2b2924';
const ACCENT = '#ef704e';
const TRUST_DOT: Record<string, string> = {
  formal: '#57bc8a',
  partial: '#e6b055',
  claimed: '#95928c',
};
const TRUST_CELL: Record<string, string> = {
  formal: '#57bc8a',
  partial: '#e6b055',
  claimed: '#4a4742',
};
const FONT = "'Schibsted Grotesk', 'DejaVu Sans', sans-serif";

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Greedy word-wrap to at most `maxLines` lines of ~`maxChars` chars. */
export function wrapHeadline(text: string, maxChars = 34, maxLines = 3): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const words = clean.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= maxChars) {
      cur = next;
    } else {
      if (cur) lines.push(cur);
      cur = w;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  // Overflow: ellipsis on the last line.
  const used = lines.join(' ').length;
  if (used < clean.length && lines.length === maxLines) {
    let last = lines[maxLines - 1];
    while (last.length > maxChars - 1 && last.includes(' ')) {
      last = last.slice(0, last.lastIndexOf(' '));
    }
    lines[maxLines - 1] = `${last.slice(0, Math.max(0, maxChars - 1))}…`;
  }
  return lines;
}

export interface OgCard {
  kicker: string;
  headlineLines: string[];
  footer: string;
  trust?: string;
  /** Optional mosaic: one trust key per result, drawn as the site's field squares. */
  cells?: string[];
  /** Optional small label at top right (e.g. "Entry 017"). */
  tag?: string;
}

function mosaic(cells: string[], x: number, y: number, w: number, h: number): string {
  const n = cells.length;
  if (!n) return '';
  // Pick the column count that best fills the box with square cells.
  let best = { cols: 1, size: 0 };
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const size = Math.min(w / cols, h / rows);
    if (size > best.size) best = { cols, size };
  }
  const gap = Math.max(2, Math.round(best.size * 0.18));
  const s = best.size - gap;
  return cells
    .map((t, i) => {
      const cx = x + (i % best.cols) * best.size;
      const cy = y + Math.floor(i / best.cols) * best.size;
      return `<rect x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" width="${s.toFixed(1)}" height="${s.toFixed(1)}" rx="${Math.max(1, s * 0.18).toFixed(1)}" fill="${TRUST_CELL[t] ?? TRUST_CELL.claimed}"/>`;
    })
    .join('');
}

export function ogSvg(card: OgCard): string {
  const dot = card.trust ? (TRUST_DOT[card.trust] ?? TRUST_DOT.claimed) : null;
  const lines = card.headlineLines.slice(0, 3);
  const hasMosaic = !!card.cells?.length;
  const size = hasMosaic ? 56 : lines.length >= 3 ? 60 : 68;
  const lineH = Math.round(size * 1.14);
  const blockH = lines.length * lineH;
  const startY = Math.round(330 - blockH / 2 + size * 0.8);
  const rendered = lines
    .map(
      (l, i) =>
        `<text x="72" y="${startY + i * lineH}" font-family="${FONT}" font-size="${size}" font-weight="600" fill="${INK}" letter-spacing="-1.5">${escapeXml(l)}</text>`,
    )
    .join('\n');
  const kickerY = startY - size - 18;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}">
<rect width="1200" height="630" fill="${BG}"/>
<rect x="24" y="24" width="1152" height="582" rx="28" fill="${SURFACE}" stroke="${BORDER}" stroke-width="2"/>
<rect x="72" y="76" width="22" height="22" fill="${ACCENT}"/>
<text x="110" y="98" font-family="${FONT}" font-size="30" font-weight="600" fill="${INK}" letter-spacing="-0.5">Closed Form</text>
${card.tag ? `<text x="1128" y="100" text-anchor="end" font-family="${FONT}" font-size="24" font-weight="500" fill="${TERTIARY}">${escapeXml(card.tag)}</text>` : ''}
<text x="72" y="${kickerY}" font-family="${FONT}" font-size="22" font-weight="500" letter-spacing="2.5" fill="${ACCENT}">${escapeXml(card.kicker.toUpperCase())}</text>
${rendered}
${hasMosaic ? mosaic(card.cells!, 760, 170, 368, 300) : ''}
<line x1="72" y1="516" x2="1128" y2="516" stroke="${BORDER}" stroke-width="2"/>
${dot ? `<circle cx="84" cy="555" r="9" fill="${dot}"/>` : ''}
<text x="${dot ? '104' : '72'}" y="564" font-family="${FONT}" font-size="25" font-weight="500" fill="${SECONDARY}">${escapeXml(card.footer)}</text>
<text x="1128" y="564" text-anchor="end" font-family="${FONT}" font-size="22" fill="${TERTIARY}">AI mathematics, explained</text>
</svg>`;
}

export function ogPng(svg: string): Uint8Array {
  const r = new Resvg(svg, {
    fitTo: { mode: 'width', value: OG_WIDTH },
    font: {
      loadSystemFonts: true,
      fontFiles: FONT_FILES,
      defaultFontFamily: 'Schibsted Grotesk',
    },
  });
  return r.render().asPng();
}
