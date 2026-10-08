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

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

const INK = '#211c16';
const SECONDARY = '#6f665c';
const BG = '#ffffff';
const RULE = '#e5ded3';
const VERMILION = '#c2410c';
const TRUST_DOT: Record<string, string> = {
  formal: '#1b7a4d',
  partial: '#a86a00',
  claimed: '#8a837c',
};

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
}

export function ogSvg(card: OgCard): string {
  const dot = card.trust ? (TRUST_DOT[card.trust] ?? TRUST_DOT.claimed) : null;
  const lines = card.headlineLines.slice(0, 3);
  const startY = 268;
  const lineH = 76;
  const rendered = lines
    .map(
      (l, i) =>
        `<text x="64" y="${startY + i * lineH}" font-family="'Schibsted Grotesk', system-ui, sans-serif" font-size="62" font-weight="500" fill="${INK}" letter-spacing="-1">${escapeXml(l)}</text>`,
    )
    .join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}">
<rect width="1200" height="630" fill="${BG}"/>
<rect x="64" y="56" width="26" height="26" fill="${VERMILION}"/>
<text x="102" y="78" font-family="'Schibsted Grotesk', system-ui, sans-serif" font-size="30" font-weight="500" fill="${INK}">Closed Form</text>
<text x="64" y="196" font-family="system-ui, sans-serif" font-size="28" font-weight="500" letter-spacing="2" fill="${SECONDARY}">${escapeXml(card.kicker.toUpperCase())}</text>
${rendered}
<line x1="64" y1="540" x2="1136" y2="540" stroke="${RULE}" stroke-width="1"/>
${dot ? `<circle cx="76" cy="576" r="10" fill="${dot}"/>` : ''}
<text x="${dot ? '98' : '64'}" y="586" font-family="system-ui, sans-serif" font-size="26" fill="${SECONDARY}">${escapeXml(card.footer)}</text>
</svg>`;
}

export function ogPng(svg: string): Uint8Array {
  const r = new Resvg(svg, {
    fitTo: { mode: 'width', value: OG_WIDTH },
    font: { loadSystemFonts: true },
  });
  return r.render().asPng();
}
