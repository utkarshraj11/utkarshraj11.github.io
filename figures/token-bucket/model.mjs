// The truth behind the token-bucket figure. Pure: no DOM, no kit. The page
// inlines this file with `export` stripped, so build and page share one model.
//
// This is the canonical token bucket:
//   tokens = min(capacity, tokens + refill · dt)
//   a request is allowed when tokens ≥ 1, and costs one token
// stored as a whole count `n` (the coins in the column) plus the fraction `f`
// of the next token (how far the feed wheel has turned toward its next pocket).
// While the column is full the wheel is stopped, so f stays 0: that is the min().

export const CAPACITY = 8;
export const REFILLS = [1, 2, 4];          // tokens per second the feed wheel can be set to
export const POCKETS = 8;                  // pockets on the feed wheel: one token per pocket
export const RATES = { quiet: 0.5, steady: 1.5, busy: 4 };   // incoming requests per second
export const BURST = 16;

export function createBucket(capacity = CAPACITY) {
  return { capacity, n: capacity, f: 0, made: 0, passed: 0, refused: 0 };
}

/** Run the refill for dt seconds. Returns how many whole tokens dropped into the column. */
export function refill(b, dt, rate) {
  if (b.n >= b.capacity) { b.f = 0; return 0; }
  b.f += rate * dt;
  let dropped = 0;
  while (b.f >= 1 && b.n < b.capacity) { b.f -= 1; b.n += 1; b.made += 1; dropped += 1; }
  if (b.n >= b.capacity) b.f = 0;
  return dropped;
}

/** A request reaches the gate. Allowed if a whole token is there; it takes one. */
export function admit(b) {
  if (b.n >= 1) { b.n -= 1; b.passed += 1; return true; }
  b.refused += 1;
  return false;
}

export const tokens = (b) => Math.min(b.capacity, b.n + b.f);

/** Feed wheel angle: one pocket per token made, plus the fraction toward the next. */
export const wheelTurns = (b) => (b.made + b.f) / POCKETS;
