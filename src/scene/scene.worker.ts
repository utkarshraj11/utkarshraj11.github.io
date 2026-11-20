/// <reference lib="webworker" />
// Generates the scene off the main thread and hands back two ImageBitmaps.
import { generate } from './generate';

export interface SceneRequest { id: number; w: number; h: number }
export type SceneResponse =
  | { id: number; ok: true; world: ImageBitmap; layer: ImageBitmap; TW: number; LW: number; M: number; birds: ReturnType<typeof generate>['birds']; ms: number }
  | { id: number; ok: false; error: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (e: MessageEvent<SceneRequest>) => {
  const { id, w, h } = e.data;
  try {
    const t0 = performance.now();
    const g = generate(w, h, (cw, ch) => new OffscreenCanvas(cw, ch));
    const world = g.world.transferToImageBitmap();
    const layer = g.layer.transferToImageBitmap();
    const msg: SceneResponse = { id, ok: true, world, layer, TW: g.TW, LW: g.LW, M: g.M, birds: g.birds, ms: performance.now() - t0 };
    ctx.postMessage(msg, [world, layer]);
  } catch (err) {
    ctx.postMessage({ id, ok: false, error: String(err) } satisfies SceneResponse);
  }
};
