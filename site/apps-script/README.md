# Booking form endpoint

The form on the site posts to a Google Apps Script web app that emails
`manager@6minutewarning.com` and, if a sheet is configured, logs every inquiry
as a row. Until `bookingEndpoint` in `../src/data/site.ts` holds the `/exec`
URL, the form falls back to opening the visitor's mail client, which reaches
nobody on a phone or in webmail.

## What the script does

`Code.gs` reads these fields off the POST: `name`, `email`, `phone`,
`eventType`, `date`, `location`, `message`, `budget`, `website`, `fillMs`. It replies
with JSON — `{"ok": true}` or `{"ok": false, "error": "…"}` — which is what
`../src/components/BookingForm.astro` checks.

`website` is a honeypot: a real person never fills it, because it is hidden.
`fillMs` is how long the visitor spent on the form, measured in their browser.
Either signal marks a submission as spam, which sends no email but is still
logged to the sheet as `spam`, so a misjudged real inquiry can be recovered.
Content that reads like spam (see `judge`) is emailed with `[Likely spam]` in
the subject and logged as `suspect`, but skips Backstage and notifications.

Every other inquiry is also written to Firestore as `inquiries/<id>` with
status `new`, which puts it on the managers' Backstage Home, and each manager
device in `pushTokens` with the `inquiries` topic gets a notification. A
failure in either step is logged and skipped.

Mail goes out through `MailApp` with reply-to set to the visitor, so hitting
reply in Gmail answers the person who wrote in.

## Do not change how the form sends

The fetch call posts `URLSearchParams` and sets no headers, so the browser
sends `application/x-www-form-urlencoded`, which is CORS-safelisted and
triggers no preflight. Apps Script cannot answer a preflight and offers no way
to set `Access-Control-Allow-Origin`, so switching the body to
`JSON.stringify` breaks every submission with no server-side fix.

## Deploying with clasp (v3)

`@google/clasp` is 3.x here, run via `npx @google/clasp`. Command names changed
from v2: `push`/`login` are the same, but deploying is `create-deployment`
(alias `deploy`) and listing deployments is `list-deployments` (alias
`deployments`).

One-time, needs a browser:

1. Turn the API on at <https://script.google.com/home/usersettings>.
2. `npx @google/clasp login` and sign in as the account that owns
   `manager@6minutewarning.com`.

The script project already exists — reuse its id, don't `clasp create` a new
one. `.clasp.json` in this directory holds `scriptId` and `rootDir: "."`.

v3's project-file auto-discovery does not reliably find `.clasp.json` from cwd
in this repo (`push`/`show-file-status` fail with "Project settings not
found"). Pass it explicitly with an absolute path via `-P`:

```
cd site/apps-script
npx @google/clasp -P "$(pwd)/.clasp.json" push --force
npx @google/clasp -P "$(pwd)/.clasp.json" create-deployment --description "Booking form endpoint v1"
npx @google/clasp -P "$(pwd)/.clasp.json" list-deployments
```

`create-deployment` prints the deployment id; the URL is
`https://script.google.com/macros/s/<id>/exec`. `appsscript.json` already sets
`executeAs: USER_DEPLOYING` and `access: ANYONE_ANONYMOUS`, so the deployment
comes out public without touching a dialog — confirmed via the Apps Script API
(`GET /v1/projects/<scriptId>/deployments/<id>`), which echoes the same values
back in `entryPoints[0].webApp.entryPointConfig` on the created deployment.

`.clasp.json` holds the script id and is gitignored at the repo root; never
commit it.

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
Message, Budget`. Without the property the form still works; only the email goes out.

## Wiring it up

Put the `/exec` URL in `bookingEndpoint` in `../src/data/site.ts`, rebuild, and
send a real inquiry through `/book/` to confirm it arrives.

## Backstage and phone notifications

The script writes to Firestore and sends notifications with its own OAuth
token (`ScriptApp.getOAuthToken()`), so there is no service account key and
no Cloud Functions. Firestore
calls made with a Google account's token skip the security rules and use that
account's IAM access instead, so the account set under Execute as (the one that deployed the web app) needs:

| On project `six-minute-warning` | For |
|---|---|
| Cloud Datastore User | writing `inquiries`, reading `users` and `pushTokens` |
| Firebase Cloud Messaging Admin | sending notifications |
| Service Usage Consumer | the `x-goog-user-project` header that bills calls to this project |

A project Owner or Editor already has all three. Grant them at
<https://console.cloud.google.com/iam-admin/iam?project=six-minute-warning>.

After pushing a new `Code.gs` and `appsscript.json`:

1. In the editor, pick `checkSetup` and **Run**. Google asks for the new
   permissions (Firestore, Cloud Messaging, external requests); allow them.
   The log should say `Firestore reachable`.
2. Redeploy the web app as a new version (below), so the live URL gets the new
   code and permissions.
3. Each manager opens Backstage on their phone (on iPhone, from the home screen
   icon) and taps **Turn on** on Home.
4. Run `sendTestPush` from the editor. Every manager phone that turned
   notifications on gets "Test from the booking form".

If `checkSetup` fails with `403 ... has not been used in project` or
`USER_PROJECT_DENIED`, the account lacks Service Usage Consumer on
`six-minute-warning`, or the Cloud Firestore or Firebase Cloud Messaging
API is off there. A `404` for a user or token is normal.

Any Apps Script function, including a time-driven trigger, can call
`sendPush(topic, note)`. `note` is `{ title, body, link, tag }`.

## Changing the script later

Editing `Code.gs` does not change what the live URL runs. Either:

```
npx @google/clasp -P "$(pwd)/.clasp.json" push --force
npx @google/clasp -P "$(pwd)/.clasp.json" update-deployment -i <deploymentId>
```

(`update-deployment` is aliased `redeploy` in v3), or in the editor
**Deploy → Manage deployments →** pencil **→ Version: New version → Deploy**.
The URL stays the same either way.

## Troubleshooting: anonymous /exec returns "You need access" (403)

A versioned deployment can come back from the Apps Script API showing the
correct config (`access: ANYONE_ANONYMOUS`, `executeAs: USER_DEPLOYING`) and
still 403 an anonymous `curl`/visitor request with Google Drive's "You need
access" page instead of running the script. This happened on first deploy from
a Google Workspace account (`brett@6minutewarning.com`, not a personal Gmail).

The `@HEAD` deployment (the untitled one `clasp list-deployments` always
shows) redirects anonymous requests to a Google login — that's expected, `@HEAD`
always requires the developer to be signed in regardless of the manifest. Only
a real numbered deployment (`@1`, `@2`, …) is supposed to honor
`ANYONE_ANONYMOUS` for a signed-out visitor.

Suspected cause: the Workspace domain's Drive external-sharing policy, which
can block anonymous execution of a script owned by a Workspace account even
when the deployment's own access is "Anyone". Checking/loosening this needs
the Workspace admin console (Apps → Google Workspace → Drive and Docs →
Sharing settings → external sharing) — not something `clasp` or the Apps
Script API can read or change. Confirm with a real (not curl) anonymous
request — an incognito browser window — before spending more time on it.
