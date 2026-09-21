# Booking form endpoint

The form on the site posts to a Google Apps Script web app that emails
`manager@6minutewarning.com` and, if a sheet is configured, logs every inquiry
as a row. Until `bookingEndpoint` in `../src/data/site.ts` holds the `/exec`
URL, the form falls back to opening the visitor's mail client, which reaches
nobody on a phone or in webmail.

## What the script does

`Code.gs` reads these fields off the POST: `name`, `email`, `phone`,
`eventType`, `date`, `location`, `message`, `website`, `fillMs`. It replies
with JSON — `{"ok": true}` or `{"ok": false, "error": "…"}` — which is what
`../src/components/BookingForm.astro` checks.

`website` is a honeypot: a real person never fills it, because it is hidden.
`fillMs` is how long the visitor spent on the form, measured in their browser.
Either signal marks a submission as spam, which sends no email but is still
logged to the sheet as `spam`, so a misjudged real inquiry can be recovered.

Mail goes out through `MailApp` with reply-to set to the visitor, so hitting
reply in Gmail answers the person who wrote in.

## Do not change how the form sends

The fetch call posts `URLSearchParams` and sets no headers, so the browser
sends `application/x-www-form-urlencoded`, which is CORS-safelisted and
triggers no preflight. Apps Script cannot answer a preflight and offers no way
to set `Access-Control-Allow-Origin`, so switching the body to
`JSON.stringify` breaks every submission with no server-side fix.

## Deploying with clasp

One-time, needs a browser:

1. Turn the API on at <https://script.google.com/home/usersettings>.
2. `npx clasp login` and sign in as the account that owns
   `manager@6minutewarning.com`.

Then, from this directory:

```
npx clasp create --type webapp --title "6MW Booking Form" --rootDir .
npx clasp push
npx clasp deploy --description "Booking form v1"
npx clasp deployments
```

`deployments` prints the deployment id; the URL is
`https://script.google.com/macros/s/<id>/exec`. `appsscript.json` already sets
`executeAs: USER_DEPLOYING` and `access: ANYONE_ANONYMOUS`, so the deployment
comes out public without touching the dialog.

`clasp create` writes `.clasp.json` with the script id. Keep it out of git.

## Deploying by hand

1. At <https://script.google.com>, **New project**, named `6MW Booking Form`.
2. Paste `Code.gs` over the placeholder file.
3. Gear icon → **Project Settings** → tick **Show "appsscript.json" manifest
   file in editor**, then paste `appsscript.json` over the generated one.
4. **Deploy → New deployment** → gear → **Web app**. Execute as **Me**, Who has
   access **Anyone** — not "Anyone within the domain", because visitors are
   never signed in to Google.
5. Authorise past the "app isn't verified" warning: **Advanced → Go to 6MW
   Booking Form (unsafe) → Allow**. This grants send-mail and sheet access as
   you; visitors never see a Google screen.
6. Copy the `/exec` URL.

## The lead sheet (optional)

Create a sheet, copy the id out of its URL
(`docs.google.com/spreadsheets/d/<id>/edit`), then **Project Settings → Script
Properties → Add script property**, name `SHEET_ID`, value the id. Rows are
appended as `Timestamp, Status, Name, Email, Phone, Event Type, Date, Location,
Message`. Without the property the form still works; only the email goes out.

## Wiring it up

Put the `/exec` URL in `bookingEndpoint` in `../src/data/site.ts`, rebuild, and
send a real inquiry through `/book/` to confirm it arrives.

## Changing the script later

Editing `Code.gs` does not change what the live URL runs. Either
`npx clasp push && npx clasp deploy --deploymentId <id>`, or in the editor
**Deploy → Manage deployments →** pencil **→ Version: New version → Deploy**.
The URL stays the same.
