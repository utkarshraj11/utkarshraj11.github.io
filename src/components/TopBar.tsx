import type { MouseEvent } from 'react';
import { LINKS } from '../content';
import { SocialIcons } from './Icons';

/** Sticky bar for the "ground" pages: "↑ Utkarsh Raj" back to the sky, socials, résumé. */
export function TopBar({ onHome, label }: { onHome: (e: MouseEvent) => void; label: string }) {
  return (
    <nav className="topbar" aria-label={label}>
      <a className="topbar-home" href="./" onClick={onHome}>
        <span className="topbar-arrow" aria-hidden="true">↑</span>
        <span>Utkarsh Raj</span>
      </a>
      <div className="topbar-links">
        <SocialIcons sizes={[20, 18, 23]} />
        <a className="text-link" href={LINKS.resume} download>résumé.pdf</a>
      </div>
    </nav>
  );
}
