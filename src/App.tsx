import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react';
import type { View } from './scene/sky-scene';
import { SkyCanvas } from './components/SkyCanvas';
import { Home } from './components/Home';
import { Blog } from './components/Blog';
import { findPost } from './posts';
// About is parked for now; we'll review it later. To restore it:
//   1. uncomment the import, the `#about` route below and the <About> render,
//   2. bring back the "about me ↓" link in Home.tsx.
// import { About } from './components/About';

type Route = { page: 'home' } | { page: 'blog'; slug: string | null };

function routeFromHash(): Route {
  const h = location.hash;
  if (h === '#blog') return { page: 'blog', slug: null };
  if (h.startsWith('#blog/')) {
    let slug = h.slice(6);
    try { slug = decodeURIComponent(slug); } catch { /* malformed escape: keep raw, it renders "not found" */ }
    return { page: 'blog', slug: slug || null };
  }
  // if (h === '#about') return { page: 'about' };
  return { page: 'home' };
}

const TITLE = 'Utkarsh Raj';

/** Let the browser handle cmd/ctrl/shift/middle clicks (open in new tab/window). */
const isPlainClick = (e: MouseEvent) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

const focusPageHeading = (root: HTMLElement | null) =>
  root?.querySelector<HTMLElement>('[data-page-heading]')?.focus({ preventScroll: true });

export function App() {
  const [route, setRoute] = useState<Route>(routeFromHash);
  const view: View = route.page === 'home' ? 'home' : 'about'; // scene: up in the sky vs down on the grass
  const slug = route.page === 'blog' ? route.slug : null;

  const cv = useRef<HTMLCanvasElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  const home = useRef<HTMLElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const hideT = useRef(0);
  const prevView = useRef<View | null>(null);

  useEffect(() => {
    const onPop = () => setRoute(routeFromHash());
    window.addEventListener('popstate', onPop);
    window.addEventListener('hashchange', onPop);
    return () => { window.removeEventListener('popstate', onPop); window.removeEventListener('hashchange', onPop); };
  }, []);

  const go = useCallback((hash: string) => {
    if (hash === location.hash || (hash === '' && !location.hash)) return;
    try { history.pushState(null, '', hash || location.pathname + location.search); } catch { /* ignore */ }
    setRoute(routeFromHash());
  }, []);
  const toHome = useCallback((e: MouseEvent) => { if (!isPlainClick(e)) return; e.preventDefault(); go(''); }, [go]);
  const toBlog = useCallback((e: MouseEvent) => { if (!isPlainClick(e)) return; e.preventDefault(); go('#blog'); }, [go]);
  const nav = useCallback((e: MouseEvent, hash: string) => { if (!isPlainClick(e)) return; e.preventDefault(); go(hash); }, [go]);

  // Moving between blog index and a post while on the ground: remember where the
  // index was scrolled, restore it on the way back, otherwise start at the top;
  // then move focus to the new page's heading so it's announced.
  const prevSlug = useRef(slug);
  const indexScroll = useRef(0);
  useLayoutEffect(() => {
    if (prevSlug.current === slug || view !== 'about') { prevSlug.current = slug; return; }
    if (prevSlug.current === null) indexScroll.current = window.scrollY;
    window.scrollTo(0, slug === null ? indexScroll.current : 0);
    prevSlug.current = slug;
    focusPageHeading(page.current);
  }, [slug, view]);

  useEffect(() => {
    if (route.page === 'home') document.title = TITLE;
    else document.title = (slug ? (findPost(slug)?.title ?? 'Post not found') : 'Blog') + ' · ' + TITLE;
    // Mobile browser chrome follows the scene: sky teal up top, washed white on the ground.
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', route.page === 'home' ? '#286c8c' : '#f6f7f6');
  }, [route, slug]);

  // Sky ⇄ ground transition — imperative, mirroring the reference's apply().
  useLayoutEffect(() => {
    const h = home.current!, a = page.current!, c = cv.current, s = scrim.current;
    if (prevView.current === view) return;
    const animated = prevView.current !== null;
    prevView.current = view;
    const down = view === 'about';
    // First paint of a direct link (or reload): land on the view instantly. CSS
    // transitions are suspended for this one style change, then restored.
    const root = document.documentElement;
    if (!animated) root.classList.add('no-transitions');
    if (c) Object.assign(c.style, { filter: down ? 'blur(1.5px)' : 'none', transform: down ? 'scale(1.02)' : 'none' });
    if (s) s.style.opacity = down ? '1' : '0';
    clearTimeout(hideT.current);
    if (down) {
      a.style.display = 'block'; void a.offsetHeight;
      Object.assign(a.style, { opacity: '1', transform: 'none', pointerEvents: 'auto' });
      Object.assign(h.style, { opacity: '0', transform: 'translateY(-36vh)', pointerEvents: 'none' });
      a.inert = false; h.inert = true;
      hideT.current = window.setTimeout(() => { h.style.visibility = 'hidden'; }, animated ? 900 : 0);
      if (animated) focusPageHeading(a);
    } else {
      Object.assign(a.style, { opacity: '0', transform: 'translateY(50vh)', pointerEvents: 'none' });
      a.inert = true; h.inert = false;
      hideT.current = window.setTimeout(() => { a.style.display = 'none'; window.scrollTo(0, 0); }, animated ? 1100 : 0);
      Object.assign(h.style, { visibility: 'visible', opacity: '1', transform: 'none', pointerEvents: 'auto' });
      if (animated) h.querySelector<HTMLElement>('.home-nav a[href="#blog"]')?.focus({ preventScroll: true });
    }
    if (!animated) { void root.offsetHeight; requestAnimationFrame(() => root.classList.remove('no-transitions')); }
  }, [view]);

  useEffect(() => () => clearTimeout(hideT.current), []);

  return (
    <>
      <SkyCanvas ref={cv} view={view} />
      <div ref={scrim} className="scrim" aria-hidden="true" />
      <Home ref={home} onBlog={toBlog} active={view === 'home'} />
      <Blog ref={page} slug={slug} onHome={toHome} onNav={nav} />
      {/* <About ref={page} onHome={toHome} /> */}
    </>
  );
}
