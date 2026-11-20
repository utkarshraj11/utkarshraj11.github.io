# Utkarsh Raj — portfolio

Personal site and blog, deployed to GitHub Pages. The home page is a painted sky: a procedural, stippled riso-style scene drawn on a canvas, with name, links and a live "what I'm doing in Riverside" status. Following the blog link flies the camera down through the clouds to a grassy landscape where the writing lives.

React 19 · TypeScript · Vite · pnpm. No UI framework, no CSS framework, no runtime dependencies beyond React.

## Running it

```sh
pnpm install
pnpm dev        # http://localhost:5173, drafts visible
pnpm build      # type-check + production build into dist/
pnpm preview    # serve dist/ locally
```

## Deploying

`.github/workflows/deploy.yml` builds and publishes to GitHub Pages on every push to `main`. In the repository settings, set **Pages → Source** to **GitHub Actions**. The build uses a relative base (`./`) and hash routing (`#blog`, `#blog/<slug>`), so it works both as `<user>.github.io` and as a project page under a sub-path.

## Writing a post

Add a markdown file to `src/posts/`. The file name is the URL slug.

```md
---
title: How a token bucket rate limiter works
date: 2026-11-20
summary: Optional one-line summary shown in the index.
draft: true
---

Body in markdown…
```

- `draft: true` shows the post in `pnpm dev` only; set it to `false` to publish.
- `date` must be `YYYY-MM-DD`; anything else lists the post as undated and warns at build time.
- Files starting with `_` are ignored, so you can keep notes there.
- Markdown is converted at build time (`build/posts-plugin.ts`), so the browser never ships a markdown parser. The index loads only titles and dates; each post's body is its own small chunk, fetched when the post is opened or its row is hovered.
- External links open in a new tab; images are lazy-loaded.

### Interactive figures

Posts can embed a self-contained figure page from `public/figures/`:

```html
<iframe
  class="figure"
  src="figures/token-bucket.html"
  title="Interactive token bucket rate limiter"
  loading="lazy"
></iframe>
```

The figure posts its height to the page (`{ type: "figure-height", height }`) and the blog sizes the iframe to fit; only same-origin messages are accepted. Figure sources live in `figures/<name>/` (`model.mjs` is the pure model, `build.mjs` the drawing, `live.js` the behaviour). They are built with the isometric figure kit from the Anatomy skill, expected at `~/.claude/skills/anatomy`:

```sh
cd figures/token-bucket && node build.mjs     # writes public/figures/token-bucket.html
```

## How it's put together

```
src/
  App.tsx              routing (hash), sky ⇄ ground transition, focus management
  components/          Home (sky), Blog (index + post), TopBar, StatusLine, Icons
                       About.tsx is parked: see "About page" below
  scene/
    sky-scene.ts       the canvas: camera descent, cloud drift, birds; stops when idle
    generate.ts        procedural scene generation (pure, seeded)
    scene.worker.ts    runs generate.ts off the main thread via OffscreenCanvas
  status.ts            the Riverside status schedule
  content.ts           links and the About page's copy
  posts.ts, posts/     blog data and markdown posts
  fonts.css, styles.css
build/posts-plugin.ts  Vite plugin: markdown → metadata + HTML at build time
figures/               sources for interactive figures in public/figures/
```

### The scene

Everything on the sky page is generated, not drawn: a vertical sky gradient with per-pixel grain, cumulus clouds built as piles of 3D spheres splatted into a height buffer, lit from the upper left, domain-warped and stippled into four flat tones, then a grass horizon with blade strokes and flower flecks. Generation is seeded (seed 5, mulberry32 + value-noise fbm), so the sky is the same on every visit, and it runs at no more than 1280 px wide internally, scaled up.

The canvas draws a world twice the viewport tall. Going to the blog eases a camera value from 0 to 1 over 1.7 s (`cam = p²(3 − 2p)`): the world scrolls up by `cam · h` and the cloud layer by `cam · 1.5h` for parallax, while the birds scatter along their headings. Once the camera has landed, the loop stops redrawing; reduced motion skips the flight and freezes the clouds.

### Status line

`src/status.ts`, on Riverside time (`America/Los_Angeles`), refreshed every 120 ms while the sky is showing:

| When                | Says            | Animation            |
| ------------------- | --------------- | -------------------- |
| before 8:00         | asleep          | `z  ` → `zZz`        |
| 8:00–9:00           | making coffee   | `c[_] ~` steam       |
| weekdays 9:00–19:00 | at the keyboard | typing `$ git push▍` |
| otherwise           | off the clock   | a wandering `~`      |

## Design reference

The look came from a design handoff, kept here in short.

**Scene palette ("riso", RGB)**

|        |                                                                           |
| ------ | ------------------------------------------------------------------------- |
| Sky    | top 40,108,140 · mid 64,132,158 · low 150,196,204                         |
| Clouds | highlight 248,240,216 · lit 240,230,202 · shade 186,208,204 / 132,178,188 |
| Grass  | 112,150,96 · 76,120,84 · 156,180,112 · ink 34,66,58                       |
| Birds  | `#16323c`                                                                 |

**Interface**

- Ink `#1d1c1a`, body `#2b2925`, muted `#45413a`, rules `rgba(29,28,26,.26)`, page `#f4f1ea`.
- Link hover: `#1f5fc4` on the ground pages, `#ffe6a3` on the sky. The ground pages sit under a 70% white wash with a 1.5 px blur on the scene.
- Type: Newsreader (400/500 and italic, with its optical-size axis) for display and body; JetBrains Mono (400/500) for meta, navigation and labels. Both are self-hosted from Google Fonts' variable files (SIL Open Font License).
- Spacing: 64 px between sections, 44 px minimum tap targets, a 640 px reading column.

**Motion**

- Sky → ground: the home content fades (0.6 s) and lifts 36vh (1.2 s, `cubic-bezier(.4,0,.2,1)`); the page rises from 50vh (1.5 s, `cubic-bezier(.22,.7,.2,1)`). A direct link lands without the transition.
- Reduced motion keeps the fades and drops the travel.
