/** Field slugs: "Number theory" → "number-theory". */

export function slugify(subject: string): string {
  return subject
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
