import { z } from 'zod';

/**
 * Entry schema (§10) + Phase-1 extension:
 * collection, lab, science, field, aiRole, evidence[] on every entry.
 *
 * Multi-collection design: entries from any lab adapter validate here.
 * Catalog subject cross-check (field == catalog subject) lives in tests,
 * since the schema alone does not know the catalog.
 */

export const AI_ROLES = ['autonomous', 'ai-led', 'ai-assisted'] as const;
export type AiRole = (typeof AI_ROLES)[number];

export const EVIDENCE_KINDS = ['paper', 'lean', 'trace', 'other'] as const;

export const HYPE_WORDS = [
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
] as const;

export const ORIGIN_TEMPLATE =
  'This result comes from an unreleased OpenAI model, published in the openai/math release on 6 October 2026.';

function containsHype(text: string): string | null {
  const lower = text.toLowerCase();
  for (const w of HYPE_WORDS) {
    if (w === 'solves forever') {
      if (lower.includes('solves forever')) return w;
    } else {
      const re = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (re.test(text)) return w;
    }
  }
  return null;
}

/** Split into sentences on . ! ? … followed by space/end (keeps abbreviations simple). */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…]["”'’)\]]?)\s+(?=[A-Z0-9“"‘($])/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function countWords(sentence: string): number {
  return sentence.split(/\s+/).filter(Boolean).length;
}

function noHypeAndSentenceLength(fieldName: string) {
  return z.string().superRefine((val, ctx) => {
    const hype = containsHype(val);
    if (hype) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${fieldName} contains hype word: ${hype}` });
    }
    for (const s of splitSentences(val)) {
      const n = countWords(s);
      if (n > 25) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${fieldName} sentence exceeds 25 words (${n}): ${s.slice(0, 80)}…`,
        });
      }
    }
  });
}

export const evidenceSchema = z.object({
  kind: z.enum(EVIDENCE_KINDS),
  url: z.string().url(),
  label: z.string().min(1).max(200).optional(),
  note: z.string().max(500).optional(),
});

export const scorecardSchema = z.object({
  firstStep: z.string().min(1).max(20).optional(),
  firstStepBy: z.string().min(1).max(200).optional(),
  field: z.string().min(1),
  significance: z.enum(['Landmark', 'Major', 'Solid', 'Niche']),
  significanceWhy: z.string().min(1),
});

export const visualSchema = z.object({
  type: z.literal('record'),
  title: z.string().min(1),
  note: z.string().optional(),
  lowerIsBetter: z.boolean().optional(),
  points: z
    .array(
      z.object({
        year: z.number().int(),
        value: z.number(),
        who: z.string().min(1),
        claim: z.boolean().optional(),
        source: z.number().int(),
      }),
    )
    .min(1),
});

export const sectionTitles = ['The story', 'Why it matters', 'Where it leads', 'What it says about AI'] as const;

export const sectionSchema = z.object({
  title: z.string(),
  body: z.string().min(1),
});

export const glossarySchema = z.object({
  term: z.string().min(1),
  meaning: z.string().min(1),
});

export const sourceSchema = z.object({
  id: z.number().int(),
  cite: z.string().min(1),
  url: z.string().url().optional(),
  quote: z.string().optional(),
});

export const claimSchema = z.object({
  text: z.string().min(1),
  verdict: z.enum(['supported', 'external']),
  sourceLine: z.string().optional(),
  sourceId: z.number().int().optional(),
});

export const entrySchema = z
  .object({
    id: z.string().regex(/^\d{3}$/),
    status: z.enum(['sample', 'ai-draft', 'ai-checked', 'reviewed']),
    reviewedBy: z.string().optional(),
    reviewedAt: z.string().optional(),
    // Multi-collection identity (Phase-1 extension).
    collection: z.string().min(1),
    lab: z.string().min(1),
    science: z.string().min(1),
    field: z.string().min(1),
    aiRole: z.enum(AI_ROLES),
    evidence: z.array(evidenceSchema).min(1),

    headline: z.string().min(1).max(120),
    scope: noHypeAndSentenceLength('scope'),
    plain: noHypeAndSentenceLength('plain'),
    doesNot: z.string().min(1).refine((v) => v.startsWith('This does not'), {
      message: 'doesNot must start with "This does not"',
    }),
    origin: z.literal(ORIGIN_TEMPLATE),
    scorecard: scorecardSchema,
    visual: visualSchema.optional(),
    sections: z.array(sectionSchema).length(4),
    hypeCheck: noHypeAndSentenceLength('hypeCheck'),
    glossary: z.array(glossarySchema).min(3).max(8),
    sources: z.array(sourceSchema).min(1),
    claims: z.array(claimSchema).optional(),
    sourceHash: z.string().min(1),
    sourceCommit: z.string().min(1),
    model: z.object({ reader: z.string(), checker: z.string(), date: z.string() }).optional(),
  })
  .superRefine((val, ctx) => {
    // reviewed requires reviewer + date.
    if (val.status === 'reviewed') {
      if (!val.reviewedBy) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'reviewedBy required when status=reviewed', path: ['reviewedBy'] });
      }
      if (!val.reviewedAt) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'reviewedAt required when status=reviewed', path: ['reviewedAt'] });
      }
    }
    // Section titles exact + order.
    val.sections.forEach((s, i) => {
      if (s.title !== sectionTitles[i]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `sections[${i}].title must be "${sectionTitles[i]}", got "${s.title}"`,
          path: ['sections', i, 'title'],
        });
      }
      const hype = containsHype(s.body);
      if (hype) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `sections[${i}] contains hype word: ${hype}`,
          path: ['sections', i, 'body'],
        });
      }
      for (const sent of splitSentences(s.body)) {
        if (countWords(sent) > 25) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `sections[${i}] sentence exceeds 25 words`,
            path: ['sections', i, 'body'],
          });
          break;
        }
      }
    });
    // Headline/plain/doesNot hype + length.
    for (const [key, text] of [
      ['headline', val.headline],
      ['plain', val.plain],
      ['doesNot', val.doesNot],
    ] as const) {
      const hype = containsHype(text);
      if (hype) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${key} contains hype word: ${hype}`, path: [key] });
      }
    }
    for (const s of splitSentences(val.plain)) {
      if (countWords(s) > 25) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'plain sentence exceeds 25 words', path: ['plain'] });
        break;
      }
    }
    // plain must be 3–5 sentences.
    const plainCount = splitSentences(val.plain).length;
    if (plainCount < 3 || plainCount > 5) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `plain must be 3–5 sentences, got ${plainCount}`,
        path: ['plain'],
      });
    }
    // firstStep/firstStepBy need a sources entry.
    if ((val.scorecard.firstStep ?? val.scorecard.firstStepBy) && val.sources.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'firstStep needs a matching sources entry', path: ['scorecard', 'firstStep'] });
    }
    // visual sources must exist.
    if (val.visual) {
      const ids = new Set(val.sources.map((s) => s.id));
      for (const p of val.visual.points) {
        if (!ids.has(p.source)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `visual point source ${p.source} missing from sources`, path: ['visual'] });
          break;
        }
      }
    }
    // Top-level field must match scorecard.field (both must equal catalog subject — checked in tests).
    if (val.field !== val.scorecard.field) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `field "${val.field}" must equal scorecard.field "${val.scorecard.field}"`, path: ['field'] });
    }
  });

export type Entry = z.infer<typeof entrySchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
