# Backstage

The band's management app, replacing Notion. First priority: gigs, contracts and payments.

## Stack

- Vue 3 + Vite single-page app in `app/`, served at app.6minutewarning.com from Firebase Hosting.
- Firebase Authentication with Google sign-in, limited to band members.
- Firestore for records. Files (contracts, photos) stay in the band's shared Google Drive; Firestore holds the links.
- Cloud Functions for work the browser can't do: filling the contract template, sending email as manager@6minutewarning.com, and creating Google Calendar events.
- Colours come from `theme/theme.css`, shared with the site.

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

## Phases

| ID | Phase | Ships |
|---|---|---|
| P1 | Foundation | Monorepo, Firebase project, sign-in, one-time import of the Notion gigs and people |
| P2 | Gigs | Pipeline and gig editing; each stage change updates the band's Google Calendar |
| P3 | Generate contracts | Fill the Drive template from the gig and save the PDF to Drive |
| P4 | Send and track | Email from manager@, reminders, signed-copy upload, the Confirmed gate |
| P5 | Payments | Due dates, received amounts, overdue flags |
| P6 | Presenter contracts | Upload and track contracts presenters send |

The design mockup lives at `/admin/` on the site with sample data.
