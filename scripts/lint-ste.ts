/**
 * STE lint (§8) as a runnable script + importable module.
 *
 * Checks the writing rules over entry JSON: sentences ≤25 words (20 is the
 * target, 25 is the hard fail), no hype words. Exit 1 on errors.
 *
 * Usage:
 *   pnpm lint-ste [--entry <path>]   # default: all src/content/entries/*.json
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { HYPE_WORDS, countWords, splitSentences } from '../src/lib/entry.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export interface LintIssue {
  field: string;
  kind: 'long-sentence' | 'hype' | 'warning-long-sentence';
  message: string;
}

const HYPE_RE = new RegExp(
  HYPE_WORDS.filter((w) => w !== 'solves forever')
    .map((w) => `\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
    .join('|'),
  'i',
);

export function lintText(text: string, field: string): LintIssue[] {
  const issues: LintIssue[] = [];
  const lower = text.toLowerCase();
  if (lower.includes('solves forever')) {
    issues.push({ field, kind: 'hype', message: `${field} contains hype word: solves forever` });
  }
  const m = text.match(HYPE_RE);
  if (m) {
    issues.push({ field, kind: 'hype', message: `${field} contains hype word: ${m[0].toLowerCase()}` });
  }
  for (const s of splitSentences(text)) {
    const n = countWords(s);
    if (n > 25) {
      issues.push({ field, kind: 'long-sentence', message: `${field} sentence exceeds 25 words (${n}): ${s.slice(0, 80)}…` });
    } else if (n > 20) {
      issues.push({ field, kind: 'warning-long-sentence', message: `${field} sentence over 20-word target (${n}): ${s.slice(0, 80)}…` });
    }
  }
  return issues;
}

export function lintEntry(entry: Record<string, unknown>): LintIssue[] {
  const out: LintIssue[] = [];
  for (const key of ['headline', 'scope', 'plain', 'doesNot', 'hypeCheck']) {
    if (typeof entry[key] === 'string') out.push(...lintText(entry[key] as string, key));
  }
  const sc = (entry as { scorecard?: { significanceWhy?: unknown } }).scorecard;
  if (sc && typeof sc === 'object') {
    if (typeof sc.significanceWhy === 'string') {
      out.push(...lintText(sc.significanceWhy, 'scorecard.significanceWhy'));
    }
  }
  const sections = (entry as { sections?: { title?: unknown; body?: unknown }[] }).sections ?? [];
  sections.forEach((s, i) => {
    if (typeof s.body === 'string') {
      out.push(...lintText(s.body, `sections[${i}](${String(s.title ?? '?')})`));
    }
  });
  return out;
}

export function hasErrors(issues: LintIssue[]): boolean {
  return issues.some((i) => i.kind === 'hype' || i.kind === 'long-sentence');
}

export function formatIssues(id: string, issues: LintIssue[]): string {
  return issues.map((i) => `${id} [${i.kind}] ${i.message}`).join('\n');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const entryIdx = args.indexOf('--entry');
  const files =
    entryIdx >= 0 && args[entryIdx + 1]
      ? [args[entryIdx + 1]]
      : (await readdir(join(root, 'src/content/entries')))
          .filter((f) => f.endsWith('.json'))
          .map((f) => join(root, 'src/content/entries', f));

  let errors = 0;
  let warnings = 0;
  for (const file of files) {
    const entry = JSON.parse(await readFile(file, 'utf-8')) as Record<string, unknown>;
    const id = String((entry as { id?: unknown }).id ?? file);
    const issues = lintEntry(entry);
    if (issues.length > 0) console.log(formatIssues(id, issues));
    errors += issues.filter((i) => i.kind === 'hype' || i.kind === 'long-sentence').length;
    warnings += issues.filter((i) => i.kind === 'warning-long-sentence').length;
  }
  console.log(`lint-ste: ${files.length} entr${files.length === 1 ? 'y' : 'ies'}, ${errors} errors, ${warnings} warnings`);
  if (errors > 0) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
