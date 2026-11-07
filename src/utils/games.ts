import { getCollection } from 'astro:content';

export async function publishedGames() {
  const entries = await getCollection('games');
  return entries.sort((a, b) => a.data.order - b.data.order || a.data.title.localeCompare(b.data.title, 'ja'));
}
