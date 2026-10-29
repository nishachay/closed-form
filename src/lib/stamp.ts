/** Project zones only: IST here is India Standard Time (+05:30). Anything else is rejected, not guessed. */
const TZ_OFFSET_MIN: Record<string, number> = {
  UTC: 0,
  GMT: 0,
  Z: 0,
  IST: 330,
};

/**
 * Epoch ms for a stored timestamp, or NaN. Accepts ISO 8601 (with Z or +hh:mm
 * offset, or date only) and the display text form "Wed 2026-10-07 7:18 PM IST".
 * Never compare these strings lexically: offsets and weekday names break the order.
 */
export function parseStamp(raw: string | undefined): number {
  if (!raw) return NaN;
  const iso = Date.parse(raw);
  if (/^\d{4}-\d{2}-\d{2}(T|$)/.test(raw)) {
    const [Y, M, D] = [Number(raw.slice(0, 4)), Number(raw.slice(5, 7)), Number(raw.slice(8, 10))];
    return !Number.isNaN(iso) && validCalendar(Y, M, D) ? iso : NaN;
  }
  const m = raw
    .trim()
    .match(
      /^(?:[A-Za-z]{3,9},?\s+)?(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?\s*([A-Za-z]{1,4}|[+-]\d{2}:?\d{2})?$/,
    );
  if (!m) return NaN;
  let h = Number(m[4]);
  if (m[7]) {
    const pm = m[7].toLowerCase() === "pm";
    if (h < 1 || h > 12) return NaN;
    h = (h % 12) + (pm ? 12 : 0);
  }
  let off = 0;
  const z = m[8];
  if (z) {
    if (/^[+-]/.test(z)) {
      const d = z.replace(":", "");
      off =
        (z[0] === "-" ? -1 : 1) *
        (Number(d.slice(1, 3)) * 60 + Number(d.slice(3, 5)));
    } else if (z.toUpperCase() in TZ_OFFSET_MIN)
      off = TZ_OFFSET_MIN[z.toUpperCase()];
    else return NaN;
  }
  const [Y, M, D, mi, se] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[5]), Number(m[6] ?? 0)];
  if (!validCalendar(Y, M, D) || h > 23 || mi > 59 || se > 59) return NaN;
  return Date.UTC(Y, M - 1, D, h, mi, se) - off * 60000;
}

/** Reject impossible calendar days (Feb 30, month 13) instead of letting them roll over. */
function validCalendar(Y: number, M: number, D: number): boolean {
  const c = new Date(Date.UTC(Y, M - 1, D));
  return c.getUTCFullYear() === Y && c.getUTCMonth() === M - 1 && c.getUTCDate() === D;
}

/** ISO date or date-time with an explicit zone (the canonical stored form). */
const ISO_STAMP = /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:\d{2}))?$/;

/**
 * Canonical stored form of a publishedAt value: ISO input is kept byte-for-byte,
 * the legacy text form ("Wed 2026-10-07 7:18 PM IST") is converted to UTC ISO,
 * anything else (or an impossible date) is rejected.
 */
export function normalizePublishedAt(raw: string): string | null {
  if (ISO_STAMP.test(raw)) return Number.isNaN(parseStamp(raw)) ? null : raw;
  const t = parseStamp(raw);
  return Number.isNaN(t)
    ? null
    : new Date(t).toISOString().replace(/\.\d+Z$/, "Z");
}
