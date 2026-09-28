# Backstage

The band's management app, replacing Notion. First priority: gigs, contracts and payments.

## Stack

- Vue 3 + Vite single-page app in `app/`, served at app.6minutewarning.com from Firebase Hosting.
- Firebase Authentication with Google sign-in, limited to band members.
- Firestore for records. Files (contracts, photos) stay in the band's shared Google Drive; Firestore holds the links.
- Cloud Functions for work the browser can't do: filling the contract template, sending email as manager@6minutewarning.com, and creating Google Calendar events.
- Colours come from `theme/theme.css`, shared with the site.

## Access

Sign-in is Google only. A person can use Backstage only if their email has a document in `users/` (keyed by lowercase email) with a role: admin, manager, director or member. brett@6minutewarning.com is the owner and becomes an admin on first sign-in; admins add everyone else on the Access page. A person can have several addresses (Gmail and firstname@6minutewarning.com); each address has its own `users/` record pointing at the same `people/` entry, and any of them signs in as that person with the same role. A person can also hold duties on top of their role; the only duty is `scheduler` (Books rehearsals), stored as `duties` on each of their `users/` records and ticked by an admin on the Access page. `node tools/notion-people.mjs` exports the Notion People list to `.local/people-import.json` (git-ignored), and admins import that file on the Access page: active members get their Notion address plus firstname@6minutewarning.com, subs join the roster without sign-in access, and existing roles are kept. Member emails live in Firestore, never in this public repo. `firestore/firestore.rules` enforces this, and `firestore/rules.test.ts` covers it.

## Records

| Collection | Holds |
|---|---|
| `gigs` | name, date, times, venue, presenter contact, stage, fee, deposit, format, outfit, performers, rehearsals needed (count, note, who set it) |
| `contracts` | gig, status, generated PDF, sent date and recipient, reminders, signed copy |
| `payments` | gig, kind (deposit, balance, merch), amount, due date, received date |
| `gigs/{id}/expenses` | kind (travel, meals, gear rental, hotel, other), description, amount; managers only |
| `people` | members and subs, part, who a sub covers, contact |
| `venues` | name, address |
| `presenters` | name, email, phone, and the tech contact's name, email and phone |
| `tours` | name, leave and return dates, whether they're rough, places, a plan of show, travel and free days, what's covered, pay, commit-by date, poll and committed lineup; answers under `tours/{id}/answers` |
| `tasks` | to-dos on a manager's Home: a new venue's missing address, and presenter follow-ups that were done, snoozed or added by hand |
| `rehearsals` | date, start, end, place, address, the gig ids it prepares for (`gigs`, empty for a whole-band rehearsal), notes, band calendar event; `replies/{person}` holds each singer's yes or no |
| `events` | every status change on a gig, for the timeline and calendar sync |
| `inquiries` | booking form submissions: who, event type, date, place, budget, message, and status: new, replied, booked, declined (Not a fit) or spam |
| `pushTokens` | one per device that gets notifications: its Firebase Cloud Messaging token, whose it is, and the topics it gets |

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

Home is the signed-in person's to-do list. Under Needs you, each poll carries what a singer needs to answer it: day and date, show and call time, sets, venue and address, their pay, who is already in, and a warning when they are already booked that day or the day either side. They answer I'm in, Can't make it, or pick the date they will know by. Managers also get a to-do for every new venue and presenter, and every booking inquiry from the website that isn't spam, with Reply (opens a drafted email), Turn into a gig (opens New gig filled in from the inquiry), Not a fit (optionally sending a polite no) and Spam. Replying moves an inquiry to Leads, where it stays until it becomes a gig or not a fit.

Managers also get Get back to: every presenter the band owes a message, with why, how late it is, an Email button that opens their mail app with the message drafted, a done button and Snooze, which hides it for a week. There are three kinds:

| Kind | Shows when | Done means |
|---|---|---|
| Gig | A tentative gig's lineup is full (send the quote); a contracting gig has no contract, from 60 days before the date; a sent contract is unsigned, from 45 days before; the band dropped a gig (tell the presenter) | Quote sent moves the gig to Contracting; Contract sent marks the contract sent; Chase sent brings it back in 5 days; Done closes a dropped gig's message |
| Reply | A manager adds a reply they owe with who, what they asked and a reply-by date; `inquiry` can hold a website inquiry's id. New website inquiries have their own card under Needs you | Closed |
| Season | While a season is being booked, presenters who booked that season in the last three years and have nothing booked this time | Closed for that season this year |

