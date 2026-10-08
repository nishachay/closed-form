/**
 * Archive search + filters (§13). Vanilla, no framework.
 * Bundled by Astro from ArchiveBrowser.astro; runs once per page.
 */
const GREEK: Record<string, string> = {
  π: 'pi',
  ζ: 'zeta',
  ε: 'epsilon',
  λ: 'lambda',
  μ: 'mu',
  σ: 'sigma',
  τ: 'tau',
  φ: 'phi',
  ψ: 'psi',
  ω: 'omega',
  χ: 'chi',
  θ: 'theta',
  α: 'alpha',
  β: 'beta',
  γ: 'gamma',
  δ: 'delta',
};

function fold(s: string): string {
  let out = s.toLowerCase();
  for (const [g, name] of Object.entries(GREEK)) out = out.split(g).join(' ' + name + ' ');
  return out;
}

function words(s: string): string[] {
  return fold(s)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function matchQuery(hay: string, q: string): boolean {
  const h = words(hay);
  const qs = words(q);
  if (qs.length === 0) return true;
  return qs.every((x) => h.some((w) => w.startsWith(x)));
}

function el<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

function init(): void {
  const q = el<HTMLInputElement>('q');
  const field = el<HTMLSelectElement>('field');
  const group = el<HTMLElement>('trust-group');
  const count = el<HTMLElement>('live-count');
  const reset = el<HTMLButtonElement>('reset');
  const empty = el<HTMLElement>('empty');
  const emptyText = el<HTMLElement>('empty-text');
  const emptyClear = el<HTMLButtonElement>('empty-clear');
  if (!q || !field || !group || !count || !reset || !empty || !emptyText || !emptyClear) return;
  const qEl: HTMLInputElement = q;
  const fieldEl: HTMLSelectElement = field;
  const groupEl: HTMLElement = group;
  const countEl: HTMLElement = count;
  const resetEl: HTMLButtonElement = reset;
  const emptyEl: HTMLElement = empty;
  const emptyTextEl: HTMLElement = emptyText;
  const emptyClearEl: HTMLButtonElement = emptyClear;

  const rows = [...document.querySelectorAll<HTMLElement>('[data-row]')];
  const sections = [...document.querySelectorAll<HTMLElement>('[data-group]')];
  const segBtns = [...groupEl.querySelectorAll<HTMLButtonElement>('button')];
  let trust = '';

  const params = new URLSearchParams(location.search);
  const pq = params.get('q');
  const pf = params.get('field');
  const pt = params.get('trust');
  if (pq) qEl.value = pq;
  if (pf && fieldEl.querySelector('option[value="' + pf + '"]')) fieldEl.value = pf;
  if (pt) trust = pt;

  const syncSeg = (): void => {
    for (const b of segBtns) b.setAttribute('aria-pressed', String((b.dataset.trust ?? '') === trust));
  };

  function apply(): void {
    const qv = qEl.value;
    const fv = fieldEl.value;
    let n = 0;
    for (const r of rows) {
      const okQ = matchQuery(r.dataset.search ?? '', qv);
      const okF = !fv || r.dataset.field === fv;
      const okT = !trust || (trust === 'explained' ? r.dataset.explained === '1' : r.dataset.trust === trust);
      const show = okQ && okF && okT;
      r.hidden = !show;
      if (show) n++;
    }
    for (const s of sections) {
      const any = [...s.querySelectorAll('[data-row]')].some((r) => !(r as HTMLElement).hidden);
      s.hidden = !any;
    }
    const fname = fv ? fieldEl.options[fieldEl.selectedIndex].text.replace(/\s\(\d+\)$/, '') : '';
    countEl.textContent = fv
      ? n + ' of ' + rows.length + ' results in ' + fname
      : n + ' of ' + rows.length + ' results';
    resetEl.hidden = !(qv || fv || trust);
    emptyEl.hidden = n !== 0;
    if (n === 0) {
      emptyTextEl.textContent =
        'No results match' + (qv ? ' \u201C' + qv + '\u201D' : '') + (fname ? ' in ' + fname : '') + '.';
    }
    const p = new URLSearchParams();
    if (qv) p.set('q', qv);
    if (fv) p.set('field', fv);
    if (trust) p.set('trust', trust);
    const qs = p.toString();
    history.replaceState(null, '', qs ? '?' + qs : location.pathname);
  }

  function clearAll(): void {
    qEl.value = '';
    fieldEl.value = '';
    trust = '';
    syncSeg();
    apply();
  }

  qEl.addEventListener('input', apply);
  fieldEl.addEventListener('change', apply);
  groupEl.addEventListener('click', (e: Event) => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b) return;
    trust = b.dataset.trust ?? '';
    syncSeg();
    apply();
  });
  resetEl.addEventListener('click', clearAll);
  emptyClearEl.addEventListener('click', clearAll);

  const visibleLinks = (): HTMLAnchorElement[] =>
    rows.filter((r) => !r.hidden).map((r) => r.querySelector('a')).filter((a): a is HTMLAnchorElement => a !== null);

  document.addEventListener('keydown', (e: KeyboardEvent) => {
    const tag = document.activeElement?.tagName ?? '';
    const inField = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
    if (e.key === '/' && !inField) {
      e.preventDefault();
      qEl.focus();
      return;
    }
    if (e.key === 'Escape' && document.activeElement === qEl) {
      qEl.value = '';
      apply();
      qEl.blur();
      return;
    }
    if ((e.key === 'j' || e.key === 'k' || e.key === 'ArrowDown' || e.key === 'ArrowUp') && !inField) {
      const links = visibleLinks();
      if (links.length === 0) return;
      e.preventDefault();
      const down = e.key === 'j' || e.key === 'ArrowDown';
      const i = links.indexOf(document.activeElement as HTMLAnchorElement);
      const at = i < 0 ? (down ? 0 : links.length - 1) : (i + (down ? 1 : -1) + links.length) % links.length;
      const target = links[at];
      if (target) target.focus();
    }
  });

  // Cold load with no params matches the SSR state exactly (nothing hidden,
  // "All" pressed, full count pre-rendered), so skip the full pass: touching
  // all 372 rows would force layout of every offscreen section and defeat
  // content-visibility. Deep links still filter immediately.
  if (pq || pf || pt) {
    syncSeg();
    apply();
  }
}

init();
