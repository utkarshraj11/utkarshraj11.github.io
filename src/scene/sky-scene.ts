// Owns the full-viewport sky canvas: gets the scene generated (in a worker when
// the browser supports OffscreenCanvas, otherwise on the main thread), then
// draws the camera descent, cloud drift and birds.
import type { Bird, Generated } from './generate';
import type { SceneRequest, SceneResponse } from './scene.worker';

export type View = 'home' | 'about';

const BIRD = '#16323c'; // riso palette `bird` (generate.ts)
const DESCENT_S = 1.7;
const FRAME_MS = 38; // ~26fps

interface Built { world: CanvasImageSource; layer: CanvasImageSource; TW: number; LW: number; M: number; birds: Bird[] }

const canUseWorker = () =>
  typeof Worker !== 'undefined' &&
  typeof OffscreenCanvas !== 'undefined' &&
  'transferToImageBitmap' in OffscreenCanvas.prototype;

export class SkyScene {
  private canvas: HTMLCanvasElement;
  private view: View;
  private pr: number;
  private flyDir = 1;
  private t0 = performance.now();
  private raf = 0;
  private built: Built | null = null;
  private builtW = 0;
  private builtH = 0;
  private buildT = 0;
  private rsT = 0;
  private reduced: MediaQueryList;
  private worker: Worker | null = null;
  private reqId = 0;

  constructor(canvas: HTMLCanvasElement, view: View) {
    this.canvas = canvas;
    this.view = view;
    this.pr = view === 'about' ? 1 : 0;
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    window.addEventListener('resize', this.onResize);
    // Safari < 14 only has the deprecated addListener.
    if (this.reduced.addEventListener) this.reduced.addEventListener('change', this.onMotionPref);
    else this.reduced.addListener?.(this.onMotionPref);
    if (canUseWorker()) {
      try {
        this.worker = new Worker(new URL('./scene.worker.ts', import.meta.url), { type: 'module' });
        this.worker.onmessage = this.onWorkerMessage;
        this.worker.onerror = () => this.dropWorker('worker failed to start');
      } catch { this.worker = null; }
    }
    this.buildT = window.setTimeout(() => this.build(), 40);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    clearTimeout(this.buildT);
    clearTimeout(this.rsT);
    window.removeEventListener('resize', this.onResize);
    if (this.reduced.removeEventListener) this.reduced.removeEventListener('change', this.onMotionPref);
    else this.reduced.removeListener?.(this.onMotionPref);
    this.worker?.terminate();
    this.worker = null;
    this.release(this.built);
    this.built = null;
  }

  setView(view: View) {
    if (view === this.view) return;
    this.view = view;
    this.loop();
  }

  private get animate() { return !this.reduced.matches; }

  private onResize = () => {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    this.draw();
    // Mobile browser toolbars nudge the height while scrolling; redrawing the
    // existing scene covers that. Only a real size change (rotation, window
    // resize) is worth the full rebuild.
    if (this.built && w === this.builtW && Math.abs(h - this.builtH) / this.builtH < 0.2) return;
    clearTimeout(this.rsT);
    this.rsT = window.setTimeout(() => this.build(), 250);
  };

  private onMotionPref = () => this.loop();

