/**
 * Global entry ids (§0): `<collection>-<NNN>`, e.g. `openai-math-2026-017`.
 * Collections may contain dashes, so the NNN suffix is the anchor.
 */

export function globalIdFor(collection: string, id: string): string {
  return `${collection}-${id}`;
}

export function parseGlobalId(gid: string): { collection: string; id: string } | null {
  const m = gid.match(/^(.+)-(\d{3})$/);
  if (!m) return null;
  return { collection: m[1], id: m[2] };
}
