# Project instructions

Persona 5–inspired portfolio built with React, TypeScript, Vite, plain CSS, and Papa Parse.

## Reference

- `README.md`: human-facing setup and content-editing guide.
- `docs/ARCHITECTURE.md`: code map, CSV schemas, and implementation details; consult relevant sections as needed.
- `src/App.tsx`: page composition, content loading, and state-based navigation. No router or backend.

## Content

- Editable text lives in `src/content/persona - *.csv`. Preserve IDs, ordering, quoting, and unrelated rows.
- Optional public Google Sheets URLs use `VITE_*_CSV_URL`; retain validated local CSV fallbacks. Sheets and local files are independent.
- Résumé, About, Journey, and Questions are separate content snapshots. Do not infer biography or project metrics.
- Environment values are public; `.env.local` contains local configuration and stays ignored.

## Assets and behavior

- Preserve the existing Persona 5 style and reuse available assets.
- Media filenames use underscores and exact capitalization.
- JSX public URLs use `import.meta.env.BASE_URL`. HTML public links use Vite-rewritten root paths, without `%BASE_URL%`.
- Regenerate `src/content/about-images.json` through `scripts/generate-image-manifest.mjs`, not by hand. Dev/build startup runs it automatically.
- Reuse `pickImage` / `assignImages` in `src/lib/about.ts`: blank queries randomize; names match filename substrings. Draw once per page visit, avoid duplicates within the existing pools, and redraw on re-entry.
- Reuse `useMenuKeyboard` for content-page navigation. Preserve selected-item scrolling and mouse/keyboard focus synchronization.
- Preserve the transition's covered page swap and persistent music player. Backgrounds remain muted; music is opt-in.

## Local checks

Use Node.js 24 and the existing lockfile.

```sh
npm ci
npm run dev
node --experimental-strip-types --test tests/*.test.mjs
npm run build
npm run preview
```

Dev and preview use `/yuanming-persona5-portfolio/` after the printed host/port.
Run relevant checks for code/content changes; documentation-only edits need link and factual checks.

## Documentation

Keep this file brief and project-specific. Keep user instructions in README and technical detail in the architecture guide. Update existing sections instead of appending session history.
