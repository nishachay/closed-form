/**
 * The one registry of markdown twins: every public, indexable HTML route has a
 * renderer here that builds its .md version from the same catalog + entry data
 * the page uses (never from the HTML). Served by src/pages/[...md].md.ts, listed
 * in llms.txt / llms-full.txt, and linked from each page's <head> (Base.astro).
 *
 * Keys are route files under src/pages without extension ("e/[gid]"). A route
 * with no renderer must be in MD_SKIP with a reason (tests/md.test.ts checks).
 * No Astro imports, so vitest renders every page here.
 */
import type { Catalog, Family } from '../catalog.js';
import type { Entry } from '../entry.js';
import { parseCitations } from '../cite.js';
import { formatLongDay } from '../dates.js';
import { cleanCite, entryView, leanHref, shortReason } from '../entryview.js';
import { collectionName, computeStats, entryUrl, fieldUrl, labName, scienceName } from '../names.js';
import {
  ABOUT_DESCRIPTION,
  archiveDescription,
  collectionDescription,
  fieldDescription,
  fieldRelated,
  homeDescription,
  hubMeta,
  hubRelated,
  labDescription,
  scienceDescription,
  topFields,
  TOPIC_GROUPS,
  topicsDescription,
  TRUST_MEANING,
} from '../pagemeta.js';
import { buildHubs, clipDescription, entryDescription, HUB_KIND_LABEL, hubIntro, hubsForId, plainTitle, relatedIds, type Hub, type HubKind } from '../seo.js';
import { slugify } from '../slug.js';
import { TRUST_LADDER, trustLevel } from '../trust.js';
import { absoluteUrl } from '../urls.js';
import { blocks, inline, list, mdLink, type MdDoc, type MdLink, paperQuote, quote, renderDoc, section } from './format.js';

export interface MdContext {
  catalog: Catalog;
  /** Explained entries by NNN id. */
  explained: Map<string, Entry>;
  /** Site path → ISO date the page content last changed (src/lib/lastmod.ts). May be empty. */
  lastmod: Map<string, string>;
  /**
   * Hub and field pages list their results as entry numbers only (llms-full.txt,
   * where the archive page already lists every result with its title and summary).
   */
  compact?: boolean;
}

export interface MdRoute {
  /** Route file under src/pages, without extension. */
  route: string;
  docs(ctx: MdContext): MdDoc[];
}

/** Public routes that deliberately have no markdown twin. */
export const MD_SKIP: Record<string, string> = {
  '404': 'Error page, noindex.',
};

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------

const abs = (path: string) => absoluteUrl(path);
const sorted = (c: Catalog) => [...c.families].sort((a, b) => a.id.localeCompare(b.id));
const day = (ctx: MdContext, path: string) => ctx.lastmod.get(path)?.slice(0, 10);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** Headline or claim text for one result, as one line. */
const oneLine = (f: Family, e: Entry | undefined) => inline(e?.headline ?? clipDescription(f.summary, 200));

function resultLink(ctx: MdContext, f: Family, note?: string): MdLink {
  return {
    title: plainTitle(f),
    url: abs(entryUrl(f, ctx.catalog.collection)),
    note: note ?? `Entry ${f.id} · ${oneLine(f, ctx.explained.get(f.id))} (${trustLevel(f.trust).label})`,
  };
}

const hubLink = (h: Hub, note?: string): MdLink => ({
  title: h.name,
  url: abs(h.path),
  note: note ?? `${HUB_KIND_LABEL[h.kind]} · ${plural(h.ids.length, 'result')}`,
});

const fieldLink = (ctx: MdContext, subject: string, note?: string): MdLink => ({
  title: subject,
  url: abs(fieldUrl(subject, ctx.catalog.science)),
  note: note ?? `Field · ${plural(ctx.catalog.families.filter((f) => f.subject === subject).length, 'result')}`,
});

const core = {
  home: { title: 'Home', url: abs('/') },
  archive: { title: 'Archive of all results', url: abs('/archive/') },
  topics: { title: 'Browse by topic', url: abs('/topics/') },
  about: { title: 'About and methodology', url: abs('/about/') },
};

/** Intro parts (hubIntro) as markdown, linking entry titles. */
function introMd(ctx: MdContext, parts: ReturnType<typeof hubIntro>): string {
  const byId = new Map(ctx.catalog.families.map((f) => [f.id, f]));
  return parts
    .map((p) => {
      const f = p.id ? byId.get(p.id) : undefined;
      return f ? mdLink(p.text, abs(entryUrl(f, ctx.catalog.collection))) : p.text;
    })
    .join('')
    .trim();
}

