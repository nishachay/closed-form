/**
 * Plain-text versions of titles and summaries for places that cannot render math:
 * <title>, meta/OG descriptions, OG images, RSS and X share text.
 * Converts common inline TeX ($...$) to readable Unicode; never throws.
 */
const GREEK: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ', eta: 'η',
  theta: 'θ', vartheta: 'ϑ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π',
  rho: 'ρ', sigma: 'σ', tau: 'τ', upsilon: 'υ', phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
};
const SYMBOLS: Record<string, string> = {
  le: ' ≤ ', leq: ' ≤ ', ge: ' ≥ ', geq: ' ≥ ', lt: ' < ', gt: ' > ', ne: ' ≠ ', neq: ' ≠ ', to: ' → ', rightarrow: ' → ',
  mapsto: '↦', infty: '∞', in: ' ∈ ', notin: '∉', subset: '⊂', subseteq: ' ⊆ ', supset: '⊃', cup: '∪', cap: '∩',
  times: '×', cdot: '·', ldots: '…', cdots: '…', dots: '…', pm: '±', approx: ' ≈ ', sim: '∼', equiv: ' ≡ ',
  ll: '≪', gg: '≫', partial: '∂', nabla: '∇', forall: '∀', exists: '∃', emptyset: '∅', varnothing: '∅',
  sum: 'Σ', prod: 'Π', int: '∫', otimes: '⊗', oplus: '⊕', setminus: '∖', mid: '|', vert: '|', ell: 'ℓ',
  Re: 'Re', Im: 'Im', log: ' log ', ln: ' ln ', exp: ' exp ', sin: ' sin ', cos: ' cos ', max: ' max ', min: ' min ',
  lim: ' lim ', sup: ' sup ', inf: ' inf ', det: ' det ', deg: ' deg ', gcd: ' gcd ', dim: ' dim ', ker: ' ker ',
  quad: ' ', qquad: ' ', ',': ' ', ';': ' ', '!': '', ' ': ' ', left: '', right: '', big: '', Big: '',
  langle: '⟨', rangle: '⟩', lfloor: '⌊', rfloor: '⌋', lceil: '⌈', rceil: '⌉', '{': '{', '}': '}',
  '%': '%', '#': '#', '&': '&', '_': '_', star: '⋆', circ: '∘', prime: '′',
};
const BB: Record<string, string> = { N: 'ℕ', Z: 'ℤ', Q: 'ℚ', R: 'ℝ', C: 'ℂ', F: '𝔽', P: 'ℙ', A: '𝔸', H: 'ℍ' };
const SUP: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', n: 'ⁿ', i: 'ⁱ', k: 'ᵏ', '*': '*', '′': '′',
};
const SUB: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎', n: 'ₙ', i: 'ᵢ', k: 'ₖ', p: 'ₚ', j: 'ⱼ', m: 'ₘ',
};

/** Read one TeX argument ({...} or single token) starting at i; returns [text, nextIndex]. */
function readArg(s: string, i: number): [string, number] {
  while (s[i] === ' ') i++;
  if (s[i] === '{') {
    let depth = 0;
    for (let j = i; j < s.length; j++) {
      if (s[j] === '{') depth++;
      else if (s[j] === '}' && --depth === 0) return [s.slice(i + 1, j), j + 1];
    }
    return [s.slice(i + 1), s.length];
  }
  if (s[i] === '\\') {
    const m = /^\\([A-Za-z]+|.)/.exec(s.slice(i));
    if (m) return [m[0], i + m[0].length];
  }
  return [s[i] ?? '', i + 1];
}

function script(t: string, map: Record<string, string>, mark: string): string {
  const chars = [...t];
  if (chars.every((c) => map[c])) return chars.map((c) => map[c]).join('');
  return t.length === 1 ? `${mark}${t}` : `${mark}(${t})`;
}

/** Convert a TeX math fragment (without $) to Unicode text. */
export function texMathToPlain(tex: string): string {
  let out = '';
  let i = 0;
  while (i < tex.length) {
    const c = tex[i];
    if (c === '\\') {
      const m = /^\\([A-Za-z]+|.)/.exec(tex.slice(i));
      const name = m ? m[1] : '';
      i += m ? m[0].length : 1;
      if (name === 'mathbb') {
        const [a, n] = readArg(tex, i);
        i = n;
        out += [...a.trim()].map((ch) => BB[ch] ?? ch).join('');
      } else if (name === 'overline' || name === 'bar') {
        const [a, n] = readArg(tex, i);
        i = n;
        out += texMathToPlain(a) + '\u0305';
      } else if (name === 'widetilde' || name === 'tilde') {
        const [a, n] = readArg(tex, i);
        i = n;
        out += texMathToPlain(a) + '\u0303';
      } else if (name === 'hat' || name === 'widehat') {
        const [a, n] = readArg(tex, i);
        i = n;
        out += texMathToPlain(a) + '\u0302';
      } else if (name === 'sqrt') {
        const [a, n] = readArg(tex, i);
        i = n;
        const inner = texMathToPlain(a);
        out += inner.length > 1 ? `√(${inner})` : `√${inner}`;
      } else if (name === 'frac' || name === 'tfrac' || name === 'dfrac') {
        const [a, n1] = readArg(tex, i);
        const [b, n2] = readArg(tex, n1);
        i = n2;
        const pa = texMathToPlain(a);
        const pb = texMathToPlain(b);
        out += `${pa.length > 1 ? `(${pa})` : pa}/${pb.length > 1 ? `(${pb})` : pb}`;
      } else if (/^(math(rm|sf|bf|it|cal|scr|frak)|text(rm|sf|bf|it)?|operatorname|boldsymbol|mbox)$/.test(name)) {
        const [a, n] = readArg(tex, i);
        i = n;
        out += texMathToPlain(a);
      } else if (name in GREEK) out += GREEK[name];
      else if (name in SYMBOLS) out += SYMBOLS[name];
      else out += name.length === 1 ? name : '';
    } else if (c === '^' || c === '_') {
      const [a, n] = readArg(tex, i + 1);
      i = n;
      out += script(texMathToPlain(a), c === '^' ? SUP : SUB, c);
    } else if (c === '{' || c === '}') {
      i++;
    } else if (c === '~') {
      out += ' ';
      i++;
    } else {
      out += c;
      i++;
    }
  }
  return out.replace(/\s+/g, ' ').replace(/\( /g, '(').replace(/ \)/g, ')').trim();
}

/** Strip HTML tags and convert $...$ / \(...\) math to Unicode, collapsing whitespace. */
export function toPlain(s: string): string {
  if (!s) return '';
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/\$\$([^$]+)\$\$|\$([^$]+)\$|\\\((.+?)\\\)/g, (_m, a, b, c) => texMathToPlain(a ?? b ?? c ?? ''))
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Shorten to at most max characters on a word boundary, adding an ellipsis. */
export function clip(s: string, max = 200): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const sp = cut.lastIndexOf(' ');
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:.–—-]+$/, '') + '…';
}
