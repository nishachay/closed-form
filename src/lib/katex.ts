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

/**
 * A verbatim quote from a paper's LaTeX, made readable: citation commands
 * (\\cite{…}) and non-breaking tildes are dropped, text is escaped, and `$…$`
 * math is rendered. The stored quote stays exact, so source checks still match.
 */
export function renderQuote(text: string): string {
  const cleaned = text
    .replace(/~?\\(?:cite[a-z]*|ref|eqref|label)\*?(?:\[[^\]]*\])?\{[^}]*\}/g, '')
    .replace(/(?<!\\)~/g, ' ')
    .replace(/\s+([,.;:])/g, '$1');
  const parts = cleaned.split('$');
  if (parts.length % 2 === 0) return escapeHtml(cleaned);
  return parts.map((p, i) => (i % 2 === 0 ? escapeHtml(p) : renderMath(`$${p}$`))).join('');
}