const hubsOf = (ctx: MdContext) => buildHubs(ctx.catalog, ctx.explained);

/** The results on a hub or field page: a full list, or entry numbers only in compact mode. */
function resultsSection(ctx: MdContext, fams: Family[]): string {
  if (!ctx.compact) return section(`Results (${fams.length})`, list(fams.map((f) => resultLink(ctx, f))));
  return section(
    `Results (${fams.length})`,
    `Entries ${fams.map((f) => f.id).join(', ')}.`,
    `Titles and one-line summaries are in the archive (${abs('/archive/')}). Entry NNN is at ${abs(`/e/${ctx.catalog.collection}-`)}NNN/ (markdown: ${abs(`/e/${ctx.catalog.collection}-`)}NNN.md).`,
  );
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

function homeDoc(ctx: MdContext): MdDoc {
  const { catalog } = ctx;
  const stats = computeStats(catalog.families);
  const explained = [...ctx.explained.values()];
  const byId = new Map(catalog.families.map((f) => [f.id, f]));
  const latest = [...explained]
    .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '') || b.id.localeCompare(a.id))
    .slice(0, 2)
    .map((e) => byId.get(e.id))
    .filter((f): f is Family => !!f);
  const body = blocks(
    `An OpenAI model released ${stats.papers} research papers on open problems in mathematics. Closed Form explains each one in plain words: what it proves, why it matters and how far you can trust it.`,
    [
      `- **Papers:** ${stats.papers} released by the model`,
      `- **Results:** ${stats.results} after merging related papers`,
      `- **Formal proofs:** ${stats.formalPapers} papers with a Lean proof listed`,
      `- **Explained:** ${explained.length} of ${stats.results} in plain words so far`,
    ].join('\n'),
    section(
      'Browse by field',
      list([...catalog.subjects.map((s) => fieldLink(ctx, s)), { title: 'All fields', url: abs('/archive/'), note: `${stats.results} results in the archive` }]),
    ),
    latest.length > 0 &&
      section(
        'Latest explained',
        list(latest.map((f) => resultLink(ctx, f, `Entry ${f.id} · ${f.subject} · ${inline(ctx.explained.get(f.id)!.headline)} (${trustLevel(f.trust).label})`))),
        `[Read all explained](${abs('/archive/?trust=explained')})`,
      ),
  );
  return {
    path: '/',
    title: 'Every problem AI has solved, explained for everyone.',
    summary: clipDescription(homeDescription(stats)),
    updated: day(ctx, '/'),
    body,
    related: [core.archive, core.topics, core.about, { title: 'llms.txt', url: abs('/llms.txt') }],
  };
}

/** About page copy. Kept word for word with src/pages/about.astro (tests/md.test.ts checks). */
export const ABOUT_COPY = {
  headline: 'AI now writes research mathematics faster than people can read it. We translate it.',
  meta: ['Plain English inspired by ASD-STE100', 'Honest trust labels', 'Every claim linked to its source'],
  lead: 'Each entry explains one result in plain words. It is not a summary. It tries to make you understand what the result says and why it was hard, starting from an example you can check yourself.',
  explain: [
    'Every explanation is one piece of continuous prose, not a form with fixed headings. It starts small: real numbers, a shape, or the simplest case where the claim already bites. Then it shows what people knew before and where they got stuck.',
    'Next it names the one difficulty that made the problem hard, and says in ordinary words how the paper gets around it. We leave out the proof machinery. Any technical word is explained the first time it appears.',
    'It ends with what the result does not say, and how far it has been checked. If we cannot make an idea clear without inventing something, we say so and stop.',
  ],
  around: 'The facts stay separate and checkable: numbered sources, quotes matched word for word to the paper, a glossary, and a hype check.',
  trustIntro: 'Every result carries one label. It tells you how much checking stands behind the claim, not how important it is.',
  dont: 'We don’t call a result true because a company published it. Many mathematicians have asked for careful review of AI results, and we agree.',
  everyEntry: 'A hype check that says plainly how far the claim has been checked, and a direct link to the original paper.',
  steps: [
    ['Draft.', 'One AI model writes the explanation from the paper’s source and the published release. Every number in a worked example is computed, not guessed.'],
    ['Check.', 'A different AI model matches every fact to a line in the paper and recomputes the examples. Anything it can’t match is cut.'],
    ['Correct.', 'Anyone can report an error. Fixes are made in the open on GitHub.'],
  ],
} as const;

