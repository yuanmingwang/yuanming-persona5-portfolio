# Yuanming’s Persona

A Persona 5–inspired portfolio made by Yuanming Wang, built with **React, TypeScript, and Vite**. Explore personal files, a searchable résumé, social links, a career timeline, and questions through an animated menu with video backgrounds and optional music.

**[Visit the portfolio](https://yuanmingwang.github.io/yuanming-persona5-portfolio/)**

## What’s inside

- **About Me:** personal background, work, location, and philosophy.
- **Résumé:** education, experience, projects, skills, and coursework, with category filters and search.
- **Socials:** GitHub, LinkedIn, and email cards with Open and Copy actions.
- **Journey:** study, work, and location chapters with school and city artwork.
- **Questions:** a conversation-style introduction to the person behind the work.
- **Arcade:** Dino Runner, Night Flight, and Phantom Escape with Human and AI controls and live AI overlays.

The site uses red, black, and cream styling, character artwork, transparent video transitions, and responsive layouts. Text is editable through CSV files or published Google Sheets. It is a static website; no backend or Google account sign-in is required for visitors.

## Run locally

Install **Node.js 24**, matching the deployment workflow, then run these commands from the project folder:

```sh
npm ci
npm run dev
```

Open **http://localhost:5173/yuanming-persona5-portfolio/**. If that port is busy, use the port Vite prints and keep the `/yuanming-persona5-portfolio/` suffix.

To check the production version locally:

```sh
npm run build
npm run preview
```

Open **http://localhost:4173/yuanming-persona5-portfolio/**, or the printed port. Press `Ctrl+C` in the terminal to stop the server.

## Explore the site

Use the mouse or touch to choose an item. On a keyboard:

| Control | Action |
| --- | --- |
| ↑ / ↓ | Browse menu or section items |
| Home / End | Jump to the first or last item |
| Enter | Open the selected item |
| Tab / Shift+Tab | Move between controls |
| Escape | Close an open About, Socials, Journey, or Questions detail |

Those four pages begin with an invitation; choosing an item reveals its details. The Résumé page immediately shows a selected record. On small screens, details sit below the list. Refreshing the website returns to the main menu.

**Sound** starts off. Enable it to play the four tracks in sequence; **Next** skips to another track. Music continues while navigating. Background videos are muted and have their own pause/play control. Reduced-motion preferences skip the page transition and start backgrounds paused.

## Update the content

### Option 1: edit local CSV files

The website works with the bundled files in `src/content` without connecting a sheet:

| File | What to edit |
| --- | --- |
| [Menu CSV](src/content/persona%20-%20Menu.csv) | Main menu labels, ordering, destination background videos |
| [About CSV](src/content/persona%20-%20About.csv) | Personal file headings, descriptions, highlights, artwork choices |
| [Resume CSV](src/content/persona%20-%20Resume.csv) | Profile, education, jobs, projects, skills, coursework |
| [Socials CSV](src/content/persona%20-%20Socials.csv) | Contact links, labels, descriptions, platform icons |
| [Journey CSV](src/content/persona%20-%20Journey.csv) | Timeline chapters, dates, places, highlights, icons |
| [Questions CSV](src/content/persona%20-%20Questions.csv) | Questions, answers, topics, character artwork |

Open them in a spreadsheet editor or a text editor. Keep the header row, give each row a unique `id`, and use numeric `order` values. Changing a label does not require changing its ID. Keep the existing menu IDs so each button still opens its intended page.

Fields containing commas or line breaks need CSV quoting; a spreadsheet's CSV export handles this for you. In the Résumé `bullets` cell and Journey `highlights` cell, use actual line breaks for separate bullets. Use `|` between tags/topics. Blank lines in a Questions `answer` create paragraphs. The Résumé requires exactly one `profile` row.

A published Menu sheet can add or reorder the `arcade` row. Older sheets get the bundled Arcade entry at the end of the menu.

Dino Runner loads when you open Arcade. Its logistic classifier uses two grayscale frames to estimate obstacle gap and closing speed. To regenerate the bundled weights from synthetic frame pairs, run `node scripts/train-dino.mjs`. Night Flight runs a small CNN in the browser. It locates the bird and pipe gaps from grayscale frames, and a controller plans flaps from the resulting estimates. AI Vision shows live frames, a color-coded CNN output, position estimates, and decision timing in both Human and AI mode. Add future demos to the catalog in `src/pages/ArcadePage.tsx`.

Phantom Escape opens in AI mode. Select Start Run to watch Tactical A* collect coins, avoid phantoms, and find the exit. Show AI Plan displays its route, explored tiles, and predicted danger. Switch to Human at any time to move with WASD, the arrow keys, or the touch controls. Collect at least 60% of the coins and reach the unlocked exit before time runs out. Retry Maze restarts the same seed at level 1. New Maze starts a different run.

The first three levels alternate open arenas and room dungeons. Hybrid dungeons join the seeded rotation at level 4, and labyrinths join at level 7.

For Phantom Escape training preparation, reuse the root Python environment and
keep Node.js 24 on the path. Run these from the repository root:

```sh
.venv/bin/python -m pip install 'gymnasium>=1,<2'
.venv/bin/python -m unittest discover -s tests -p test_phantom_training.py
.venv/bin/python -m scripts.phantom_escape.benchmark --episodes 200
```

The benchmark measures a random policy on fixed seeds. The Gymnasium adapter and
reward contract are described in the [architecture guide](docs/ARCHITECTURE.md#phantom-escape-training-interface).

Install Stable-Baselines3 in the same environment, then run a short training check
and a longer arena-start run:

```sh
.venv/bin/python -m pip install 'stable-baselines3>=2.9.2,<3'
.venv/bin/python -m scripts.phantom_escape.train --steps 2048 --envs 2 --eval-episodes 0
.venv/bin/python -m scripts.phantom_escape.train --steps 500000 --stage arena --eval-episodes 200 --output training-output/phantom-escape/arena-first
```

The trainer selects CUDA when available. Pass `--device cpu` to run on the CPU.
Each run writes checkpoints, a CSV log and a final `state_ppo.zip` to a new directory
under `training-output/phantom-escape/`. To continue on mixed starting maps, add
`--resume training-output/phantom-escape/arena-first/state_ppo.zip --stage mixed`
to a training invocation with a new output directory. Use `--evaluate PATH --eval-episodes 200`
to compare a trusted checkpoint against the 200-seed random baseline.

For the next State PPO experiment, start a fresh policy from tactical demonstrations
using the navigation observation profile. It gives the learner projected movement,
collision risk, and progress toward coins or the exit for each available action.
This command trains imitation only and evaluates the saved `imitation.zip`:

```sh
.venv/bin/python -m scripts.phantom_escape.train --stage mixed --features navigation \
  --imitation-episodes 64 --imitation-epochs 20 --steps 0 --eval-episodes 200 \
  --output training-output/phantom-escape/navigation-first
```

To fine-tune that checkpoint, use a room-heavy curriculum and checkpoint selection:

```sh
.venv/bin/python -m scripts.phantom_escape.train \
  --resume training-output/phantom-escape/navigation-first/imitation.zip \
  --stage room-focus --steps 200000 --learning-rate 0.0001 \
  --select-every 50000 --validation-episodes 40 --eval-episodes 200 \
  --output training-output/phantom-escape/navigation-room-ppo
```

The selector compares the starting checkpoint with PPO checkpoints on a balanced
validation set. The final report in `evaluation.json` evaluates
`best_validation.zip` on the original 200 seeds. `validation.jsonl` records
the comparison and `state_ppo.zip` contains the final PPO weights.

Each CSV is separate: editing the résumé does not automatically update About, Journey, Questions, or the original Google Doc. Local edits appear during development; updating the deployed site requires a new deployment.

To attach a PDF to a résumé project, save it in `public/documents/project-papers/` using the project's CSV ID with hyphens replaced by underscores. Add the original ID and the PDF page count to `src/content/resumePapers.ts`. The site uses the same IDs for local and published résumé entries.

For every column and its meaning, see the [CSV reference](docs/ARCHITECTURE.md#csv-schemas).

### Option 2: use Google Sheets

Each page can use its own published CSV URL. You can connect some tabs and leave others local.

1. Import the corresponding CSV into a sheet tab, preserving its headers.
2. In Google Sheets, choose **File → Share → Publish to web**.
3. Select the intended tab and **Comma-separated values (.csv)**. Publish only content meant for public visitors.
4. Copy the published CSV URL. An editable `/edit` URL or a local `.gsheet` file will not work.
5. Copy the environment template locally:

   ```sh
   cp .env.example .env.local
   ```

   If `.env.local` already exists, edit it rather than replacing it. Add the appropriate URLs:

   | Setting | Tab |
   | --- | --- |
   | `VITE_MENU_CSV_URL` | Menu |
   | `VITE_ABOUT_CSV_URL` | About |
   | `VITE_RESUME_CSV_URL` | Resume |
   | `VITE_SOCIALS_CSV_URL` | Socials |
   | `VITE_JOURNEY_CSV_URL` | Journey |
   | `VITE_QUESTIONS_CSV_URL` | Questions |

   For example:

   ```dotenv
   VITE_ABOUT_CSV_URL="PASTE_THE_PUBLISHED_ABOUT_CSV_URL"
   ```

6. Restart the local server. For GitHub deployment, add the same names and URLs under **Settings → Secrets and variables → Actions → Variables** in the repository.

The site fetches configured sheets on page load. After changing sheet content, allow for Google's publication delay and reload the website. A missing URL uses local content; a failed or invalid remote response leaves the bundled content available. Changing a URL in GitHub variables requires another build.

**Published sheet content and `VITE_` values are public.** Never put credentials or private information in them. `.env.local` stays on your computer and is ignored by Git. For more on publishing, see [Google's instructions](https://support.google.com/docs/answer/183965).

## Change images, videos, and music

### Images

| Folder | Used for |
| --- | --- |
| `public/image/menu` | About menu portraits |
| `public/image/character` | About details, Résumé header, Questions answers |
| `public/image/character_confidant_icon` | Résumé and Socials detail-card portraits |
| `public/image/icon` | Social platform icons and Journey school/city/landmark artwork |

In fields that choose a character or portrait:

- **Blank:** pick a random eligible image.
- **Character name**, such as `makoto`: pick randomly from filenames containing that text, ignoring case.
- **Full filename:** select that file when the match is unique.

Selections stay the same while browsing a page and are drawn again when you return to the menu and re-enter. Files do not repeat within each page's selection pool; Résumé footer portraits are unique within each category. A fresh visit can still choose a previous visit's image. If nothing matches or the pool runs out, the image is omitted.

The fields `icon` and `landmark_image` use **exact filenames**, rather than random matching. The Socials page uses the supplied P5 GitHub, LinkedIn, and email icons.

Use underscores instead of spaces and match capitalization exactly. **Restart `npm run dev` after adding or renaming catalog images** so the image list refreshes. Production builds refresh it automatically. The browser tab icon is configured in `index.html`; keep its file in `public` and match its PNG/SVG type.

### Video backgrounds

Put the video in `public/video`, then enter its filename in the Menu CSV's `page_background_video` column. For example:

```csv
id,order,menu_label,page_background_video
about,1,ABOUT ME,Lavenza_animated_wallpaper.webm
```

Leave the value blank to use the CSS backdrop. The homepage uses `Joker_animated_wallpaper.webm`, configured separately in `src/pages/HomePage.tsx`. The transition uses `Persona_5_Stinger_Transition.webm`; replacing that clip also requires adjusting its timing in code.

### Music

Tracks are stored in `public/audio`. Their order and display names are defined by the `tracks` list in `src/components/SoundToggle.tsx`. Keep filenames and that list in sync when replacing songs.

## Train the Night Flight CNN

Use Node.js 24 and Python 3.13. The [Night Flight AI guide](docs/NIGHT_FLIGHT_AI.md) explains how training frames, CNN predictions, and the flight planner work together.

### Install PyTorch

Use the repository's shared `.venv` for Python model training. From the repository root on macOS, create it with Python 3.13 if needed, then activate it and install PyTorch.

```sh
python3.13 -m venv .venv
source .venv/bin/activate
python -m pip install "torch==2.12.1"
python -m pip check
```

On Windows PowerShell, create the environment with `py -3.13 -m venv .venv` and activate it with `.\.venv\Scripts\Activate.ps1`. For an NVIDIA GPU, use the [PyTorch install selector](https://pytorch.org/get-started/locally/) to find the command for your CUDA build.

### Generate frames and train

```sh
mkdir -p training-output/night-flight
node --experimental-strip-types scripts/sample-night-flight.mjs training-output/night-flight/frames.bin --frames 8000 --seed 829761
python scripts/train-night-flight.py training-output/night-flight/frames.bin training-output/night-flight/candidate.json --epochs 12 --device auto
```

Training files go in the Git-ignored `training-output/night-flight/` folder. The sampler generates 8,000 synthetic grayscale frames, about 56 MB. If `frames.bin` is already there, skip the sampler and reuse it. The trainer prints validation precision and recall and exports weights in the same JSON format as the game's `model.json`. The two scripts require new output paths so existing datasets and models are safe to reuse. Device selection tries CUDA, Apple MPS, then CPU. Use `--device cpu` to run explicitly on CPU.

### Compare and use the trained weights

```sh
node --experimental-strip-types scripts/benchmark-night-flight.mjs --runs 15 --target 150
node --experimental-strip-types scripts/benchmark-night-flight.mjs --runs 15 --target 150 --weights training-output/night-flight/candidate.json
```

Both commands play the same seeded courses. Compare how many runs reach the target and how early the remaining runs crash. To compare on fresh courses, add `--first-seed 101` to both commands. After you select a candidate, copy it to `src/demos/night-flight/model.json`, then run the tests and build. Python and training data are used locally. Visitors receive the bundled JSON weights and the TypeScript game.

## Bandwidth planning

With the current WebM backgrounds, allow approximately **20 MB per visit** for planning. The modeled average is **15.3 MB**.

| Visit | Estimated transfer |
| --- | ---: |
| Homepage only, sound off | 6.2 MB |
| Home → About → Résumé, sound off | 19–20 MB |
| All pages, sound off | 38–40 MB |
| All pages + first music track | 49–51 MB |
| All pages + all four tracks | 82–85 MB |

These estimates assume a fresh cache, full downloads of visited backgrounds, and reuse of assets already downloaded during the visit. The model assumes 70% homepage-only visits, 20% Home/About/Résumé visits, 10% full tours, and 30% of all visits downloading the first song. That gives about 12.1 MB without music or 15.3 MB including that music assumption.

Media sizes were rechecked on **November 22, 2026**: Home's WebM is 6.030 MB; all six backgrounds plus one transition total 36.776 MB; the complete playlist totals 44.327 MB. Portrait choice adds variation. Short visits may download less, while buffering, cache misses, and repeat requests can add traffic. Unused files in the build are not automatically downloaded by visitors.

At the 20 MB budget, 1,000 visits are about **20 GB** of transfer. These use decimal MB/GB. For a metered host:

```text
Monthly transfer (GB) = visits × MB per visit ÷ 1,000
Bandwidth cost = max(0, transfer − included GB) × rate per GB
```

## Hosting

The portfolio is hosted on GitHub Pages at the repository URL linked above. Its existing workflow builds and deploys from `stable`; `master` remains the development branch. Git operations are managed by the project owner.

For live Google Sheets content, configure the six optional URLs under **Settings → Secrets and variables → Actions → Variables**. Otherwise, the deployed site uses its bundled CSVs. Local `.env.local` values are not available to GitHub Actions.

Pages uses **GitHub Actions** as its publishing source, and the `github-pages` environment must allow `stable`. Deployment status is available in the repository’s [Actions tab](https://github.com/yuanmingwang/yuanming-persona5-portfolio/actions).

**Live Sheets are independent of branches.** Editing a production sheet can change the website without a new deployment. Use separate development sheets in `.env.local`, or bundled CSV snapshots for production, to keep content experiments separate.

## Checks and common fixes

Run all automated checks with:

```sh
node --experimental-strip-types --test tests/*.test.mjs
npm run build
```

For interface changes, also check the production preview on a wide screen and a phone-sized screen, including keyboard selection, detail open/close, backgrounds, and sound. Automated checks do not replace browser testing.

| Problem | What to check |
| --- | --- |
| Blank page or missing assets | Open the URL with `/yuanming-persona5-portfolio/`. Check the browser Network panel for missing files and verify exact filename capitalization. |
| New image is not selected | Restart Vite to refresh the image catalog. Check the CSV query and folder; a named query does not fall back to unrelated images. |
| Sheet edits do not appear | Confirm the published CSV URL, reload after publication updates, and check the browser console for a fallback warning. GitHub URL-variable changes need a new build. |
| Music does not play automatically | Sound is intentionally off initially; enable it with the Sound control. Background-video audio stays muted. |
| Favicon missing locally | Check the link in `index.html`, its file/type, and the actual response. A wrong path may return HTML with status 200 instead of an image. |
| `npm ci` reports missing dependencies | Check the lockfile and the run's Node/npm versions. The earlier Rolldown issue required repairing `package-lock.json`. |
| Build succeeds but `stable` cannot deploy | Allow `stable` in the `github-pages` environment's deployment branch rules, then rerun the failed job. |

Rerunning an old workflow uses the same source version. A GitHub settings-only fix can usually be followed by rerunning the failed job.

## Technical reference

For the code map, full CSV schemas, and implementation details, read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). 

Background Video:
Wallpaper Engine, author steam page: https://steamcommunity.com/id/stylegasm/

Page transition video:
https://www.youtube.com/watch?v=Nf3LuPC548g&t=12s

Audio: 
https://downloads.khinsider.com/game-soundtracks/album/persona-5-royal-the-complete-soundtrack

Menu image: 
https://www.tumblr.com/jakku-san/620012944745512960/noosey-woosey-noosey-woosey-noosey-woosey?utm_source=Pinterest&utm_medium=organic&redirect_to=%2Fjakku-san%2F620012944745512960%2Fnoosey-woosey-noosey-woosey-noosey-woosey&source=permalink_login_wall

Character image: 
https://www.spriters-resource.com/mobile/chainchronicle3/asset/98520/

Character confidant icon:
https://www.pinterest.com/livxotic/persona-5-confidant-icons/

