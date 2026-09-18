# 6 Minute Warning

Monorepo for 6 Minute Warning's website and Backstage, the band's management app.

| Folder | What | Where it runs |
|---|---|---|
| `site/` | Public website (Astro) | GitHub Pages, deploys on push to `main` |
| `app/` | Backstage: gigs, contracts, payments (Vue 3 + Vite) | app.6minutewarning.com on Firebase Hosting (not deployed yet) |
| `theme/` | Colour palette and tokens shared by both | |
| `docs/` | Design notes | |

## Setup

The repo uses npm 11 workspaces (npm 10 fails to resolve the site's and the app's different Vite versions).

```
npx -y npm@11.19.1 install
npm run dev:site     # website
npm run dev:app      # Backstage
npm run check        # type checks
npm test             # app unit tests
npm run build        # build everything
```

CI runs checks, lint, tests and both builds on every pull request, and deploys the site from `main`.

Site content and the booking form: `site/README.md`. Backstage plan: `docs/backstage.md`.
