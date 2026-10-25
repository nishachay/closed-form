/**
 * Markdown building blocks for the .md twins of HTML pages (see registry.ts).
 * Pure string helpers: no Astro imports, so vitest covers them.
 *
 * Math stays as LaTeX between `$…$`; the few HTML tags ingest keeps in titles
 * and summaries (i, em, b, strong, sub, sup) become markdown or stay inline.
 */
import { toPlain } from '../plain.js';

export interface MdLink {
  title: string;
  /** Absolute HTML URL. */
  url: string;
  /** Optional one-line description after the link. */
  note?: string;
}

/** A rendered page, before the shared header and Related footer are added. */
export interface MdDoc {
  /** HTML path without base, e.g. "/e/openai-math-2026-001/". */
  path: string;
  title: string;
  /** One sentence: the page's meta description. */
  summary: string;
  /** ISO date (YYYY-MM-DD) the page content last changed, when known. */
  updated?: string;
  /** Main content as markdown, in reading order. */
  body: string;
  related: MdLink[];
}

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };

/** Inline catalog/entry text as markdown: <i>/<em> → *…*, <b>/<strong> → **…**, sub/sup kept, a few layout tags dropped. Never touches `<` in math. */
export function inline(s: string): string {
  if (!s) return '';
  return s
    .replace(/<\s*(i|em)\s*>([\s\S]*?)<\s*\/\s*\1\s*>/gi, '*$2*')
    .replace(/<\s*(b|strong)\s*>([\s\S]*?)<\s*\/\s*\1\s*>/gi, '**$2**')
    .replace(/<\/?(?:span|br|p|a|div|code)\b[^<>]*>/gi, '')
    .replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITIES[m] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

/** Link text: plain Unicode (no `$` math, no tags), with brackets escaped. */
export function linkText(s: string): string {
  return toPlain(s).replace(/([[\]])/g, '\\$1');
}

export const mdLink = (title: string, url: string) => `[${linkText(title)}](${url})`;

/** `- [Title](url) - note` */
export function listItem(l: MdLink): string {
  return `- ${mdLink(l.title, l.url)}${l.note ? ` - ${l.note}` : ''}`;
}

export const list = (items: MdLink[]) => items.map(listItem).join('\n');

/** Join blocks with one blank line, dropping empty ones. */
export function blocks(...parts: Array<string | false | null | undefined>): string {
  return parts
    .filter((p): p is string => !!p && p.trim() !== '')
    .map((p) => p.trim())
    .join('\n\n');
}

export const section = (heading: string, ...body: Array<string | false | null | undefined>) => {
  const inner = blocks(...body);
  return inner ? `## ${heading}\n\n${inner}` : '';
};

/** Blockquote every line of a block. */
export const quote = (s: string) =>
  s
    .split('\n')
    .map((l) => (l.trim() ? `> ${l}` : '>'))
    .join('\n');

/**
 * A verbatim LaTeX line quoted from a paper, made readable as markdown: citation
 * and label commands dropped, cross-references shown as "…", math kept as LaTeX.
 * Mirrors the clean-up renderQuote (src/lib/katex.ts) does before rendering.
 */
export function paperQuote(text: string): string {
  return text
    .replace(/~?\\(?:cite[a-z]*|label)\*?(?:\[[^\]]*\])*\{[^}]*\}/g, '')
    .replace(/\\(?:eqref)\*?\{[^}]*\}/g, '(…)')
    .replace(/\\(?:ref|cref|Cref|autoref|pageref)\*?\{[^}]*\}/g, '…')
    .replace(/(?<!\\)~/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** HTML path → markdown path: "/" → "/index.md", "/about/" → "/about.md", "/e/x/" → "/e/x.md". */
export function mdPathFor(htmlPath: string): string {
  const p = htmlPath.startsWith('/') ? htmlPath : `/${htmlPath}`;
  if (p === '/' || p === '') return '/index.md';
  return `${p.replace(/\/+$/, '')}.md`;
}

/** Normalise a page path to the trailing-slash form the registry uses. */
export function htmlPathOf(pathname: string): string {
  const p = pathname.startsWith('/') ? pathname : `/${pathname}`;
  if (/\.[a-z0-9]+$/i.test(p)) return p;
  return p.endsWith('/') ? p : `${p}/`;
}

/** The full markdown file: header, body, Related. */
export function renderDoc(doc: MdDoc, canonical: string): string {
  const head = [`# ${doc.title}`, '', `> ${doc.summary}`, '', `Canonical: ${canonical}`];
  if (doc.updated) head.push(`Last updated: ${doc.updated}`);
  const related = doc.related.length ? `## Related\n\n${list(doc.related)}` : '';
  return `${blocks(head.join('\n'), doc.body, related)}\n`;
}