| Season | Ask from | Due | Gigs |
|---|---|---|---|
| Spring and festival | Jan 5 | Jan 31 | March to May |
| Summer outdoor | Feb 15 | Mar 31 | June to August |
| Fall concert | May 1 | Jun 15 | September to mid-November |
| Holiday | Aug 15 | Sep 30 | Nov 15 to December |

Gig and season follow-ups come from the gigs; a `tasks` document with `kind: followup` is written only when one is done, snoozed or added by hand.

Next rehearsal and Next gig show the next of each, sooner one first; Coming up lists the rest of both by date.

## Rehearsals

The Rehearsals page lists what's coming. Each rehearsal shows time, place with a map link, notes, what it's for, and who's coming. Everyone expected is counted as coming until they tap Can't make it; I can come after all undoes it. A whole-band rehearsal expects every active member; a rehearsal for a gig expects the singers booked on that gig, subs included, or every active member while the gig has no lineup yet.

Whoever Books rehearsals (Joseph) and managers book, edit and cancel them. The booking form suggests a week after the last rehearsal, at the same time and place. Ticking the calendar box puts the rehearsal on the band calendar (`6MW rehearsal: <gig>`) and invites the singers expected.

Whoever Books rehearsals gets these to-dos on Home. They are derived from the records, not stored in `tasks`, so booking clears them:

- Book the next rehearsal, when nothing is booked from today on.
- Book N more rehearsals before a gig, when the music director's `rehearsals.needed` on the gig is more than the rehearsals listing that gig on or before its date.

Push reminders for these to-dos belong to 6MW-48. The `pushTokens` route works without Blaze: a daily Apps Script can apply the rules in `schedulerTodos()` (`app/src/lib/schedule.ts`) and notify a scheduler topic.

## Rehearsals needed

The music director says how many rehearsals the band needs before each gig. When a gig's lineup fills, or changes after the last answer (a sub comes in, someone drops), the music director gets a to-do on Home: the date and time left, who is singing with subs marked, the set length, the last answer and who has joined or left since. The answer is a number and an optional note, such as "2 full + 1 sectional for Sam". A first guess can go in on the gig page before the lineup is known. Everyone sees the number on the gig page; the music director and managers can change it there.

It is stored on the gig as `rehearsals`:

| Field | Holds |
|---|---|
| `needed` | whole number of rehearsals, 0 to 20 |
| `note` | free text, up to 200 characters |
| `by` | email of whoever answered |
| `at` | server time of the answer |
| `lineupKey` | the performer ids the answer was for, sorted and comma-joined |

The answer is for the current lineup when `lineupKey` equals `lineupKey(gig.performers)` from `app/src/lib/rehearsals.ts`; `needsRehearsalAnswer` says when the director owes a new one. Rehearsal booking reads `needed` as the target count.

## Gig page

The top shows the date, name and the same decision facts, then the dial and the answer buttons. When someone can't make it, anyone chooses Find a sub or Drop the gig. Find a sub offers one sub at a time, same part first, with Call and Text buttons that fill in the ask, then They said yes or Said no. Everyone's answers sits in a closed section for recording answers given elsewhere. Managers get a Manage section: stage, contract, sets, call time, outfit, money, presenter, lineup, sound tech and the payout.

## Payout

The fee less the gig's expenses is split eight ways: six singers, the sound tech and the group account. Each share is rounded down to the nearest $25 and the group account takes what's left, so a $3,100 fee with $600 of travel and meals pays $300 each and $400 to the group. A sub gets the same share as the member they replace. With no sound tech on the gig, that share goes to the group; an open singer seat keeps its share until someone fills it.

The payout card on the gig's Manage section holds the fee, the expenses, the working, and one line per person with a Paid tick. Pay per singer is calculated unless a manager sets it by hand; set-by-hand pay shows a tag and can be reset, and the new gig form previews it from the fee. Singers and the sound tech see that figure as Your pay, with the date once they're marked paid. Only managers can read expenses.

