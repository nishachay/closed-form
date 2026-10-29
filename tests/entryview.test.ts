import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import catalogJson from '../src/data/catalog.json';
import type { Catalog } from '../src/lib/catalog.js';
import type { Entry } from '../src/lib/entry.js';
import {
  entryView,
  REVIEW_NOTE_CHECKED,
  REVIEW_NOTE_DRAFT,
  REVIEW_NOTE_SAMPLE,
} from '../src/lib/entryview.js';

const catalog = catalogJson as unknown as Catalog;
const family = catalog.families.find((f) => f.id === '017')!;
const load = (id: string) => JSON.parse(readFileSync(join(process.cwd(), `src/content/entries/${id}.json`), 'utf8')) as Entry;

/** Every review status gets wording that matches what was actually done (CLOSED_FORM.md §6.2). */
describe('review notice per status', () => {
  const base = load('017');
  const as = (status: Entry['status']) => entryView(family, { ...base, status });

  it('ai-draft entries do not promise a check that has not happened', () => {
    const v = as('ai-draft');
    expect(v.reviewNote).toBe(REVIEW_NOTE_DRAFT);
    expect(v.reviewNote).not.toContain('checked sentence by sentence');
    expect(v.reviewPill).toBe('Explained by AI');
  });

  it('ai-checked entries keep the second-model-check note', () => {
    const v = as('ai-checked');
    expect(v.reviewNote).toBe(REVIEW_NOTE_CHECKED);
    expect(v.reviewNote).toContain('checked sentence by sentence');
    expect(v.reviewPill).toBe('Explained by AI');
  });

  it('the hand-written sample says it was written by hand, not AI-made', () => {
    const v = as('sample');
    expect(v.reviewNote).toBe(REVIEW_NOTE_SAMPLE);
    expect(v.reviewPill).toBe('Sample entry');
  });

  it('reviewed entries show no AI notice', () => {
    const v = entryView(family, { ...base, status: 'reviewed', reviewedBy: 'A Person', reviewedAt: '2026-10-28' });
    expect(v.reviewNote).toBeNull();
    expect(v.reviewPill).toBeNull();
  });
});
