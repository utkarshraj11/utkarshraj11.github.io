---
title: How a token bucket rate limiter works
date: 2026-11-20
summary: A bucket of tokens, a steady refill, and one token per request. An interactive look at the algorithm.
draft: false
---

A rate limiter decides, request by request, whether to let traffic through. The token bucket is the most common way to do it: it allows short bursts but holds sustained traffic to a fixed rate.

<iframe class="figure" src="figures/token-bucket.html" title="Interactive token bucket rate limiter" loading="lazy"></iframe>

## The rule

The bucket holds up to a fixed number of tokens (8 above) and refills at a steady rate (2 per second). When a request arrives:

- if there is at least one token, it takes one and goes through;
- if the bucket is empty, it is refused, which an HTTP API answers with `429 Too Many Requests`.

A full bucket stops refilling, so tokens never pile up beyond its capacity.

## What that buys you

- **Bursts are allowed, up to a limit.** After a quiet spell the bucket is full, so a sudden burst gets through until the tokens run out.
- **Sustained load is capped.** Once the bucket is empty, requests pass only as fast as tokens come back: exactly the refill rate.

```ts
function allow(bucket: Bucket, now: number): boolean {
  const elapsed = (now - bucket.updatedAt) / 1000;
  bucket.tokens = Math.min(bucket.capacity, bucket.tokens + elapsed * bucket.refillPerSecond);
  bucket.updatedAt = now;
  if (bucket.tokens < 1) return false;
  bucket.tokens -= 1;
  return true;
}
```
