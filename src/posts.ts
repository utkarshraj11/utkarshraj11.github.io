// Blog data. Posts are markdown files in src/posts/<slug>.md, converted at build
// time by build/posts-plugin.ts (see that file for the frontmatter format).
// Files starting with "_" are ignored.
//
// Metadata for every post ships with the page (the index needs it); each post's
// HTML is its own small chunk, fetched only when the post is opened or hovered.
import type { PostMeta } from './post-meta';

export interface Post { slug: string; title: string; date: Date | null; summary?: string; draft: boolean; minutes: number }

const metas = import.meta.glob<PostMeta>(['./posts/*.md', '!./posts/_*.md'], { query: '?meta', import: 'default', eager: true });
const bodies = import.meta.glob<string>(['./posts/*.md', '!./posts/_*.md'], { query: '?html', import: 'default' });

const toDate = (iso: string | null) => {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
};

export const POSTS: Post[] = Object.values(metas)
  .filter(m => import.meta.env.DEV || !m.draft)
  .map(m => ({ slug: m.slug, title: m.title, date: toDate(m.date), summary: m.summary ?? undefined, draft: m.draft, minutes: m.minutes }))
  .sort((a, b) => (b.date?.getTime() ?? -Infinity) - (a.date?.getTime() ?? -Infinity));

export const findPost = (slug: string) => POSTS.find(p => p.slug === slug);

const htmlCache = new Map<string, Promise<string>>();

/** Fetch (once) the rendered HTML for a post. Rejected loads aren't cached, so a retry refetches. */
export function loadPostHtml(slug: string): Promise<string> {
  const hit = htmlCache.get(slug);
  if (hit) return hit;
  const loader = bodies[`./posts/${slug}.md`];
  if (!loader) return Promise.reject(new Error(`no post "${slug}"`));
  const p = loader().catch(err => { htmlCache.delete(slug); throw err; });
  htmlCache.set(slug, p);
  return p;
}

/** Warm the cache when a post is about to be opened (hover / focus on its row). */
export const prefetchPost = (slug: string) => { loadPostHtml(slug).catch(() => {}); };

export const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const fmtShort = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
export const fmtLong = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
