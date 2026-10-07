/**
 * Trust ladder (§6.1 + §0).
 * The single ordered source: formal → partial → claimed.
 * New levels later slot into TRUST_LADDER; every consumer iterates it,
 * so legends, filters and maps pick them up with no code change.
 */
import type { TrustKey } from '../../ingest/types.js';

export interface TrustLevel {
  key: string;
  /** Long label shown on entries, legends and filters. */
  label: string;
  /** Compact label for tight rows. */
  short: string;
}

export const TRUST_LADDER: TrustLevel[] = [
  { key: 'formal', label: 'Formal proof listed', short: 'Formal proof' },
  { key: 'partial', label: 'Partly formalized', short: 'Partly' },
  { key: 'claimed', label: 'Claimed, not checked', short: 'Not checked' },
];

export function trustLevel(key: string): TrustLevel {
  return TRUST_LADDER.find((t) => t.key === key) ?? { key, label: key, short: key };
}

/** CSS class suffix for dots, cells and badges. */
export function trustClass(key: string): string {
  return (TRUST_LADDER.some((t) => t.key === key) ? key : 'claimed') as TrustKey;
}
