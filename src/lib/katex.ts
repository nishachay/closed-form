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
