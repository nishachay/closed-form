import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { buildLastmodMap } from './src/lib/lastmod.ts';

const root = fileURLToPath(new URL('.', import.meta.url));
const catalog = JSON.parse(readFileSync(new URL('./src/data/catalog.json', import.meta.url), 'utf8'));
// Per-page <lastmod> from git history of the entries each page shows (see src/lib/lastmod.ts).
const lastmod = buildLastmodMap(root, catalog);

// https://docs.astro.build/en/reference/configuration-reference/
// Static output for GitHub Pages durability (§4.8, §16).
// Served from the custom domain closedform.nishachay.tech (public/CNAME), so base is '/'.
export default defineConfig({
  output: 'static',
  site: 'https://closedform.nishachay.tech',
  base: '/',
  integrations: [
    sitemap({
      // Machine-readable data, the .md page versions and the 404 page stay out of the sitemap.
      filter: (page) => {
        const path = new URL(page).pathname;
        return !/^\/(404|data)\b/.test(path) && !/\.(md|txt)$/.test(path);
      },
      serialize(item) {
        const d = lastmod.get(new URL(item.url).pathname);
        return d ? { ...item, lastmod: new Date(d).toISOString() } : item;
      },
    }),
    {
      // Also publish the sitemap index at the conventional /sitemap.xml (robots.txt points here).
      name: 'sitemap-xml-alias',
      hooks: {
        'astro:build:done': ({ dir }) => {
          const index = new URL('sitemap-index.xml', dir);
          if (existsSync(index)) copyFileSync(index, new URL('sitemap.xml', dir));
        },
      },
    },
    {
      // Old links from the github.io/closed-form era sometimes land as /closed-form/<page> on the
      // custom domain and 404. Write a tiny redirect page for every built page under /closed-form/.
      name: 'legacy-closed-form-redirects',
      hooks: {
        'astro:build:done': ({ dir }) => {
          const out = fileURLToPath(dir);
          const site = 'https://closedform.nishachay.tech';
          const pages = [];
          const walk = (d) => {
            for (const name of readdirSync(d)) {
              const full = join(d, name);
              if (statSync(full).isDirectory()) {
                if (!['closed-form', 'og', 'data', '_astro', '404'].includes(name) || d !== out) walk(full);
              } else if (name === 'index.html') pages.push(relative(out, d));
            }
          };
          walk(out);
          for (const rel of pages) {
            const path = rel ? `/${rel.split('\\').join('/')}/` : '/';
            const target = site + path;
            const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Moved</title>` +
              `<link rel="canonical" href="${target}"><meta name="robots" content="noindex,follow">` +
              `<meta http-equiv="refresh" content="0; url=${target}">` +
              `<script>location.replace(${JSON.stringify(path)}+location.search+location.hash)</script>` +
              `</head><body><a href="${target}">This page moved here.</a></body></html>`;
            const dest = join(out, 'closed-form', rel);
            mkdirSync(dest, { recursive: true });
            writeFileSync(join(dest, 'index.html'), html);
          }
        },
      },
    },
  ],
});