## Adding a gig

New gig is a button at the top of Gigs that opens its own page. Saving asks the band by default and lands on the gig with a Send to WhatsApp step. Venue and Presenter are search boxes over every venue and presenter used before; typing loosely still finds them. Picking a venue fills in the presenter most often booked there, and picking a presenter fills in their usual venue, when that field is still empty. Typing a name that isn't on the list adds it and opens the matching to-do. Time is a list of half hours starting at 7:30pm.

## Gig requests from the assistant

Brett's assistant, a person or an AI agent, adds gig requests without the web app. Each request lands like a gig made on New gig: tentative, the venue and presenter matched to ones used before (loose match, as in the search boxes) or added with a to-do, and the band asked only when the request says so. Every request also gets a manager to-do on Home, a card showing the dates, facts, contact, fee and any gig already on those days, with Open gig and Mark checked. The gig page shows a From the assistant chip, and the gig records who sent it in `createdBy`.

There is no server to run, so it works on Firebase's free Spark plan. The assistant signs in as its own Backstage user and writes to Firestore directly; the security rules limit that user.

### One-time setup (Brett)

1. Firebase console, Authentication, Sign-in method: add Email/Password.
2. Pick an address only you control, such as assistant@6minutewarning.com, and a long random password. Give both to the assistant as `BACKSTAGE_EMAIL` and `BACKSTAGE_PASSWORD`.
3. Run `BACKSTAGE_EMAIL=… BACKSTAGE_PASSWORD=… node tools/gig-request.mts --setup`, then open the verification link it sends to that inbox.
4. On the Access page, add the address with the Assistant role.

To cut the assistant off, remove the address on the Access page. To change the password, use Authentication, Users in the Firebase console.

### Sending a request

Node 22.18 or later, from a checkout of this repo:

```
export BACKSTAGE_EMAIL=assistant@6minutewarning.com BACKSTAGE_PASSWORD=…
node tools/gig-request.mts --dry-run request.json   # prints the plan; saves nothing
node tools/gig-request.mts request.json             # use - for stdin
```

```json
{
  "name": "Festival of Trees Gala",
  "dates": ["2026-12-12", "2026-12-05"],
  "time": "7:30pm",
  "venue": "Winspear Centre",
  "presenter": { "name": "Lee Park", "email": "lee@example.com", "phone": "780-555-0199" },
  "fee": 3100,
  "perSinger": 300,
  "sets": "2 × 45 min",
  "notes": "Lee emailed manager@ on Sept 28. 400 guests, dinner first.",
  "ask": false
}
```

| Field | Required | Notes |
|---|---|---|
| `name` | yes | Up to 120 characters |
| `date` or `dates` | yes | `YYYY-MM-DD`. `dates` lists up to 6 possible days in any order; the gig is filed under the earliest and keeps them all in `dateOptions` |
| `time` | no | Show time. `7:30 PM`, `19:30` and `7:30pm` all become `7:30pm`; anything else is kept as written. Blank means not set yet |
| `venue` | no | Matched to an existing venue; a new name adds the venue and an "add the address" to-do |
| `presenter` | no | A name, or `{ name, email, phone }`. Matched to an existing presenter; a new one is added with a "complete contact and tech details" to-do. With a known venue and no presenter, the presenter most often booked there is filled in, and the other way round |
| `fee` | no | Total fee in dollars; only managers see it |
| `perSinger` | no | Each singer's pay in dollars |
| `sets` | no | Up to 60 characters, such as `2 × 45 min` |
| `notes` | no | Up to 2000 characters; singers see these on the gig |
| `ask` | no | `true` opens the band poll for every active member. Default `false`: a manager asks the band from the gig page after checking the request |

The script prints the new gig's id and link, whether it added a venue or presenter, and how many members it asked. Unknown fields, bad dates and negative amounts are refused with every problem listed. A gig with the same name and earliest date is refused with a link to the existing one.

### What the rules allow

The Assistant role can create a gig only if it is tentative, has no contract, lineup or money received, carries `createdBy` equal to the assistant's address, and comes with its `tasks/request-<gig id>` to-do in the same write. It can add venues (without an address), presenters and their to-dos, and write to the event log. `firestore/rules.test.ts` covers this. Other clients can use the Firestore REST API the same way: sign in with `accounts:signInWithPassword`, then send every document the script sends in one `documents:commit`, as listed by `planRequest` in `app/src/lib/request.ts`.

