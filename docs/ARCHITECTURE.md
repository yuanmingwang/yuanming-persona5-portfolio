# Architecture and maintenance map

Implementation snapshot reviewed 2026-11-22. Read [AGENTS.md](../AGENTS.md) for working
instructions and [README.md](../README.md) for user setup, hosting, bandwidth
assumptions, and troubleshooting. Recheck source before relying on counts or filenames.

## System boundaries

This is a browser-only React + TypeScript application built by Vite, using plain CSS
and Papa Parse. There is no application backend, database, authentication, React Router,
or server-side Google Drive access. React Compiler is configured through the Babel
plugin in `vite.config.ts`. GitHub Pages serves the built static files.

```text
index.html → src/main.tsx → src/App.tsx
                             ├─ data loaders + local CSV fallbacks
                             ├─ navigation reducer → one mounted page
                             ├─ persistent SoundToggle
                             └─ temporary PageTransition overlay

local CSV ?raw → parser → initial App state
optional published CSV fetch → same parser → replacement App state
public image folders → manifest generator → filename catalog → per-visit selection
```

## Where changes belong

| Concern | Files / responsibility |
| --- | --- |
| Application composition and loading | `src/App.tsx` |
| Navigation state / stinger timing rules | `src/lib/navigation.ts` |
| Transition playback, alpha detection, CSS fallback | `src/components/PageTransition.tsx`, `src/styles/PageTransition.css` |
| Destination background / playback control | `src/components/PageBackground.tsx` |
| Global playlist / sound controls | `src/components/SoundToggle.tsx` |
| Content-page keyboard listener | `src/hooks/useMenuKeyboard.ts` |
| Pure keyboard rules | `src/lib/menuKeyboard.ts` |
| Home menu and Joker video | `src/pages/HomePage.tsx`, `src/styles/App.css` |
| Five destination views | `src/pages/{About,Resume,Socials,Journey,Questions}Page.tsx` and corresponding styles |
| Global defaults / focus treatment | `src/styles/index.css` |
| Menu parsing/loading | `src/lib/content.ts` |
| Other parsers, types, filtering, image helpers | `src/lib/{about,resume,socials,journey,questions}.ts` |
| Local imports + optional remote loading | `src/lib/{about,resume,socials,journey,questions}Content.ts` |
| Authored content | `src/content/persona - *.csv` |
| Generated image filename index | `src/content/about-images.json` |
| Image index generator | `scripts/generate-image-manifest.mjs` |
| HTML metadata/favicon | `index.html` and the referenced file in `public` |
| Build base and plugins | `vite.config.ts` |
| Night Flight's trainable vision model | [Night Flight AI guide](NIGHT_FLIGHT_AI.md) |
| Deployment | `.github/workflows/deploy.yml` |

## Loading and content lifecycle

- All six local CSVs are imported as raw text and parsed for immediate initial state.
  Invalid bundled content can prevent startup; remote fallback cannot repair a bad local import.
- On App mount, all six loaders run, including content for pages not yet visited.
  Each reads an optional `VITE_*_CSV_URL`, fetches with `cache: 'no-store'` and an
  `AbortSignal`, validates, then replaces that data set. Failures leave local state
  in place; aborts are not reported as ordinary loading failures.
- No setting means no remote request for that data set. There is no polling or
  cross-source synchronization. A full application reload fetches configured URLs again.
- Published Sheets may have their own update delay. Environment URL changes require
  rebuilding production; cell content changes at an existing URL do not.
- App keys destination components by serialized content. A changed remote result
  can remount a page, resetting selection/reveal state and its image draw.
- Personal files, the résumé, journey chapters, and questions are independent CSV
  snapshots. Updating a résumé or Google Doc does not automatically rewrite the others.

## CSV schemas

Headers below are the current local schemas, not a statement that every column is
required. Validation is defined by each `parse*` function. Parsers generally trim
headers/cells, normalize header case, reject duplicate/empty IDs and invalid numeric
orders, and sort entries by `order`. Use stable IDs to preserve page behavior.

### Menu — `src/content/persona - Menu.csv`

```csv
id,order,menu_label,page_background_video
```

Known destination IDs are `about`, `resume`, `socials`, `journey`, and `questions`;
Home is navigation state `null`. The menu parser also accepts legacy `label`.
`page_background_video` is an exact filename under `public/video`, not an external URL.
Adding a CSV menu ID alone does not implement a new page: App otherwise renders a placeholder.

### About — `src/content/persona - About.csv`

