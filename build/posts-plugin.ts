// Vite plugin: turns src/posts/*.md into data at build time, so the browser never
// ships a markdown parser and the blog index never downloads post bodies.
//
//   import meta from './posts/x.md?meta'  →  { slug, title, date, summary, draft, minutes }
//   import html from './posts/x.md?html'  →  "<p>…</p>"  (its own lazy chunk via import.meta.glob)
//
// Frontmatter:
//   ---
//   title: My post
//   date: 2026-11-20          (YYYY-MM-DD; anything else → listed as undated, with a build warning)
//   summary: Optional one-liner.
//   draft: true               (optional — drafts show in `pnpm dev` only)
//   ---
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { Marked } from 'marked';
import type { Plugin } from 'vite';
import type { PostMeta } from '../src/post-meta';

const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

const md = new Marked({
  renderer: {
    // Lazy-load post images.
    image({ href, title, text }) {
      const t = title ? ` title="${escapeAttr(title)}"` : '';
      return `<img src="${escapeAttr(href)}" alt="${escapeAttr(text)}"${t} loading="lazy" decoding="async">`;
    },
    // External links open in a new tab, safely.
    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens);
      const t = title ? ` title="${escapeAttr(title)}"` : '';
      const ext = /^https?:\/\//.test(href) ? ' target="_blank" rel="noopener"' : '';
      return `<a href="${escapeAttr(href)}"${t}${ext}>${text}</a>`;
    },
  },
});

function parse(file: string, raw: string, warn: (msg: string) => void): { meta: PostMeta; html: string } {
  const slug = basename(file, '.md');
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  const fm: Record<string, string> = {};
  if (m) for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i > 0) fm[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  const body = m ? raw.slice(m[0].length) : raw;

  let date: string | null = null;
  if (fm.date) {
    const d = fm.date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const valid = d && !Number.isNaN(new Date(+d[1], +d[2] - 1, +d[3]).getTime()) && +d[2] >= 1 && +d[2] <= 12 && +d[3] >= 1 && +d[3] <= 31;
    if (valid) date = fm.date;
    else warn(`${slug}.md: date "${fm.date}" is not YYYY-MM-DD; listing it as undated.`);
  }

  const words = body.split(/\s+/).filter(Boolean).length;
  return {
    meta: {
      slug,
      title: fm.title || slug.replace(/-/g, ' '),
      date,
      summary: fm.summary || null,
      draft: fm.draft === 'true',
      minutes: Math.max(1, Math.round(words / 230)),
    },
    html: md.parse(body, { async: false }) as string,
  };
}

export function postsPlugin(): Plugin {
  return {
    name: 'portfolio-posts',
    enforce: 'pre',
    async load(id) {
      const [file, query = ''] = id.split('?');
      if (!file.endsWith('.md')) return;
      const q = new URLSearchParams(query);
      const want = q.has('meta') ? 'meta' : q.has('html') ? 'html' : null;
      if (!want) return;
      this.addWatchFile(file);
      const raw = await readFile(file, 'utf8');
      try {
        const { meta, html } = parse(file, raw, msg => this.warn(msg));
        return `export default ${JSON.stringify(want === 'meta' ? meta : html)};`;
      } catch (err) {
        // One broken post must not break the build: ship it as an error page instead.
        this.warn(`${basename(file)} failed to parse: ${String(err)}`);
        const slug = basename(file, '.md');
        return want === 'meta'
          ? `export default ${JSON.stringify({ slug, title: slug, date: null, summary: null, draft: true, minutes: 1 } satisfies PostMeta)};`
          : `export default ${JSON.stringify('<p>This post could not be rendered.</p>')};`;
      }
    },
  };
}
