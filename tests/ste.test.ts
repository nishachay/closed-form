import { describe, expect, it } from 'vitest';
import { countWords, entrySchema, splitSentences } from '../src/lib/entry.js';
import entry017 from '../src/content/entries/017.json';

// STE lint (§8): sentences ≤ 25 words (20 target, 25 hard fail), banned words.
describe('STE lint (§8, §18)', () => {
  const prose: [string, string][] = [
    ['headline', entry017.headline],
    ['scope', entry017.scope],
    ['plain', entry017.plain],
    ['doesNot', entry017.doesNot],
    ['hypeCheck', entry017.hypeCheck],
    ...entry017.sections.map(
      (s: { title: string; body: string }) => [`sections:${s.title}`, s.body] as [string, string],
    ),
  ];

  it('every sentence is ≤ 25 words', () => {
    for (const [name, text] of prose) {
      for (const s of splitSentences(text)) {
        expect(countWords(s), `${name}: ${s}`).toBeLessThanOrEqual(25);
      }
    }
  });

  it('contains no banned hype words', () => {
    const banned = [
      'revolutionary',
      'groundbreaking',
      'game-changing',
      'unprecedented',
      'breakthrough',
      'stunning',
      'mind-blowing',
      'historic',
      'finally',
      'solves forever',
    ];
    const all = prose.map(([, t]) => t).join(' ').toLowerCase();
    for (const w of banned) {
      if (w === 'solves forever') {
        expect(all.includes(w)).toBe(false);
      } else {
        expect(new RegExp(`\\b${w}\\b`).test(all), w).toBe(false);
      }
    }
  });

  it('schema enforces the 25-word hard fail', () => {
    const copy = JSON.parse(JSON.stringify(entry017));
    copy.plain =
      'This is a deliberately overlong sentence with far more than twenty five words in it to trigger the hard failure rule for testing purposes only here now today. Short one. Another short one.';
    expect(entrySchema.safeParse(copy).success).toBe(false);
  });
});
