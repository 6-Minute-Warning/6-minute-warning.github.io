# 6 Minute Warning

Monorepo for 6 Minute Warning's website and Backstage, the band's management app.

| Folder | What | Where it runs |
|---|---|---|
| `site/` | Public website (Astro) | GitHub Pages, deploys on push to `main` |
| `app/` | Backstage: gigs, contracts, payments (Vue 3 + Vite) | app.6minutewarning.com on Firebase Hosting (not deployed yet) |
| `theme/` | Colour palette and tokens shared by both | |
| `firestore/` | Firestore security rules, indexes and rules tests | Firebase project `six-minute-warning` |
| `docs/` | Design notes | |

## Setup

The repo uses npm 11 workspaces (npm 10 fails to resolve the site's and the app's different Vite versions).

```
npx -y npm@11.19.1 install
npm run dev:site     # website
npm run dev:app      # Backstage
npm run check        # type checks
npm test             # app unit tests
npm run test:rules   # Firestore rules tests (needs Java 21+ for the emulator)
npm run build        # build everything
```

CI runs checks, lint, unit and rules tests, and both builds on every pull request. On `main` it deploys the website to GitHub Pages and Backstage (app and Firestore rules) to Firebase. Pull requests get a Backstage preview URL, printed in the run summary, that expires after 14 days.

CI signs in to Firebase through GitHub's own identity (workload identity federation) as `github-deploy@six-minute-warning.iam.gserviceaccount.com`, which only this repo may use. No key is stored anywhere.

To run Backstage against local emulators instead of the live project:

```
npx firebase emulators:start --only auth,firestore
VITE_EMULATORS=1 npm run dev:app
```

Site content and the booking form: `site/README.md`. Backstage plan: `docs/backstage.md`.
