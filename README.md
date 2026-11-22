# Yuanming’s Persona

## 1. Run it

```sh
npm install
npm run dev
```

Open the local URL Vite prints. To check the production build:

```sh
npm run build
```

## 2. Understand the pieces

Follow the files in this order:

1. `src/content/persona - Menu.csv` is the menu’s content. Each row becomes one button.
2. `src/lib/content.ts` uses the existing Papa Parse library to turn CSV text into objects. It checks the headers, requires unique IDs and numeric ordering, and sorts the items. `localMenu` is available immediately. `loadMenu()` optionally fetches a published CSV using the same parser.
3. `src/App.tsx` owns the list and the navigation state. React’s `useState` remembers these values. `useEffect` loads remote content once per mount, cancelling the request on unmount. If loading fails, the local menu stays visible. Selecting a button requests its `id`; Back requests the menu. The navigation reducer changes the page beneath the transition overlay.
4. `src/pages/HomePage.tsx` draws the video, title, and buttons. `.map()` turns the menu objects into buttons. The active ID determines the highlight. A ref points to the actual navigation element so arrow keys can move keyboard focus. Enter and Space use the button’s normal behavior.
5. `src/components/SoundToggle.tsx` controls a normal HTML audio element through a ref. Playback starts after a click, and React state updates the button text. It lives outside the page switch so music continues between pages.
6. `src/styles/index.css` supplies basic global styles. `src/styles/App.css` holds the menu’s design, with numbered sections matching the visual layers. `clip-path` cuts the angular shapes, `transform` tilts the text, and media queries adapt the layout to smaller screens.

Data flow:

```text
Local CSV → parseMenu() → App state → HomePage buttons
Published sheet → fetch() → parseMenu() → same App state
Button click → selected page ID → content page
```

There is no routing library yet: the page switch is React state, so refreshing returns to the menu.

## 3. Change the menu text locally

Edit `src/content/persona - Menu.csv`:

```csv
id,order,menu_label,page_background_video
about,1,ABOUT ME,Lavenza_animated_wallpaper.mp4
resume,2,RESUME,Makoto_animated_wallpaper.mp4
socials,3,SOCIALS,Morgana_animated_wallpaper.mp4
journey,4,JOURNEY,Akechi_animated_wallpaper.mp4
questions,5,QUESTIONS,Ann_animated_wallpaper.mp4
```

- `id`: a unique internal name. Keep it stable when changing a label.
- `menu_label`: the words shown on the button (the original `label` header is also supported). CSV fields containing commas must be quoted, for example `"ABOUT ME, PERSONALLY"`.
- `order`: a number; smaller values appear first.
- `page_background_video`: optional filename from `public/video`, including its extension. Match the exact spelling and capitalization; leave it blank for the default CSS background.

Keep the header row. Do not put fonts, sizes, or colors in the sheet: those belong in CSS. Local changes update through Vite while developing; after deployment, local CSV changes require a new build/deployment.
