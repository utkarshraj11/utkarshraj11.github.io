import { Component, forwardRef, useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import { POSTS, findPost, fmtLong, fmtShort, isoDate, loadPostHtml, prefetchPost, type Post } from '../posts';
import { TopBar } from './TopBar';
import { SocialIcons } from './Icons';

interface Props { slug: string | null; onHome: (e: MouseEvent) => void; onNav: (e: MouseEvent, hash: string) => void }

export const Blog = forwardRef<HTMLDivElement, Props>(function Blog({ slug, onHome, onNav }, ref) {
  const post = slug ? findPost(slug) : null;
  return (
    <div ref={ref} className="page" data-screen-label="Blog">
      <TopBar onHome={onHome} label="Site" />
      <div className="page-spacer-top" />
      <div className="page-outer">
        <main className="page-main">
          <Boundary key={slug ?? ''} onNav={onNav}>
            {slug && !post ? <NotFound onNav={onNav} /> : post ? <PostView post={post} onNav={onNav} /> : <Index onNav={onNav} />}
          </Boundary>
          <footer className="page-footer">
            {slug ? <a className="ul-link mono-link" href="#blog" onClick={e => onNav(e, '#blog')}>← all posts</a> : <span />}
            <a className="ul-link mono-link" href="./" onClick={onHome}>↑ back up to the sky</a>
            <div className="footer-social">
              <SocialIcons sizes={[20, 18, 23]} />
            </div>
          </footer>
        </main>
      </div>
      <div className="page-spacer-bottom" />
    </div>
  );
});

/** Page heading: the focus target after every navigation, so screen readers announce the new page. */
function PageHeading({ className, children }: { className: string; children: ReactNode }) {
  return <h1 className={className} tabIndex={-1} data-page-heading>{children}</h1>;
}

function Index({ onNav }: { onNav: Props['onNav'] }) {
  const groups = new Map<string, Post[]>();
  for (const p of POSTS) {
    const key = p.date ? String(p.date.getFullYear()) : 'undated';
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  return (
    <>
      <header className="blog-head">
        <PageHeading className="blog-title">Blog</PageHeading>
        <p className="blog-intro">Notes on backend systems, Kubernetes, and whatever I'm learning at UC Riverside.</p>
      </header>
      {POSTS.length === 0 ? (
        <p className="blog-empty">Nothing here yet. The first post is on its way.</p>
      ) : (
        [...groups].map(([group, posts]) => (
          <section className="list-section" key={group} aria-labelledby={`g-${group}`}>
            <h2 id={`g-${group}`} className="section-label">{group}</h2>
            <ul className="post-list">
              {posts.map(p => (
                <li key={p.slug}>
                  <a
                    className="post-row"
                    href={`#blog/${encodeURIComponent(p.slug)}`}
                    onClick={e => onNav(e, `#blog/${encodeURIComponent(p.slug)}`)}
                    onPointerEnter={() => prefetchPost(p.slug)}
                    onFocus={() => prefetchPost(p.slug)}
                  >
                    <span className="post-row-title">
                      {p.title}
                      {p.draft && <span className="draft-tag">draft</span>}
                    </span>
                    {p.date && <time className="post-row-date" dateTime={isoDate(p.date)}>{fmtShort(p.date)}</time>}
                    {p.summary && <span className="post-row-summary">{p.summary}</span>}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  );
}

function PostView({ post, onNav }: { post: Post; onNav: Props['onNav'] }) {
  return (
    <article className="post">
      <a className="ul-link mono-link post-back" href="#blog" onClick={e => onNav(e, '#blog')}>← blog</a>
      <PageHeading className="post-title">{post.title}</PageHeading>
      <div className="post-meta">
        {post.date && (
          <>
            <time dateTime={isoDate(post.date)}>{fmtLong(post.date)}</time>
            <span aria-hidden="true">·</span>
          </>
        )}
        <span>{post.minutes} min read</span>
      </div>
      <PostBody slug={post.slug} />
    </article>
  );
}

/** The post's HTML arrives as its own small chunk; the title and meta above render immediately. */
function PostBody({ slug }: { slug: string }) {
  const [state, setState] = useState<{ html: string } | { error: true } | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setState(null);
    loadPostHtml(slug).then(
      html => { if (live) setState({ html }); },
      () => { if (live) setState({ error: true }); },
    );
    return () => { live = false; };
  }, [slug, attempt]);

  // Interactive figures embedded as same-origin iframes report their card height; size each to fit.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; height?: number } | null;
      if (!data || data.type !== 'figure-height' || typeof data.height !== 'number') return;
      for (const frame of document.querySelectorAll<HTMLIFrameElement>('.prose iframe')) {
        if (frame.contentWindow === event.source) frame.style.height = `${Math.min(2000, Math.max(120, data.height))}px`;
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  if (state && 'error' in state) {
    return (
      <p className="post-load-error" role="alert">
        This post didn't load. Check your connection, then{' '}
        <button type="button" className="ul-link link-button" onClick={() => setAttempt(a => a + 1)}>try again</button>.
      </p>
    );
  }
  return <div className="prose" aria-busy={state ? undefined : true} dangerouslySetInnerHTML={{ __html: state?.html ?? '' }} />;
}

function NotFound({ onNav }: { onNav: Props['onNav'] }) {
  return (
    <header className="blog-head">
      <PageHeading className="blog-title">Post not found</PageHeading>
      <p className="blog-intro">
        This link doesn't match any post. It may have been renamed or removed.{' '}
        <a className="ul-link" href="#blog" onClick={e => onNav(e, '#blog')}>See all posts</a>.
      </p>
    </header>
  );
}

/** Contains a rendering failure to the content column; the sky, top bar and footer stay usable. */
class Boundary extends Component<{ children: ReactNode; onNav: Props['onNav'] }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err: unknown) { console.error('[blog] render failed', err); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <header className="blog-head">
        <PageHeading className="blog-title">This page didn't load</PageHeading>
        <p className="blog-intro">
          Something in this post broke while rendering. Try reloading, or{' '}
          <a className="ul-link" href="#blog" onClick={e => this.props.onNav(e, '#blog')}>go back to all posts</a>.
        </p>
      </header>
    );
  }
}