function aboutDoc(ctx: MdContext): MdDoc {
  const count = (k: string) => ctx.catalog.families.filter((f) => f.trust === k).length;
  const a = ABOUT_COPY;
  const body = blocks(
    `**${a.headline}**`,
    a.meta.join(' · '),
    a.lead,
    section('How we explain', ...a.explain, `**Around every explanation.** ${a.around}`),
    section(
      'Trust labels',
      a.trustIntro,
      TRUST_LADDER.map((t) => `- **${t.label}** (${plural(count(t.key), 'result')}): ${TRUST_MEANING[t.key] ?? ''}`).join('\n'),
    ),
    section('What we don’t do', a.dont, `**On every entry.** ${a.everyEntry}`),
    section('How entries are made', a.steps.map(([b, t], i) => `${i + 1}. **${b}** ${t}`).join('\n')),
  );
  return {
    path: '/about/',
    title: 'Why Closed Form exists',
    summary: clipDescription(ABOUT_DESCRIPTION),
    updated: day(ctx, '/about/'),
    body,
    related: [
      core.home,
      core.archive,
      ...hubsOf(ctx).filter((h) => h.kind === 'trust').map((h) => hubLink(h)),
      { title: 'Report a problem', url: 'https://github.com/nishachay/closed-form/issues/new' },
    ],
  };
}

/** Results grouped by field, as on the archive and collection pages. */
function resultsByField(ctx: MdContext, fams: Family[], level = '###'): string {
  return ctx.catalog.subjects
    .map((s) => {
      const items = fams.filter((f) => f.subject === s);
      if (!items.length) return '';
      return `${level} ${s} (${items.length})\n\n${list(items.map((f) => resultLink(ctx, f)))}`;
    })
    .filter(Boolean)
    .join('\n\n');
}

function archiveDoc(ctx: MdContext): MdDoc {
  const fams = sorted(ctx.catalog);
  return {
    path: '/archive/',
    title: 'All results',
    summary: clipDescription(archiveDescription(fams.length)),
    updated: day(ctx, '/archive/'),
    body: blocks(
      'Every result in the release, grouped by field. Search by name or topic, or filter by how far you can trust it.',
      `Machine-readable: ${mdLink('all entries as JSON', abs('/data/entries.json'))}, ${mdLink('catalog as JSON', abs('/data/catalog.json'))}.`,
      section('Results by field', resultsByField(ctx, fams)),
    ),
    related: [core.topics, ...ctx.catalog.subjects.map((s) => fieldLink(ctx, s))],
  };
}

function topicsDoc(ctx: MdContext): MdDoc {
  const hubs = hubsOf(ctx);
  const n = ctx.catalog.families.length;
  const fields = ctx.catalog.subjects
    .map((s) => ({ s, n: ctx.catalog.families.filter((f) => f.subject === s).length }))
    .sort((a, b) => b.n - a.n);
  return {
    path: '/topics/',
    title: 'Browse by topic',
    summary: clipDescription(topicsDescription(n)),
    updated: day(ctx, '/topics/'),
    body: blocks(
      `${n} results, grouped by what they are about, how long the question was open, how important they are and how far you can trust them.`,
      ...TOPIC_GROUPS.map((g) => {
        const items = hubs.filter((h) => h.kind === g.kind);
        return items.length > 0 && section(g.title, list(items.map((h) => hubLink(h))));
      }),
      section('Fields of mathematics', list(fields.map((f) => fieldLink(ctx, f.s)))),
    ),
    related: [core.home, core.archive],
  };
}

function hubDoc(ctx: MdContext, hub: Hub): MdDoc {
  const byId = new Map(ctx.catalog.families.map((f) => [f.id, f]));
  const fams = hub.ids.map((id) => byId.get(id)).filter((f): f is Family => !!f);
  const { scope, description } = hubMeta(hub, fams);
  const parts = hubIntro(fams, ctx.explained, { scope, showFields: true });
  return {
    path: hub.path,
    title: hub.heading,
    summary: clipDescription(description),
    updated: day(ctx, hub.path),
    body: blocks(hub.blurb, introMd(ctx, parts), resultsSection(ctx, fams)),
    related: [
      ...hubRelated(hubsOf(ctx), hub).map((h) => hubLink(h)),
      ...topFields(fams).map(([s, c]) => fieldLink(ctx, s, `Field · ${c} here`)),
      { title: 'All topics', url: abs('/topics/'), note: 'Every way to browse' },
    ],
  };
}