## On phones

Backstage installs to the home screen: on Android, Chrome's menu, Install app; on iPhone, Safari's Share, Add to Home Screen. The manifest's colours come from `theme/theme.css` at build time.

## Notifications

Managers turn on notifications from Home, once per phone. On iPhone that works only after Add to Home Screen. Each device saves a token to `pushTokens`; the booking form's Apps Script reads the tokens for a topic and sends through the Firebase Cloud Messaging HTTP API, with no Cloud Functions, so the Spark plan is enough. `app/public/sw.js` shows the notification and opens the link it carries. Setup is in `site/apps-script/README.md`.

## Band poll

A manager adds the gig, then anyone opens the poll on its page, which asks every active member. Open polls show on Home, with the ones waiting on you under To do, answerable there. Members answer Yes or No themselves; anyone can record an answer given in WhatsApp or by phone. Six yes answers fill the lineup, in the order they came in, and tick "Who's on it".

When a member says no, anyone can choose to find a sub or abandon the gig. Finding a sub lists the subs who sing that part first, with their phone numbers; whoever calls records the answer. Abandoning cancels the gig.

"Share to WhatsApp" opens WhatsApp with the gig and its link filled in. Any member can put a hold on the 6 Minute Warning Google Calendar (`6MW HOLD: <gig>`), which invites every roster address of everyone not yet marked no, then confirm it (`6MW CONFIRMED GIG: <gig>`) once the lineup is full. The description follows the band's gig event layout. "Pull calendar replies" turns accepted and declined invites into answers. Google asks for calendar access each time, and the account needs "Make changes to events" on that calendar.

## Tours

A tour is one record spanning every day away, travel included, with one poll for the whole span. Managers add it from New tour on Gigs; rough dates are fine. New tours start with a travel day at each end and show days between; managers mark each day Show, Travel or Free, add the city, and turn a show day into a gig once there's a venue.

Singers see the tour on Home with the dates, weekdays off work, what the band pays, what they pay, what they earn, the commit-by date and who's going. They answer All of it, Can't go, Part of it (tap the days they can't be there, with an optional note), or the date they'll know by. Moving the dates asks everyone again, since an answer only counts for the dates it was given against.

The tour page shows a strip of days, each with the lineup dial filling toward six; tap a day to see who's there, who's away and who hasn't answered. When someone's absence leaves show days short, anyone can find a sub for those days or for the whole tour: a sub's yes covers just the missing days. Once every show day has six, a manager commits the lineup, which records who sings each show day and fills in any linked gigs. Moving the dates after that reopens it.

## Deploys

Merging to `main` deploys Backstage to https://six-minute-warning.web.app and releases the Firestore rules. Pull requests get their own preview URL, and CI adds that URL to the Firebase sign-in domains so people can log in on it. CI authenticates through workload identity federation, so no service account key exists.

## Roles

| Role | Can do |
|---|---|
| Singer | Read gigs and the roster, edit gig notes and the lineup, add to the event log |
| Music director | Same as singer, plus set how many rehearsals each gig needs, with a to-do on Home when a lineup fills or changes |
| Books rehearsals (a duty, on any role) | Book, edit and cancel rehearsals |
| Manager | All of the above, plus create and delete gigs, edit money, contract state and presenter contacts, and manage the roster, venues and payments |
| Admin | All of the above, plus grant and remove sign-in access |
| Assistant | Reads everything. Adds gig requests with any new venue, presenter and to-dos. Can't edit, delete or answer polls |

## View as

An admin can pick a role or a person under View as in the account menu and see Backstage as they would: their Home to-dos and polls, gig pages without Manage, no Access tab. A bar under the header names who is being viewed and has Stop; every button and field on the page is disabled meanwhile, so nothing is recorded as them, and the Firestore rules still check the admin's real sign-in.

Every role check reads `auth.access` or a flag computed from it in `stores/auth.ts` (`isManager`, `canBook` and the rest), which already holds the viewed role and person, so a new role check belongs there as another computed. Only the account menu reads `auth.realAccess` and `auth.realEmail`.

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
