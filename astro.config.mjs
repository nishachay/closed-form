import { copyFileSync, existsSync, readFileSync } from 'node:fs';
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
  ],
});
