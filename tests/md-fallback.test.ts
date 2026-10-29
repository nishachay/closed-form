import { describe, expect, it } from 'vitest';
import catalogJson from '../src/data/catalog.json';
import type { Catalog } from '../src/lib/catalog.js';
import { entryDoc, type MdContext } from '../src/lib/md/registry.js';
import { renderMd } from '../src/lib/md/registry.js';

/**
 * The "explainer still coming" fallback renders for a family with no entry.
 * Every catalogue family currently has an entry, so this path has no live
 * fixture: keep it pinned here instead of pointing e2e at a specific entry.
 */
describe('entry fallback rendering', () => {
  const catalog = catalogJson as unknown as Catalog;
  const family = catalog.families[0];
  const ctx: MdContext = { catalog, explained: new Map(), lastmod: new Map() };

  it('shows the paper summary and the still-coming notice', () => {
    const md = renderMd(entryDoc(ctx, family));
    expect(md).toContain('What the paper claims, in its own words');
    expect(md).toContain('The plain-language explainer for this entry is still coming.');
  });
});
