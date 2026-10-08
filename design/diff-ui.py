#!/usr/bin/env python3
"""Structural diff: reference (prototype post-JS) vs our built HTML.

Compares tag/class/id skeletons inside <main>, ignoring text, counts and
attribute values. Prints unified diffs per page plus an allowlist summary.
"""
import difflib
import re
import sys
from html.parser import HTMLParser

VOID = {'meta', 'link', 'img', 'br', 'hr', 'input', 'source'}

ALLOW = [
    # spec-mandated content the prototype lacks (§7 scope/sources, §6 notice,
    # §13 report link, trust/review sidebar blocks, public-data docs)
    'scope', 'notice', 'review-kind', 'claim-foot', 'res-f-n',
    'public-data',
]

class Skeleton(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out = []
        self.skip_stack: list[bool] = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        cls = ' '.join(sorted((a.get('class') or '').split()))
        is_katex = 'katex' in cls.split() or 'katex-display' in cls.split()
        skipping = is_katex or (self.skip_stack[-1] if self.skip_stack else False)
        self.skip_stack.append(skipping)
        if skipping:
            if is_katex:
                self.out.append('<katex/>')
            return
        ident = a.get('id') or ''
        mark = f'<{tag}'
        if cls:
            mark += f' class="{cls}"'
        if ident:
            mark += f' id="{ident}"'
        mark += '>'
        # skip file-internal script/style content markers
        if tag in ('script', 'style'):
            mark += '…'
        self.out.append(mark)

    def handle_endtag(self, tag):
        skipping = self.skip_stack.pop() if self.skip_stack else False
        if skipping:
            return
        if tag not in VOID:
            self.out.append(f'</{tag}>')

    def handle_data(self, data):
        pass

def skeleton(html, root_sel=None):
    p = Skeleton()
    p.feed(html)
    return p.out

def load(path):
    with open(path, encoding='utf-8') as f:
        return f.read()

def main_only(html):
    m = re.search(r'<main[^>]*>(.*)</main>', html, re.S)
    return m.group(1) if m else html

PAGES = [
    ('home', 'design/reference/home.html', 'dist/index.html'),
    ('archive', 'design/reference/archive.html', 'dist/archive/index.html'),
    ('entry-017', 'design/reference/entry-017.html', 'dist/e/openai-math-2026-017/index.html'),
    ('entry-001', 'design/reference/entry-001.html', 'dist/e/openai-math-2026-001/index.html'),
    ('about', 'design/reference/about.html', 'dist/about/index.html'),
]

total_add = total_del = 0
allowed_hits = {a: 0 for a in ALLOW}
for name, ref_path, our_path in PAGES:
    ref = skeleton(main_only(load(ref_path)))
    our = skeleton(main_only(load(our_path)))
    # entry pages: compare the .entry-wrap subtree of ours
    if name.startswith('entry'):
        m = re.search(r'<div class="entry-wrap">(.*?)</div>\s*<div class="wrap">', load(our_path), re.S)
        if m:
            our = skeleton(m.group(1))
    sm = difflib.SequenceMatcher(None, ref, our, autojunk=False)
    adds = [o for tag, a, b, c, d in sm.get_opcodes() for o in our[c:d] if tag in ('insert', 'replace')]
    dels = [o for tag, a, b, c, d in sm.get_opcodes() for o in ref[a:b] if tag in ('delete', 'replace')]
    total_add += len(adds)
    total_del += len(dels)
    print(f'=== {name}: ref {len(ref)} nodes, ours {len(our)} nodes, +{len(adds)} -{len(dels)} ===')
    for line in list(difflib.unified_diff(ref, our, lineterm='', n=1))[:60]:
        print('   ', line[:150])
    for a in ALLOW:
        allowed_hits[a] += sum(1 for x in adds if a in x)

print('\nallowlisted additions:', allowed_hits)
print(f'TOTAL structural +{total_add} -{total_del}')
