import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { youtubeUrl } from './utils/youtube';

const externalLink = z.object({
  label: z.string().min(1),
  url: z.string().url().refine((value) => /^https?:\/\//.test(value), 'http(s) のURLを指定してください'),
});

const games = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/games' }),
  schema: z.object({
    title: z.string().min(1),
    summary: z.string().default(''),
    genre: z.string().optional(),
    cover: z.string().optional(),           // 例: /images/new-game/cover.webp
    video: z.string().regex(youtubeUrl, 'YouTubeのURLを指定してください').optional(),  // 例: https://youtu.be/xxxxxxxxxxx
    screenshots: z.array(z.string()).default([]),
    accent: z.enum(['cyan', 'pink', 'orange', 'violet', 'lime']).default('cyan'),
    order: z.number().int().default(999),
    event: z.object({
      playTimeMinutes: z.number().int().positive().optional(),
      players: z.string().optional(),     // 例: 1人
      controls: z.array(z.string()).default([]),
      notes: z.string().optional(),
    }).optional(),
    development: z.object({
      engine: z.string().optional(),       // 例: Unity
      languages: z.array(z.string()).default([]),  // 例: [C#]
      period: z.string().optional(),       // 例: 2026年4月〜10月
      team: z.string().optional(),         // 例: 3人
      notes: z.string().optional(),
    }).optional(),
    links: z.array(externalLink).default([]),
  }),
});

export const collections = { games };
