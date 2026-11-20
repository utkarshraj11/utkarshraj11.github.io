import { forwardRef, type MouseEvent } from 'react';
import { LINKS } from '../content';
import { SocialIcons } from './Icons';
import { StatusLine } from './StatusLine';

export const Home = forwardRef<HTMLElement, { onBlog: (e: MouseEvent) => void; active: boolean }>(function Home({ onBlog, active }, ref) {
  return (
    <header ref={ref} className="home" data-screen-label="Home">
      <h1 className="home-name">Utkarsh Raj</h1>
      <div className="home-meta">
        <div className="home-sub">Software engineer · M.S. Computer Science, UC Riverside</div>
        <StatusLine active={active} />
      </div>
      <nav className="home-nav" aria-label="Primary">
        <div className="icon-row">
          <SocialIcons sizes={[23, 21, 26]} />
        </div>
        <span className="home-divider" aria-hidden="true" />
        {/* About is parked for now — restore with the About view in App.tsx.
        <a className="text-link" href="#about" onClick={onAbout}>about me ↓</a> */}
        <a className="text-link" href="#blog" onClick={onBlog}>blog ↓</a>
        <a className="text-link" href={LINKS.resume} download>résumé.pdf</a>
      </nav>
    </header>
  );
});