```csv
id,order,menu_label,menu_subtitle,menu_image,detail_title,detail_description,detail_highlight,detail_character_image
```

`menu_image` queries the menu pool; `detail_character_image` queries the character
pool. The left label uses `menu_subtitle` when present; the detail heading uses
`detail_title`. Descriptions/highlights are plain text, not executable markup.

### Résumé — `src/content/persona - Resume.csv`

```csv
id,section,order,title,subtitle,period,location,summary,bullets,tags,link,highlight,image,confidant_image
```

Exactly one `profile` row is required. Other allowed sections: `education`, `experience`,
`projects`, `skills`, `coursework`. Category display order comes from `resumeCategories`,
not CSV physical row placement. Numeric order controls records inside a category.
Search matches titles, subtitles, summaries, dates, locations, tags, bullets, and highlights.
`bullets` splits on actual line breaks. Tags split on `|` when present, otherwise commas.
Existing cells may contain literal backslash-n text; do not silently rewrite unrelated data.
Links render only for HTTP/HTTPS. Profile `image` queries the character pool;
record `confidant_image` queries the confidant pool.

### Socials — `src/content/persona - Socials.csv`

```csv
id,order,label,kicker,handle,url,title,description,action_label,icon,confidant_image,topics
```

`icon` is an exact filename under `public/image/icon` (use the existing P5 GitHub,
LinkedIn, and email artwork). `confidant_image` is a query. Topics split on `|`.
URLs accept HTTPS or plain `mailto:` addresses without query/hash parameters.
Copying email returns the email address, not the `mailto:` prefix; profile copy
returns the URL. No background scraping or live GitHub repository feed is implemented.

### Journey — `src/content/persona - Journey.csv`

```csv
id,order,year,period,type,title,organization,city,country,description,highlights,icon,landmark_image,topics
```

Types: `education`, `experience`, `location`. Filters: all, learning, building.
The all view also includes location; study/work dates may overlap. `icon` and
`landmark_image` are exact icon-folder filenames; a blank landmark uses the icon.
Highlights split on actual line breaks; topics split on `|`. Keep historical claims
and location dates grounded in user-provided facts.

### Questions — `src/content/persona - Questions.csv`

```csv
id,order,topic,question,answer,character_image
```

Question and answer text must be nonempty. `character_image` queries the character
pool. Blank lines in the answer produce paragraphs; the UI renders plain text.

## Artwork selection

Catalog folders are `public/image/menu`, `public/image/character`, and
`public/image/character_confidant_icon`; the generator scans immediate files only,
not subdirectories. Supported extensions: PNG, JPG/JPEG, WebP, GIF, AVIF, SVG.
`public/image/icon` uses exact references and is not a random-image catalog.

`pickImage(files, query, random)` filters by case-insensitive substring and picks
one file. `assignImages(files, queries, random)` reserves narrower named queries
first, removes assigned filenames, and returns results in original row order.
Unmatched/exhausted rows receive no image. Neither function promises different
characters across visits, only fresh draws and filename uniqueness within a pool.
Two different files depicting the same character may both be selected.

| Page/artwork | Draw lifecycle and uniqueness |
| --- | --- |
| About menu + detail characters | Separate pools, each unique across its rows per visit |
| Résumé header character | One `pickImage` draw from profile `image` per visit |
| Résumé record footers | Confidant assignments unique within each category; categories may reuse files |
| Socials detail footer | Confidant pool, unique across channels per visit |
| Questions answer artwork | Character pool, unique across questions per visit |
| Journey icons/landmarks | Exact CSV filenames, no random selection |

Page state initializers make a draw stable during ordinary rerenders and section
switches. Returning Home unmounts the destination; entering again redraws. Assignment
alone does not download every portrait: only rendered `<img>` elements request files.

## Navigation, focus, and media

`navigationReducer` keeps the outgoing page until a `covered` action, then mounts
the destination beneath the overlay, then clears the transition on `finished`.
Concurrent navigation and out-of-order callbacks are ignored. The overlay's video
cue is measured in media time: `STINGER_SWITCH_TIME = 1.5`; frames arriving at or
after 2.2 seconds require a CSS fallback. The current source is
`public/video/Persona_5_Stinger_Transition.webm`. Replacing it requires rechecking
opacity timing, alpha support, buffering, and the reducer tests.

App sets content `inert` while transitioning and focuses the destination heading
only after the overlay clears. Reduced-motion navigation switches without a stinger.
The transition component detects unsupported alpha and has timeout/error CSS fallbacks.