  /** Request a scene for the current canvas size. Worker first; main thread as the fallback. */
  private build() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight; if (!w || !h) return;
    const id = ++this.reqId;
    performance.mark(`sky:build:${id}`);
    if (this.worker) {
      this.worker.postMessage({ id, w, h } satisfies SceneRequest);
      return;
    }
    // Main-thread fallback: the generator is only downloaded when it's needed here.
    import('./generate')
      .then(({ generate }) => {
        if (id !== this.reqId) return;
        const g: Generated<HTMLCanvasElement> = generate(w, h, (cw, ch) => {
          const c = document.createElement('canvas'); c.width = cw; c.height = ch; return c;
        });
        this.accept(id, w, h, g);
      })
      .catch(err => {
        // No 2D context, or out of memory on a huge screen: the CSS gradient stays as the sky.
        console.error('[sky] scene build failed; showing fallback sky', err);
      });
  }

  private onWorkerMessage = (e: MessageEvent<SceneResponse>) => {
    const m = e.data;
    if (!m.ok) { this.dropWorker(m.error); return; }
    if (m.id !== this.reqId) { m.world.close(); m.layer.close(); return; } // superseded by a newer resize
    performance.measure('sky:generate (worker)', { start: performance.now() - m.ms, duration: m.ms });
    this.accept(m.id, this.canvas.clientWidth, this.canvas.clientHeight, m);
  };

  /** Worker unusable (e.g. no Path2D in workers on an older engine): fall back to the main thread for good. */
  private dropWorker(reason: string) {
    if (!this.worker) return;
    console.warn('[sky] worker unavailable, generating on the main thread:', reason);
    this.worker.terminate();
    this.worker = null;
    this.build();
  }

  private accept(id: number, w: number, h: number, g: Built) {
    performance.measure('sky:build', `sky:build:${id}`);
    this.release(this.built);
    this.built = { world: g.world, layer: g.layer, TW: g.TW, LW: g.LW, M: g.M, birds: g.birds };
    this.builtW = w; this.builtH = h;
    this.draw();
    this.loop();
  }

  private release(b: Built | null) {
    if (!b) return;
    for (const img of [b.world, b.layer]) if (typeof ImageBitmap !== 'undefined' && img instanceof ImageBitmap) img.close();
  }

  /**
   * Animates while there is something to see: the descent/ascent, and the drifting
   * clouds and bobbing birds of the sky view. Once the camera has settled on the
   * ground (behind the blur and white wash) it draws a final frame and stops, so a
   * reader on the blog isn't paying for a full-screen re-blur 26 times a second.
   */
  private loop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    const target = () => (this.view === 'about' ? 1 : 0);
    if (!this.animate) { this.pr = target(); this.flyDir = 1; this.draw(); return; }
    let last = 0;
    const step = (now: number) => {
      this.raf = requestAnimationFrame(step);
      if (now - last < FRAME_MS) return;
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      this.flyDir = target() ? 1 : -1;
      this.pr = Math.max(0, Math.min(1, this.pr + (this.flyDir * dt) / DESCENT_S));
      this.draw();
      if (target() === 1 && this.pr >= 1) { cancelAnimationFrame(this.raf); this.raf = 0; }
    };
    this.raf = requestAnimationFrame(step);
  }

  private draw() {
    const c = this.canvas, B = this.built; if (!B) return;
    const w = c.clientWidth, h = c.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1); if (!w || !h) return;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const x = c.getContext('2d'); if (!x) return;
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    const live = this.animate, t = live ? (performance.now() - this.t0) / 1000 : 3, pr = this.pr, cam = pr * pr * (3 - 2 * pr), sx = w / B.TW;
    x.globalAlpha = 1; x.drawImage(B.world, 0, -cam * h, w, 2 * h);
    x.drawImage(B.layer, -B.M * sx + (live ? Math.sin(t * 0.11) * (B.M - 4) * sx : 0), -cam * 1.5 * h, B.LW * sx, 1.5 * h);
    const D = 1.15 * Math.hypot(w, h), back = this.flyDir < 0 ? -1 : 1;
    x.fillStyle = BIRD;
    for (const b of B.birds) {
      const p = Math.max(0, Math.min(1, pr * 1.6 - b.delay * 0.6)), e = p * p * back, busy = Math.min(1, p * 8);
      const bx = b.x * w + Math.cos(b.head) * D * e + (live ? Math.sin(t * 0.5 + b.ph) * 5 : 0), by = b.y * h + Math.sin(b.head) * D * e + (live ? Math.cos(t * 0.4 + b.ph) * 4 : 0);
      if (bx < -60 || bx > w + 60 || by < -60 || by > h + 60) continue;
      const f = (1 - busy) * (0.85 + 0.15 * Math.sin(t * 2 + b.ph)) + busy * (0.55 + 0.45 * Math.sin(t * 20 + b.ph));
      x.save(); x.translate(bx, by); x.rotate(b.head); x.scale(b.sc, b.sc);
      x.beginPath(); x.moveTo(9, 0); x.quadraticCurveTo(4, -2.2, 1.5, -2); x.lineTo(-5, -12 * f); x.quadraticCurveTo(-2.5, -5, -4, -1.6); x.lineTo(-11, -3.2); x.lineTo(-8, 0); x.lineTo(-11, 3.2); x.lineTo(-4, 1.6); x.quadraticCurveTo(-2.5, 5, -5, 12 * f); x.lineTo(1.5, 2); x.quadraticCurveTo(4, 2.2, 9, 0); x.closePath(); x.fill();
      x.restore();
    }
  }
}
