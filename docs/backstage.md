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
| `venues` | name, address |
| `presenters` | name, email, phone, and the tech contact's name, email and phone |
| `tasks` | to-dos shown on a manager's Home, such as a new venue's missing address |
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

## Look

Backstage uses the public site's identity: Archivo at 125% width for headings, uppercase buttons and small blue letter-spaced labels, the wordmark with a Backstage tag, and blue date blocks. The lineup shows as a six-segment dial drawn from the 6 in the logo. Colours and fonts come from `theme/theme.css`.

## Home

Home is the signed-in person's to-do list. Under Needs you, each poll carries what a singer needs to answer it: day and date, show and call time, sets, venue and address, their pay, who is already in, and a warning when they are already booked that day or the day either side. They answer I'm in, Can't make it, or pick the date they will know by. Managers also get a to-do for every new venue and presenter. Next up shows their next booked gig with call time, outfit and who they sing with; Coming up lists the rest.

## Gig page

The top shows the date, name and the same decision facts, then the dial and the answer buttons. When someone can't make it, anyone chooses Find a sub or Drop the gig. Find a sub offers one sub at a time, same part first, with Call and Text buttons that fill in the ask, then They said yes or Said no. Everyone's answers sits in a closed section for recording answers given elsewhere. Managers get a Manage section: stage, contract, sets, pay per singer, call time, outfit, money, presenter, lineup and sound tech.

## Adding a gig

New gig is a button at the top of Gigs that opens its own page. Saving asks the band by default and lands on the gig with a Send to WhatsApp step. Venue and Presenter are search boxes over every venue and presenter used before; typing loosely still finds them. Picking a venue fills in the presenter most often booked there, and picking a presenter fills in their usual venue, when that field is still empty. Typing a name that isn't on the list adds it and opens the matching to-do. Time is a list of half hours starting at 7:30pm.

## On phones

Backstage installs to the home screen: on Android, Chrome's menu, Install app; on iPhone, Safari's Share, Add to Home Screen. The manifest's colours come from `theme/theme.css` at build time.

## Band poll

A manager adds the gig, then anyone opens the poll on its page, which asks every active member. Open polls show on Home, with the ones waiting on you under To do, answerable there. Members answer Yes or No themselves; anyone can record an answer given in WhatsApp or by phone. Six yes answers fill the lineup, in the order they came in, and tick "Who's on it".

When a member says no, anyone can choose to find a sub or abandon the gig. Finding a sub lists the subs who sing that part first, with their phone numbers; whoever calls records the answer. Abandoning cancels the gig.

"Share to WhatsApp" opens WhatsApp with the gig and its link filled in. Any member can put a hold on the 6 Minute Warning Google Calendar (`6MW HOLD: <gig>`), which invites every roster address of everyone not yet marked no, then confirm it (`6MW CONFIRMED GIG: <gig>`) once the lineup is full. The description follows the band's gig event layout. "Pull calendar replies" turns accepted and declined invites into answers. Google asks for calendar access each time, and the account needs "Make changes to events" on that calendar.

## Deploys

Merging to `main` deploys Backstage to https://six-minute-warning.web.app and releases the Firestore rules. Pull requests get their own preview URL, and CI adds that URL to the Firebase sign-in domains so people can log in on it. CI authenticates through workload identity federation, so no service account key exists.

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
| P2 | Gigs | Gig list with money and contract state, gig detail with lineup and sound tech, roster, and a Notion gig import (`node tools/notion-gigs.mjs`). |
| P2b | Band poll | Ask the band about a gig, find subs, abandon, and hold then confirm the gig on the band calendar |
| P3 | Generate contracts | Fill the Drive template from the gig and save the PDF to Drive |
| P4 | Send and track | Email from manager@, reminders, signed-copy upload, the Confirmed gate |
| P5 | Payments | Due dates, received amounts, overdue flags |
| P6 | Presenter contracts | Upload and track contracts presenters send |

The design mockup lives at `/admin/` on the site with sample data.
