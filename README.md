# Neil & Vishruti · wedding invitation

The scroll-driven invite for **neilwedsvishruti.in**. `BRIEF.md` is the full
spec; the site itself lives in `site/`.

```
BRIEF.md        the brief: story, copy, visual system, build stages
assets/         original artwork (inputs to the image pipeline)
site/           the website (Vite + GSAP + Lenis)
  src/          the code: config.js holds the timeline and the RSVP URL
  public/img/   processed images (made by the pipeline, not by hand)
  scripts/      image pipeline (npm run pipeline) and helpers
  apps-script/  the Google Sheets RSVP receiver + SETUP.md
sources/        private photos: never committed, never deployed
```

## Working on it

```sh
cd site
npm install
npm run dev        # http://localhost:5173
npm run build      # production build into site/dist
```

## Deploying

Vercel is connected to this GitHub repo (project root: `site/`).

- **Push to `main` → production.** It goes live for guests within a minute or two.
- **Push to any other branch → a private preview link**, shown on GitHub and in
  the Vercel dashboard. Check changes there before merging into `main`.

## RSVP

Follow `site/apps-script/SETUP.md` to create the Sheet and publish the script,
then paste the web-app URL into `RSVP_URL` in `site/src/config.js`.
