import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { entrySchema } from './lib/entry.js';

const entries = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/entries' }),
  schema: entrySchema,
});

export const collections = { entries };
