import { useEffect, useState } from 'react';
import { readStatus } from '../status';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * "{h:mm AM} in Riverside, CA · {label} {ascii anim}", refreshed every 120ms —
 * only while the sky view is showing and the tab is visible.
 */
export function StatusLine({ active }: { active: boolean }) {
  const [s, setS] = useState(() => readStatus(reducedMotion()));
  useEffect(() => {
    if (!active) return;
    setS(readStatus(reducedMotion())); // catch up immediately on return
    const id = setInterval(() => {
      if (document.hidden) return;
      const next = readStatus(reducedMotion());
      setS(prev => (prev.clock === next.clock && prev.label === next.label && prev.frame === next.frame ? prev : next));
    }, 120);
    return () => clearInterval(id);
  }, [active]);
  return (
    <div className="status">
      <span>{s.clock}</span>
      <span className="status-now">
        <span className="status-dot" aria-hidden="true">·</span>
        <span>{s.label}</span>
        <span className="status-anim" aria-hidden="true">{s.frame}</span>
      </span>
    </div>
  );
}
