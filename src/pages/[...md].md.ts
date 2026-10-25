/**
 * Markdown version of every public, indexable page, from the one registry in
 * src/lib/md/registry.ts: "/" → /index.md, "/about/" → /about.md, "/e/<gid>/" → /e/<gid>.md.
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import { mdContext } from '../lib/md/load.js';
import { mdPathFor } from '../lib/md/format.js';
import { allDocs, renderMd } from '../lib/md/registry.js';

export const getStaticPaths: GetStaticPaths = async () => {
  const ctx = await mdContext();
  return allDocs(ctx).map((doc) => ({
    params: { md: mdPathFor(doc.path).slice(1).replace(/\.md$/, '') },
    props: { doc },
  }));
};

export const GET: APIRoute = ({ props }) =>
  new Response(renderMd(props.doc), { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
