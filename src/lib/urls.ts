/**
 * URL helpers with no Astro imports, so vitest can cover them.
 * BASE_URL/SITE come from Astro at build time; production fallbacks apply.
 */

export const PRODUCTION_SITE = 'https://nishachay.github.io';

/** Base prefix without trailing slash ('' when hosted at root). */
export function basePrefix(): string {
  const base = import.meta.env.BASE_URL || '/';
  if (base === '/') return '';
  return base.endsWith('/') ? base.slice(0, -1) : base;
}

/** Prefix an app-absolute path with the configured base (GH Pages safe). */
export function appUrl(path: string): string {
  const b = basePrefix();
  return `${b}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Absolute URL for share links and canonical tags. Idempotent: paths that
 * already carry the base (e.g. from entryUrl/fieldUrl) are not prefixed twice. */
export function absoluteUrl(path: string): string {
  const site = ((import.meta.env.SITE as string | undefined) ?? PRODUCTION_SITE).replace(
    /\/$/,
    '',
  );
  const b = basePrefix();
  const rooted = path.startsWith('/') ? path : `/${path}`;
  const once = b !== '' && (rooted === b || rooted.startsWith(`${b}/`)) ? rooted : `${b}${rooted}`;
  return `${site}${once}`;
}
