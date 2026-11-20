import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { SkyScene, type View } from '../scene/sky-scene';

/** Fixed full-viewport canvas that owns the procedural scene. */
export const SkyCanvas = forwardRef<HTMLCanvasElement, { view: View }>(function SkyCanvas({ view }, ref) {
  const cv = useRef<HTMLCanvasElement>(null);
  const scene = useRef<SkyScene | null>(null);
  const initialView = useRef(view);
  useImperativeHandle(ref, () => cv.current!);

  useEffect(() => {
    const s = new SkyScene(cv.current!, initialView.current);
    scene.current = s;
    return () => { s.destroy(); scene.current = null; };
  }, []);

  useEffect(() => { scene.current?.setView(view); }, [view]);

  return <canvas ref={cv} className="sky" aria-hidden="true" />;
});
