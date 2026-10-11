/** KaTeX at build time (§16). No client JS for math; output includes MathML. */
import katex from 'katex';

/**
 * Render `$…$` inline math segments. Non-math parts pass through unchanged
 * (ingest already strips all but sup/sub/i/em). Unknown macros render as
 * red-on-error text, never throwing the build.
 */
export function renderMath(text: string): string {
  const parts = text.split('$');
  // Odd count of `$` means unbalanced input: return as-is.
  if (parts.length % 2 === 0) return text;
  return parts
    .map((part, i) => {
      if (i % 2 === 0 || part.trim() === '') return part;
      try {
        return katex.renderToString(part, {
          throwOnError: false,
          output: 'htmlAndMathml',
          strict: false,
        });
      } catch {
        return part;
      }
    })
    .join('');
}

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Common paper macros KaTeX does not know (used only for quotes copied from paper LaTeX). */
const QUOTE_MACROS: Record<string, string> = {
  '\\R': '\\mathbb{R}',
  '\\N': '\\mathbb{N}',
  '\\Z': '\\mathbb{Z}',
  '\\Q': '\\mathbb{Q}',
  '\\C': '\\mathbb{C}',
  '\\F': '\\mathbb{F}',
  '\\T': '\\mathbb{T}',
  '\\PP': '\\mathbb{P}',
  '\\EE': '\\mathbb{E}',
  '\\eps': '\\varepsilon',
  '\\softO': '\\tilde{O}',
  '\\Lip': '\\operatorname{Lip}',
  '\\htop': 'h_{\\mathrm{top}}',
};

const DISPLAY_ENV = /^(equation|align|gather|multline|eqnarray|displaymath|flalign|alignat|math|dmath)\*?$/;

function katexQuote(tex: string, display: boolean): string {
  try {
    return katex.renderToString(tex, { throwOnError: false, output: 'htmlAndMathml', strict: false, displayMode: display, macros: { ...QUOTE_MACROS } });
  } catch {
    return escapeHtml(tex);
  }
}

/** Display-math body as KaTeX can render it: labels dropped, align-like environments → aligned. */
function displayBody(env: string, body: string): string {
  const b = body.replace(/\\(?:label|tag)\{[^}]*\}|\\(?:nonumber|notag|qedhere)/g, '').trim();
  const name = env.replace(/\*$/, '');
  if (/^(align|eqnarray|flalign)$/.test(name)) return `\\begin{aligned}${name === 'eqnarray' ? b.replace(/&([^&\\]*)&/g, '&$1') : b}\\end{aligned}`;
  if (name === 'alignat') return `\\begin{aligned}${b.replace(/^\{\d+\}/, '')}\\end{aligned}`;
  if (name === 'gather' || name === 'multline') return `\\begin{gathered}${b}\\end{gathered}`;
  return b;
}

/** Text between formulas: common LaTeX markup made readable, then escaped. */
function quoteText(s: string): string {
  const t = s
    .replace(/\\(?:emph|textit|textbf|textsc|texttt|textrm|textsf|textup|textnormal|mbox|text)\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g, '$1')
    .replace(/\{\\(?:em|it|bf|sc)\s+([^{}]*)\}/g, '$1')
    .replace(/---/g, '—')
    .replace(/--/g, '–')
    .replace(/``/g, '“')
    .replace(/''/g, '”')
    .replace(/`/g, '‘')
    .replace(/\\(?:ldots|dots|textellipsis)(?![a-zA-Z])\s?/g, '…')
    .replace(/\\S(?![a-zA-Z])\s?/g, '§')
    .replace(/\\([%&#_$])/g, '$1')
    .replace(/\\[ ,;:!]/g, ' ')
    .replace(/\\@/g, '')
    .replace(/\\(?:noindent|par|medskip|smallskip|bigskip|quad|qquad)(?![a-zA-Z])\s?/g, ' ')
    .replace(/[{}]/g, '')
    .replace(/ {2,}/g, ' ');
  return escapeHtml(t);
}

/**
 * A verbatim quote from a paper's LaTeX, made readable: citation commands
 * (\\cite{…}) are dropped, cross-references (\\ref{…}) shown as "…", common text
 * markup (\\emph, ``quotes'', --) turned into type, text escaped, and math rendered:
 * `$…$` / `\\(…\\)` inline, `\\[…\\]` / `$$…$$` / equation-like environments as display.
 * The stored quote stays exact, so source checks still match.
 */
export function renderQuote(text: string): string {
  const cleaned = text
    .replace(/~?\\(?:cite[a-z]*|label)\*?(?:\[[^\]]*\])*\{[^}]*\}/g, '')
    .replace(/\\(?:eqref)\*?\{[^}]*\}/g, '(…)')
    .replace(/\\(?:ref|cref|Cref|autoref|pageref)\*?\{[^}]*\}/g, '…')
    .replace(/(?<!\\)~/g, ' ')
    .replace(/\s+([,.;:])/g, '$1');
  // Unbalanced inline `$`: show the text as written rather than guess the math.
  const dollars = (cleaned.replace(/\\\$/g, '').replace(/\$\$/g, '').match(/\$/g) ?? []).length;
  if (dollars % 2 === 1) return escapeHtml(cleaned);
  let html = '';
  let last = 0;
  const re = /\\\[([\s\S]*?)\\\]|\$\$([\s\S]*?)\$\$|\\begin\{([a-zA-Z]+\*?)\}([\s\S]*?)\\end\{\3\}|\\\(([\s\S]*?)\\\)|(?<!\\)\$((?:[^$\\]|\\[\s\S])+?)\$/g;
  for (const m of cleaned.matchAll(re)) {
    const at = m.index ?? 0;
    if (m[3] !== undefined && !DISPLAY_ENV.test(m[3])) continue;
    html += quoteText(cleaned.slice(last, at));
    if (m[1] !== undefined) html += katexQuote(displayBody('', m[1]), true);
    else if (m[2] !== undefined) html += katexQuote(displayBody('', m[2]), true);
    else if (m[3] !== undefined) html += katexQuote(displayBody(m[3], m[4]), true);
    else html += katexQuote(m[5] ?? m[6], false);
    last = at + m[0].length;
  }
  return html + quoteText(cleaned.slice(last));
}
