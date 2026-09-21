# Backstage

The band's management app, replacing Notion. First priority: gigs, contracts and payments.

## Stack

- Vue 3 + Vite single-page app in `app/`, served at app.6minutewarning.com from Firebase Hosting.
- Firebase Authentication with Google sign-in, limited to band members.
- Firestore for records. Files (contracts, photos) stay in the band's shared Google Drive; Firestore holds the links.
- Cloud Functions for work the browser can't do: filling the contract template, sending email as manager@6minutewarning.com, and creating Google Calendar events.
- Colours come from `theme/theme.css`, shared with the site.

## Access

Sign-in is Google only. A person can use Backstage only if their email has a document in `users/` (keyed by lowercase email) with a role: admin, manager, director or member. brett@6minutewarning.com is the owner and becomes an admin on first sign-in; admins add everyone else on the Access page. A person can have several addresses (Gmail and firstname@6minutewarning.com); each address has its own `users/` record pointing at the same `people/` entry, and any of them signs in as that person with the same role. `node tools/notion-people.mjs` exports the Notion People list to `.local/people-import.json` (git-ignored), and admins import that file on the Access page: active members get their Notion address plus firstname@6minutewarning.com, subs join the roster without sign-in access, and existing roles are kept. Member emails live in Firestore, never in this public repo. `firestore/firestore.rules` enforces this, and `firestore/rules.test.ts` covers it.

## Records

| Collection | Holds |
|---|---|
| `gigs` | name, date, times, venue, presenter contact, stage, fee, deposit, format, outfit, performers |
| `contracts` | gig, status, generated PDF, sent date and recipient, reminders, signed copy |
| `payments` | gig, kind (deposit, balance, merch), amount, due date, received date |
| `people` | members and subs, part, who a sub covers, contact |
| `venues` | name, address, presenter organisation |
| `events` | every status change on a gig, for the timeline and calendar sync |

## Contract process

Contracts go out as a normal email with the PDF attached. The app enforces the steps around it:

| Step | Rule |
|---|---|
| Generate | The PDF is filled from the gig using the band's Google Doc template; the manager reviews it before it can be sent. |
| Send | It's sent from manager@ with the PDF attached; the sent date and recipient are recorded, and the calendar event is updated. |
| Chase | Reminders go out 5 and 10 days after sending if no signed copy has come back; after that the gig is flagged overdue. |
| Signed | A gig can't move to Confirmed until the signed copy is uploaded. The copy is filed in Drive under the gig. |
| Payments | Deposit and balance each have a due date; overdue payments are flagged. |

Contracts that presenters send use the same record, uploaded instead of generated.

## Deploys

Merging to `main` deploys Backstage to https://six-minute-warning.web.app and releases the Firestore rules. Pull requests get their own preview URL. CI authenticates through workload identity federation, so no service account key exists.

## Roles

| Role | Can do |
|---|---|
| Singer | Read gigs and the roster, edit gig notes and the lineup, add to the event log |
| Music director | Same as singer until set lists arrive |
| Manager | All of the above, plus create and delete gigs, edit money, contract state and presenter contacts, and manage the roster, venues and payments |
| Admin | All of the above, plus grant and remove sign-in access |

## Phases

| ID | Phase | Ships |
|---|---|---|
| P1 | Foundation | Monorepo, Firebase project, sign-in, one-time import of the Notion gigs and people |
| P2 | Gigs | Gig list with money and contract state, gig detail with lineup and sound tech, roster, and a Notion gig import (`node tools/notion-gigs.mjs`). Calendar events still to come. |
| P3 | Generate contracts | Fill the Drive template from the gig and save the PDF to Drive |
| P4 | Send and track | Email from manager@, reminders, signed-copy upload, the Confirmed gate |
| P5 | Payments | Due dates, received amounts, overdue flags |
| P6 | Presenter contracts | Upload and track contracts presenters send |

The design mockup lives at `/admin/` on the site with sample data.