const hubRoute = (route: string, kind: HubKind): MdRoute => ({
  route,
  docs: (ctx) => hubsOf(ctx).filter((h) => h.kind === kind).map((h) => hubDoc(ctx, h)),
});

function fieldDoc(ctx: MdContext, subject: string): MdDoc {
  const { catalog } = ctx;
  const fams = sorted(catalog).filter((f) => f.subject === subject);
  const path = `/science/${catalog.science}/${slugify(subject)}/`;
  const parts = hubIntro(fams, ctx.explained, { scope: `in ${subject.toLowerCase()}` });
  const { related, otherFields } = fieldRelated(catalog, hubsOf(ctx), subject);
  return {
    path,
    title: subject,
    summary: clipDescription(fieldDescription(subject, fams.length)),
    updated: day(ctx, path),
    body: blocks(`${fams.length} results in ${collectionName(catalog.collection)}.`, introMd(ctx, parts), resultsSection(ctx, fams)),
    related: [
      ...related.map(({ h, o }) => hubLink(h, `${HUB_KIND_LABEL[h.kind]} · ${o} here`)),
      ...otherFields.map((f) => fieldLink(ctx, f.s)),
      { title: scienceName(catalog.science), url: abs(`/science/${catalog.science}/`) },
      { title: 'All topics', url: abs('/topics/'), note: 'Every way to browse' },
    ],
  };
}

function collectionLink(ctx: MdContext): MdLink {
  const { catalog } = ctx;
  const stats = computeStats(catalog.families);
  return {
    title: collectionName(catalog.collection),
    url: abs(`/collection/${catalog.collection}/`),
    note: `${labName(catalog.lab)} · ${scienceName(catalog.science)} · ${stats.results} results · ${stats.papers} papers`,
  };
}

function collectionDoc(ctx: MdContext): MdDoc {
  const { catalog } = ctx;
  const stats = computeStats(catalog.families);
  const path = `/collection/${catalog.collection}/`;
  return {
    path,
    title: collectionName(catalog.collection),
    summary: clipDescription(collectionDescription(stats)),
    updated: day(ctx, path),
    body: blocks(
      `${stats.results} results in ${stats.papers} papers across ${catalog.subjects.length} fields. Released by ${labName(catalog.lab)} in the ${mdLink(catalog.source.repo, `https://github.com/${catalog.source.repo}`)} repository.`,
      [`- **Papers:** ${stats.papers}`, `- **Results:** ${stats.results}`, `- **Formal proofs:** ${stats.formalPapers}`, `- **Fields:** ${catalog.subjects.length}`].join('\n'),
      section('Fields', list(catalog.subjects.map((s) => fieldLink(ctx, s)))),
      section('All results in this collection', resultsByField(ctx, sorted(catalog))),
    ),
    related: [
      { title: scienceName(catalog.science), url: abs(`/science/${catalog.science}/`) },
      { title: labName(catalog.lab), url: abs(`/lab/${catalog.lab}/`) },
      core.archive,
    ],
  };
}

function labDoc(ctx: MdContext): MdDoc {
  const { catalog } = ctx;
  const stats = computeStats(catalog.families);
  const path = `/lab/${catalog.lab}/`;
  return {
    path,
    title: labName(catalog.lab),
    summary: clipDescription(labDescription(labName(catalog.lab))),
    updated: day(ctx, path),
    body: blocks(
      `${stats.results} results from ${stats.papers} papers across ${catalog.subjects.length} fields of ${scienceName(catalog.science).toLowerCase()}.`,
      section('Collections', list([collectionLink(ctx)])),
    ),
    related: [{ title: scienceName(catalog.science), url: abs(`/science/${catalog.science}/`) }, core.archive],
  };
}

function scienceDoc(ctx: MdContext): MdDoc {
  const { catalog } = ctx;
  const stats = computeStats(catalog.families);
  const path = `/science/${catalog.science}/`;
  return {
    path,
    title: scienceName(catalog.science),
    summary: clipDescription(scienceDescription(scienceName(catalog.science))),
    updated: day(ctx, path),
    body: blocks(
      `${stats.results} results from ${stats.papers} papers across ${catalog.subjects.length} fields.`,
      section('Collections', list([collectionLink(ctx)])),
      section('Fields', list(catalog.subjects.map((s) => fieldLink(ctx, s)))),
    ),
    related: [{ title: labName(catalog.lab), url: abs(`/lab/${catalog.lab}/`) }, core.archive, core.topics],
  };
}

