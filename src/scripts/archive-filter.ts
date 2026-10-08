/**
 * Archive search + filters (v5 sidebar + sort). Vanilla, no framework.
 * Bundled by Astro from ArchiveBrowser.astro; runs once per page.
 *
 * Rows are moved, never re-rendered: grouped sections for "by field",
 * one flat list otherwise. KaTeX set at build time survives untouched.
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

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
}

const TRUST_ORDER: Record<string, number> = { formal: 0, partial: 1, claimed: 2 };

function init(): void {
  const q = el<HTMLInputElement>('q');
  const seg = el<HTMLElement>('seg');
  const chips = el<HTMLElement>('chips');
  const sortEl = el<HTMLSelectElement>('sort');
  const count = el<HTMLElement>('count');
  const reset = el<HTMLButtonElement>('reset');
  const list = el<HTMLElement>('list');
  const groupsBox = el<HTMLElement>('groups');
  if (!q || !seg || !sortEl || !count || !reset || !list || !groupsBox) return;
  const qEl = q;
  const sortSel = sortEl;
  const countEl = count;
  const resetEl = reset;
  const listEl = list;
  const groupsEl = groupsBox;

  const lockField = listEl.dataset.lockfield || '';
  const rows = [...listEl.querySelectorAll<HTMLElement>('[data-row]')];
  const sections = [...listEl.querySelectorAll<HTMLElement>('[data-group]')];
  const homeOf = new Map<HTMLElement, HTMLElement>();
  for (const s of sections) {
    const ul = s.querySelector('ul');
    if (!ul) continue;
    for (const r of [...ul.querySelectorAll<HTMLElement>('[data-row]')]) homeOf.set(r, ul);
  }
  const flat = document.createElement('ul');
  flat.className = 'rlist rlist-flat';

  let trust = 'all';
  let field = lockField ? '__locked__' : 'All';
  let sort: string = 'cat';

  const params = new URLSearchParams(location.search);
  const pq = params.get('q') ?? '';
  const pf = params.get('field') ?? '';
  const pt = params.get('trust') ?? '';
  const ps = params.get('sort') ?? '';
  if (pq) qEl.value = pq;
  if (!lockField && pf) field = pf;
  if (pt) trust = pt;
  if (ps === 'new' || ps === 'trust') sort = ps;
  sortSel.value = sort;
  syncSortMenu();

  const syncSide = (): void => {
    for (const b of seg.querySelectorAll<HTMLButtonElement>('.fopt')) {
      b.setAttribute('aria-pressed', String(b.dataset.v === trust));
    }
    if (chips) {
      for (const b of chips.querySelectorAll<HTMLButtonElement>('.fopt')) {
        b.setAttribute('aria-pressed', String(b.dataset.v === field));
      }
    }
  };

  function matching(): HTMLElement[] {
    const qv = qEl.value;
    return rows.filter((r) => {
      if (field !== 'All' && field !== '__locked__' && r.dataset.field !== field) return false;
      if (lockField && r.dataset.field !== lockField) return false;
      if (trust !== 'all') {
        if (trust === 'explained' ? r.dataset.explained !== '1' : r.dataset.trust !== trust) return false;
      }
      return matchQuery(r.dataset.search ?? '', qv);
    });
  }

  function apply(): void {
    const qv = qEl.value;
    const shown = matching();
    const flatMode = sort !== 'cat';
    if (flatMode) {
      const ordered = [...shown].sort(
        sort === 'new'
          ? (a, b) => Number(b.dataset.date || 0) - Number(a.dataset.date || 0) || (a.dataset.id ?? '').localeCompare(b.dataset.id ?? '')
          : (a, b) => (TRUST_ORDER[a.dataset.trust ?? ''] ?? 9) - (TRUST_ORDER[b.dataset.trust ?? ''] ?? 9) || (a.dataset.id ?? '').localeCompare(b.dataset.id ?? ''),
      );
      for (const r of ordered) {
        r.hidden = false;
        r.querySelector('.res-f-n')?.removeAttribute('hidden');
        flat.append(r);
      }
      for (const r of rows) {
        if (!ordered.includes(r)) r.hidden = true;
      }
      if (!flat.isConnected) listEl.append(flat);
      groupsEl.hidden = true;
    } else {
      if (flat.isConnected) flat.remove();
      groupsEl.hidden = false;
      for (const r of rows) {
        const show = shown.includes(r);
        r.hidden = !show;
        r.querySelector('.res-f-n')?.setAttribute('hidden', '');
        homeOf.get(r)?.append(r);
      }
      for (const s of sections) {
        const n = [...s.querySelectorAll('[data-row]')].filter((r) => !(r as HTMLElement).hidden).length;
        s.hidden = n === 0;
        const num = s.querySelector('.group-h .num');
        if (num) num.textContent = String(n);
      }
    }
    const total = rows.length;
    countEl.innerHTML =
      shown.length === total
        ? `<b>${total}</b> results`
        : `<b>${shown.length}</b> of ${total} results`;
    resetEl.hidden = !(qv || (!lockField && field !== 'All') || trust !== 'all' || sort !== 'cat');
    let emptyEl = listEl.querySelector<HTMLElement>('.empty');
    if (shown.length === 0) {
      const fname =
        !lockField && field !== 'All'
          ? chips?.querySelector(`[data-v="${CSS.escape(field)}"] .fo-l`)?.textContent?.trim() ?? field
          : '';
      if (!emptyEl) {
        emptyEl = document.createElement('div');
        emptyEl.className = 'empty';
        listEl.append(emptyEl);
      }
      emptyEl.hidden = false;
      emptyEl.innerHTML = `No results match${qv ? ` “${escapeHtml(qv)}”` : ''}${fname ? ` in ${escapeHtml(fname)}` : ''}. Try a broader word, like “prime” or “graph”, or <button type="button" id="clear">clear all filters</button>.`;
      emptyEl.querySelector('#clear')?.addEventListener('click', clearAll);
    } else if (emptyEl) {
      emptyEl.hidden = true;
    }
    const p = new URLSearchParams();
    if (qv) p.set('q', qv);
    if (!lockField && field !== 'All') p.set('field', field);
    if (trust !== 'all') p.set('trust', trust);
    if (sort !== 'cat') p.set('sort', sort);
    const qs = p.toString();
    history.replaceState(null, '', qs ? '?' + qs : location.pathname);
    syncSide();
  }

  function syncSortMenu(): void {
    const lbl = document.getElementById('sort-lbl');
    const opt = sortSel.selectedOptions[0];
    if (lbl && opt) lbl.textContent = opt.textContent;
    document.querySelectorAll<HTMLElement>('#sort-list [role=option]').forEach((li) => {
      li.setAttribute('aria-selected', String(li.dataset.v === sortSel.value));
    });
  }

  function setupSortMenu(): void {
    const btn = document.getElementById('sort-btn');
    const menu = document.getElementById('sort-list');
    if (!btn || !menu) return;
    const opts = () => [...menu.querySelectorAll<HTMLElement>('[role=option]')];
    let active = 0;
    const mark = (i: number) => {
      const o = opts();
      active = (i + o.length) % o.length;
      o.forEach((li, k) => li.classList.toggle('is-active', k === active));
      menu.setAttribute('aria-activedescendant', o[active].id);
    };
    opts().forEach((li, k) => (li.id = 'sort-opt-' + k));
    const open = () => {
      menu.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      mark(Math.max(0, opts().findIndex((li) => li.dataset.v === sortSel.value)));
      menu.focus();
    };
    const close = (focusBtn = true) => {
      menu.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      if (focusBtn) btn.focus();
    };
    const choose = (li: HTMLElement | undefined) => {
      if (!li || !li.dataset.v) return;
      sortSel.value = li.dataset.v;
      sortSel.dispatchEvent(new Event('change'));
      close();
    };
    btn.addEventListener('click', () => (menu.hidden ? open() : close()));
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); open(); }
    });
    menu.addEventListener('click', (e) => choose((e.target as HTMLElement).closest<HTMLElement>('[role=option]') ?? undefined));
    menu.addEventListener('mousemove', (e) => {
      const li = (e.target as HTMLElement).closest<HTMLElement>('[role=option]');
      if (li) mark(opts().indexOf(li));
    });
    menu.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); mark(active + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); mark(active - 1); }
      else if (e.key === 'Home') { e.preventDefault(); mark(0); }
      else if (e.key === 'End') { e.preventDefault(); mark(-1); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(opts()[active]); }
      else if (e.key === 'Escape' || e.key === 'Tab') { close(e.key === 'Escape'); }
      e.stopPropagation();
    });
    document.addEventListener('click', (e) => {
      if (!menu.hidden && !(e.target as HTMLElement).closest('#sortmenu')) close(false);
    });
  }

  function clearAll(): void {
    qEl.value = '';
    if (!lockField) field = 'All';
    trust = 'all';
    sort = 'cat';
    sortSel.value = sort;
    syncSortMenu();
    apply();
    qEl.focus();
  }

  qEl.addEventListener('input', apply);
  sortSel.addEventListener('change', () => {
    sort = sortSel.value;
    syncSortMenu();
    apply();
  });
  setupSortMenu();
  if (location.hash === '#q') {
    history.replaceState(null, '', location.pathname + location.search);
    scrollTo(0, 0);
    qEl.focus();
  }
  seg.addEventListener('click', (e: Event) => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b || !b.dataset.v) return;
    trust = b.dataset.v;
    apply();
  });
  if (chips) {
    chips.addEventListener('click', (e: Event) => {
      const b = (e.target as HTMLElement).closest('button');
      if (!b || b.dataset.v === undefined) return;
      field = b.dataset.v;
      apply();
    });
  }
  resetEl.addEventListener('click', clearAll);

  const visibleLinks = (): HTMLAnchorElement[] =>
    rows
      .filter((r) => !r.hidden)
      .map((r) => r.querySelector('a'))
      .filter((a): a is HTMLAnchorElement => a !== null);

  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey || !listEl.offsetParent) return;
    const tag = document.activeElement?.tagName ?? '';
    const inField = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
    if (document.activeElement === qEl) {
      if (e.key === 'Escape') {
        if (qEl.value) {
          qEl.value = '';
          apply();
        } else qEl.blur();
      } else if (e.key === 'ArrowDown' && visibleLinks().length > 0) {
        e.preventDefault();
        visibleLinks()[0].focus();
      }
      return;
    }
    if (inField || (document.activeElement as HTMLElement | null)?.closest('#sortmenu')) return;
    if (e.key === '/') {
      e.preventDefault();
      qEl.focus();
      qEl.select();
    } else if (e.key === 'j' || e.key === 'k' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
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

  // Cold load with no params matches the SSR state exactly, so skip the full
  // pass: touching all rows would force layout of every offscreen section and
  // defeat content-visibility. Deep links still filter immediately.
  if (pq || pf || pt || ps) {
    apply();
  } else {
    syncSide();
  }
}

init();

// Sticky filter sidebar without an inner scrollbar: stick under the header when it fits,
// otherwise stick by its bottom edge so every filter stays reachable by scrolling the page.
(() => {
  const side = document.querySelector<HTMLElement>('.filters');
  const header = document.querySelector<HTMLElement>('header.top');
  if (!side) return;
  const fit = () => {
    const hh = header?.offsetHeight ?? 56;
    const gap = 16;
    const h = side.offsetHeight;
    const top = h + hh + gap * 2 <= innerHeight ? hh + gap : innerHeight - h - gap;
    side.style.setProperty('--side-top', `${Math.round(top)}px`);
  };
  fit();
  addEventListener('resize', fit, { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(fit).observe(side);
})();
