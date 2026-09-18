# 6minutewarning.com

Static Astro site for 6 Minute Warning. A push to `main` builds and deploys to GitHub Pages. Run commands from the repo root; see the root README.

## Develop

From the repo root:

```
npx npm@11 install
npm run dev:site
```

## Edit content

| What | File |
|---|---|
| Email, socials, videos, credits, testimonials | `src/data/site.ts` |
| Members, bios, alumni | `src/data/members.ts` |
| Event pages (concert series, awards, corporate, Christmas, weddings, festivals, school workshops) | `src/data/services.ts` |
| Colours, fonts, spacing | `theme/theme.css` (shared with the app) |
| Upcoming shows | `src/data/shows.ts` |
| Photos | `src/assets/` |

Shows appear only when `public: true` and stop showing the day after they happen (the deploy workflow rebuilds daily). `SHOW_DRAFT_SHOWS=1 npm run build` includes non-public shows for a local preview.

`theme/theme.css` names every hex once as a `--palette-*` colour; the `--color-*` tokens that components use point at those names. Theme variants are `[data-theme="..."]` blocks that repoint `--color-*` tokens. Add `?themes` to any URL to show a theme picker (it sticks for that browser), or `?theme=gold` to open one variant directly. Visitors see the default theme.

Adding an entry to `services` in `src/data/services.ts` creates a new event page, adds it to the nav and footer, and puts it in the sitemap.

## Booking form

The form posts to a Google Apps Script web app that emails `manager@6minutewarning.com`. Until `bookingEndpoint` in `src/data/site.ts` is set, the form opens the visitor's mail app instead.

1. Signed in to the 6MW Google account, create a project at script.google.com.
2. Paste `apps-script/Code.gs` into `Code.gs`. In Project Settings, tick "Show appsscript.json" and paste `apps-script/appsscript.json`.
3. Optional lead log: create a Google Sheet and add its ID as the script property `SHEET_ID`. Each inquiry is appended as a row.
4. Deploy → New deployment → Web app. Execute as: Me. Who has access: Anyone.
5. Copy the `/exec` URL into `bookingEndpoint` and push.

Spam handling: a hidden honeypot field and a 3-second minimum fill time, measured in the visitor's browser. Suspected spam sends no email; with `SHEET_ID` set it is still logged to the sheet, marked `spam`, so a misjudged real inquiry can be recovered.

## DNS (Namecheap)

GitHub Pages settings: source "GitHub Actions", custom domain `6minutewarning.com`, enforce HTTPS.

| Type | Host | Value |
|---|---|---|
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | `6-minute-warning.github.io` |

Leave the MX records alone; mail stays on Google Workspace.

## Old WordPress URLs

`redirects` in `astro.config.mjs` maps every old page and post URL to its new home.