/** Inline citation markers [k] → the reading-order numbers the page shows, as "[n]". */
function citeMd(text: string, order: Map<number, number>): string {
  let out = '';
  let last = 0;
  for (const m of parseCitations(text)) {
    const nums = m.claims.map((c) => order.get(c)).filter((n): n is number => n !== undefined);
    out += text.slice(last, m.index) + (nums.length ? `[${nums.join(',')}]` : '');
    last = m.index + m.raw.length;
  }
  return out + text.slice(last);
}

export function entryDoc(ctx: MdContext, f: Family): MdDoc {
  const { catalog } = ctx;
  const e = ctx.explained.get(f.id) ?? null;
  const v = entryView(f, e);
  const path = entryUrl(f, catalog.collection);
  const n = f.papers.length;
  const meta = [
    `**Trust:** ${trustLevel(f.trust).label}`,
    `**Papers:** ${n}`,
    v.firstDate && `**First paper:** ${formatLongDay(v.firstDate)}`,
    v.latestDate && v.latestDate !== v.firstDate && `**Latest paper:** ${formatLongDay(v.latestDate)}`,
    `**Field:** ${f.subject}`,
    `**Entry:** ${f.id}`,
  ].filter(Boolean);
  const withdrawn = f.withdrawn ?? [];
  const withdrawnNote =
    withdrawn.length > 0 &&
    `**Update.** OpenAI withdrew ${withdrawn.length === 1 ? 'one paper' : `${withdrawn.length} papers`} from this result${withdrawn[0]?.withdrawnOn ? ` on ${formatLongDay(withdrawn[0].withdrawnOn)}` : ''} after finding a gap in a proof.`;

  const lean = leanHref(f);
  const original = section(
    `The original ${n === 1 ? 'paper' : `papers (${n})`}`,
    f.papers
      .map((p) => {
        const bits = [p.date && formatLongDay(p.date), p.lean && 'Formal proof listed'].filter(Boolean);
        return `- ${mdLink(p.title, p.pdf)}${bits.length ? ` - ${bits.join(' · ')}` : ''}`;
      })
      .join('\n'),
    [lean && `- ${mdLink('Lean notes', lean)}`, f.trace && `- ${mdLink("Model's reasoning summary", f.trace)}`].filter(Boolean).join('\n'),
    withdrawn.length > 0 &&
      `### Withdrawn by OpenAI\n\n${withdrawn
        .map(
          (w) =>
            `- ~~${inline(w.title)}~~ (withdrawn${w.withdrawnOn ? ` ${formatLongDay(w.withdrawnOn)}` : ''}): ${shortReason(w.reason)} ${[mdLink('Withdrawal notice', w.notice), w.archivedPdf && mdLink('Archived PDF', w.archivedPdf)].filter(Boolean).join(' · ')}`,
        )
        .join('\n')}`,
  );

  let body: string;
  if (e) {
    const sc = e.scorecard;
    const glance = [
      `- **First step:** ${sc.firstStep ?? '—'}${sc.firstStepBy ? ` (${sc.firstStepBy})` : ''}`,
      `- **Significance:** ${sc.significance}. ${sc.significanceWhy}`,
      `- **Trust:** ${trustLevel(f.trust).label}`,
      `- **Field:** ${sc.field} (${plural(n, 'paper')})`,
    ].join('\n');
    const chart =
      e.visual &&
      blocks(
        `**${e.visual.title}**`,
        ['| Year | Who | Value |', '| --- | --- | --- |', ...e.visual.points.map((p) => `| ${p.year} | ${p.who.replace(/\|/g, '\\|')} | ${p.value}${p.claim ? ' (this result)' : ''} |`)].join('\n'),
        e.visual.note,
      );
    const limit = `**What it doesn't show.** ${e.doesNot}`;
    const prose =
      v.paragraphs.length > 0
        ? blocks(
            section('The explanation', ...v.paragraphs.map((p) => citeMd(p, v.citeOrder)), limit),
            section('Where it came from', v.aiSection?.body, e.origin),
          )
        : blocks(
            ...v.sections
              .filter((s) => s.title !== 'What it says about AI')
              .map((s) => section(s.title, s.body, s.title === 'Why it matters' && limit)),
            ...v.sections.filter((s) => s.title === 'What it says about AI').map((s) => section(s.title, s.body, e.origin)),
          );
    const quoted =
      v.cited.length > 0 &&
      section(
        `Quoted lines from the paper (${v.cited.length})`,
        v.cited
          .map((c) => `[${c.n}] From ${c.paper.href ? mdLink(c.paper.name, c.paper.href) : c.paper.name}:\n\n${quote(paperQuote(c.quote))}`)
          .join('\n\n'),
      );
    const others =
      v.otherSources.length > 0 &&
      section(
        'Other sources',
        v.anyUnchecked && 'Sources marked (unchecked) have not yet been checked against the original text.',
        v.otherSources
          .map((s) => {
            const c = cleanCite(s.cite);
            const href = s.url ?? c.href;
            const unchecked = c.unchecked && e.status !== 'reviewed' ? ' (unchecked)' : '';
            return `- ${href ? `[${c.text.replace(/([[\]])/g, '\\$1')}](${href})` : c.text}${unchecked}${s.quote ? `: “${paperQuote(s.quote)}”` : ''}`;
          })
          .join('\n'),
      );
    body = blocks(
      `**${e.headline}**`,
      meta.join(' · '),
      v.reviewNote && `*${v.reviewPill}.* ${v.reviewNote}`,
      withdrawnNote,
      e.plain,
      section('At a glance', glance),
      chart,
      prose,
      section('Hype check', e.hypeCheck),
      section('Words used', e.glossary.map((g) => `- **${g.term}:** ${g.meaning}`).join('\n')),
      original,
      quoted,
      others,
    );
  } else {
    body = blocks(
      meta.join(' · '),
      withdrawnNote,
      section('What the paper claims, in its own words', inline(f.summary)),
      'The plain-language explainer for this entry is still coming.',
      original,
    );
  }

  const related = relatedIds(catalog, ctx.explained, f.id, 5, 3)
    .map((id) => catalog.families.find((x) => x.id === id))
    .filter((x): x is Family => !!x);
  const hubs = hubsForId(hubsOf(ctx), f.id);
  return {
    path,
    title: inline(f.title),
    summary: entryDescription(f, e),
    updated: day(ctx, path),
    body,
    related: [
      ...related.map((r) => resultLink(ctx, r, r.subject)),
      fieldLink(ctx, f.subject),
      ...hubs.map((h) => hubLink(h)),
      { title: 'Report an error', url: `https://github.com/nishachay/closed-form/issues/new?template=report-error.yml&labels=entry-error&title=${encodeURIComponent(`[entry ${f.id}] `)}` },
    ],
  };
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const MD_ROUTES: MdRoute[] = [
  { route: 'index', docs: (ctx) => [homeDoc(ctx)] },
  { route: 'about', docs: (ctx) => [aboutDoc(ctx)] },
  { route: 'archive', docs: (ctx) => [archiveDoc(ctx)] },
  { route: 'topics', docs: (ctx) => [topicsDoc(ctx)] },
  { route: 'e/[gid]', docs: (ctx) => sorted(ctx.catalog).map((f) => entryDoc(ctx, f)) },
  hubRoute('topic/[slug]', 'topic'),
  hubRoute('open-since/[slug]', 'era'),
  hubRoute('trust/[slug]', 'trust'),
  hubRoute('significance/[slug]', 'significance'),
  { route: 'science/[science]', docs: (ctx) => [scienceDoc(ctx)] },
  { route: 'science/[science]/[field]', docs: (ctx) => ctx.catalog.subjects.map((s) => fieldDoc(ctx, s)) },
  { route: 'collection/[collection]', docs: (ctx) => [collectionDoc(ctx)] },
  { route: 'lab/[lab]', docs: (ctx) => [labDoc(ctx)] },
];

const docCache = new WeakMap<MdContext, MdDoc[]>();
/** Every markdown page, in registry order. */
export function allDocs(ctx: MdContext): MdDoc[] {
  const hit = docCache.get(ctx);
  if (hit) return hit;
  const out = MD_ROUTES.flatMap((r) => r.docs(ctx));
  docCache.set(ctx, out);
  return out;
}

/** The finished .md file for one page. */
export const renderMd = (doc: MdDoc) => renderDoc(doc, abs(doc.path));
