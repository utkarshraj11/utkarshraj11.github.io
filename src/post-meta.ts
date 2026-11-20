/** Shape of `import x from './posts/<slug>.md?meta'` — produced by build/posts-plugin.ts. */
export interface PostMeta { slug: string; title: string; date: string | null; summary: string | null; draft: boolean; minutes: number }