Content pages use `useMenuKeyboard`, listening across the window because headings
and details can hold focus. Navigation skips editable fields/modifier shortcuts,
selects an enabled menu button, focuses with `preventScroll`, and schedules nearest
scrolling after React updates. Keep scroll-frame cleanup separate from the selection
listener cleanup: canceling on every selection rerender previously lost the scroll.
Home has its own handler; its pointer-enter handoff moves existing menu focus with
the hover highlight, while preserving focus on unrelated utility controls.

About, Socials, Journey, and Questions have selection plus reveal state: selecting
with arrows does not open a closed panel; Enter/click opens it. When already open,
changing selection updates the detail. Close/Escape returns to the invitation.
Résumé has categories, search, and an immediately visible selected record, including
an empty-results state. Each page owns its responsive scroll/focus behavior; current
stacking breakpoints vary (roughly 900–1000 px). Verify them rather than assuming
one shared breakpoint or complete accessibility test coverage.

Home owns its Joker WebM element. Inner pages use `PageBackground` with their Menu
CSV filename, a shade overlay, and pause/play control; missing or failed media leaves
CSS background styling. Backgrounds are muted and looping. Reduced motion starts
them paused; it does not guarantee zero network preload.

`SoundToggle` remains mounted under App, outside the destination branch. It starts
off with `preload="none"`; tracks play sequentially, wrap, and can be skipped. Audio
is separate from background videos and follows browser playback restrictions.

## Paths, caching, and deployment

The base is `/yuanming-persona5-portfolio/` in dev, preview, and GitHub Pages builds.
JSX public resources are assembled with `import.meta.env.BASE_URL`; HTML links are
rewritten by Vite from root paths. The reviewed favicon link points to
`public/persona_favicon_transparent_32.png`; inspect `index.html` before replacing it.
Previously, `%BASE_URL%` in that HTML favicon link caused a double prefix in dev:
the wrong URL returned fallback HTML with status 200. Check content type/content,
not HTTP success alone. Keep favicon type and filename consistent.

`public` is copied into `dist` regardless of whether every file is referenced. Build
storage size therefore differs from per-visit transfer. WebM selection reduced the
homepage background file from about 26.2 MB to 6.0 MB; no real visitor analytics or
cache guarantees are implied by README bandwidth estimates. Recalculate after media changes.

The Pages workflow installs locked packages, runs `tests/*.test.mjs`, builds, uploads
`dist`, and deploys only from `stable`. `master` stays the development/default branch.
Manual workflow discovery depends on its presence on the repository's default branch.
Both jobs skip non-`stable` refs. The `github-pages` environment must permit `stable`;
that is a repository setting, not an npm or Vite problem.

All six optional `VITE_*_CSV_URL` values are supplied from Actions repository variables
for deployment. They are public configuration. `.env.local` is ignored and is not
available on GitHub runners. Keeping the deployed Sheets URLs fixed does not freeze
their content; use separate development sheets or bundled snapshots when needed.

## Verification map and known limits

| Test file under `tests/` | Purpose |
| --- | --- |
| `about.test.mjs` | CSV validation, matching, no-repeat pools, fresh draws |
| `resume.test.mjs` | Parsing, filtering, link policy, footer selection |
| `socials.test.mjs` | Parsing, link validation, copy values, confidant selection |
| `journey.test.mjs` | Chapter validation, ordering, filters |
| `questions.test.mjs` | Parsing, paragraphs, ordering, per-visit artwork |
| `navigation.test.mjs` | Transition reducer and delayed-media cue behavior |
| `menu-keyboard.test.mjs` | Pure key rules, wrapping, exclusions |
| `asset-paths.test.mjs` | Media filenames, generated catalog, referenced files |

Commands live in AGENTS.md and package.json. The unit suite does not exercise actual
DOM focus, browser rendering, real media decoding, live Sheets, or remote deployments.
Use browser/manual checks for those. There is no npm `test` alias or installed browser
end-to-end suite; do not claim them. A failed remote loader leaves bundled content;
there is no live editor or automatic Google Docs-to-CSV conversion.

Historical install failure: the initial lockfile lacked Rolldown 1.3.1 platform
optional dependencies. CI npm 11.19.1 rejected it although local npm 11.6.0 accepted
it. The repair added missing entries without changing existing versions. Keep clean
install checks and `npm ci`; inspect the current CI log before assuming every later
install error has this cause. Exact tool versions and package state can change.
