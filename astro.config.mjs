import { defineConfig } from 'astro/config';

// https://docs.astro.build/en/reference/configuration-reference/
// Static output for GitHub Pages durability (§4.8, §16).
export default defineConfig({
  output: 'static',
  site: 'https://nishachay.github.io',
  base: '/closed-form',
});
