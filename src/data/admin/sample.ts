export const stages = ["Enquiry", "Booking", "Confirmed", "Completed"] as const;
export type Stage = (typeof stages)[number];

export const actionLabels = {
  ok: "All good",
  contact: "Contact presenter",
  contract: "Contract needed",
  payment: "Payment follow-up",
  tbc: "To be confirmed",
} as const;
export type Action = keyof typeof actionLabels;

export const checklist = [
  "Availability check & calendar",
  "Set list picked",
  "Rehearsals booked",
  "Admin",
  "Poster design",
  "Marketing",
  "Merch",
  "Post mortem",
] as const;

export interface CalendarEvent {
  label: string;
  date: string;
}

export interface Gig {
  id: string;
  name: string;
  venue: string;
  city: string;
  date: string;
  time: string;
  stage: Stage;
  action: Action;
  fee: number;
  paid: number;
  merch: number;
  contract: "Not started" | "Drafting" | "Awaiting signature" | "Signed";
  format: string;
  outfit: string;
  callTime: string;
  performers: string[];
  done: string[];
  calendar: CalendarEvent[];
}

export const calendarSteps = ["New tentative gig", "Gig confirmed", "Contract uploaded", "Deposit received", "Show day", "Thank-you sent"];

export const members = [
  { id: "bryan", name: "Bryan LeGrow", part: "Musical director", status: "Active" },
  { id: "brett", name: "Brett Ludwig", part: "Vocal percussion", status: "Active" },
  { id: "bernard", name: "Bernard Quilala", part: "Tenor", status: "Active" },
  { id: "brayden", name: "Brayden Foo", part: "Tenor", status: "Active" },
  { id: "taylor", name: "Taylor Fawcett", part: "Tenor", status: "Active" },
  { id: "jo", name: "Jo Tong", part: "Bass", status: "Active" },
  { id: "sub-bass", name: "Sam Sample", part: "Bass", status: "Sub" },
  { id: "sub-tenor", name: "Terry Sample", part: "Tenor", status: "Sub" },
];

export const subs = [
  { id: "sub-bass", covers: ["jo"], phone: "(780) 555-0142", email: "sam@example.com", lastGig: "2025-12-06" },
  { id: "sub-tenor", covers: ["bernard", "brayden", "taylor"], phone: "(780) 555-0187", email: "terry@example.com", lastGig: "2026-02-27" },
];

export const staleAfterDays = 120;

const core = ["bryan", "brett", "bernard", "brayden", "taylor", "jo"];

export const gigs: Gig[] = [
  {
    id: "riverbend",
    name: "Riverbend Concert Series",
    venue: "Riverbend Community Hall",
    city: "Sample Town, AB",
    date: "2026-10-03",
    time: "7:30 p.m.",
    stage: "Confirmed",
    action: "payment",
    fee: 3200,
    paid: 1600,
    merch: 0,
    contract: "Signed",
    format: "2 × 50 min sets, 20 min intermission",
    outfit: "Black suits, blue ties",
    callTime: "4:30 p.m. load-in",
    performers: core,
    done: ["Availability check & calendar", "Admin", "Set list picked", "Poster design"],
    calendar: [
      { label: "New tentative gig", date: "2026-06-02" },
      { label: "Gig confirmed", date: "2026-06-20" },
      { label: "Contract uploaded", date: "2026-06-24" },
      { label: "Deposit received", date: "2026-07-10" },
    ],
  },
  {
    id: "prairie-awards",
    name: "Prairie Business Awards gala",
    venue: "Sample Hotel ballroom",
    city: "Edmonton, AB",
    date: "2026-11-14",
    time: "6:00 p.m.",
    stage: "Booking",
    action: "contract",
    fee: 2500,
    paid: 0,
    merch: 0,
    contract: "Drafting",
    format: "Anthem opener and three short sets between awards",
    outfit: "Black suits, blue ties",
    callTime: "4:00 p.m.",
    performers: core,
    done: ["Availability check & calendar"],
    calendar: [{ label: "New tentative gig", date: "2026-08-30" }],
  },
  {
    id: "harbourview",
    name: "Harbourview Arts Council Christmas",
    venue: "Harbourview Theatre",
    city: "Sample City, BC",
    date: "2026-12-05",
    time: "7:00 p.m.",
    stage: "Confirmed",
    action: "ok",
    fee: 4000,
    paid: 2000,
    merch: 0,
    contract: "Signed",
    format: "2 × 45 min sets, Christmas repertoire",
    outfit: "Black suits, red ties",
    callTime: "3:00 p.m.",
    performers: ["bryan", "brett", "bernard", "brayden", "taylor", "sub-bass"],
    done: ["Availability check & calendar", "Admin", "Rehearsals booked"],
    calendar: [
      { label: "New tentative gig", date: "2026-05-11" },
      { label: "Gig confirmed", date: "2026-05-30" },
      { label: "Contract uploaded", date: "2026-06-02" },
      { label: "Deposit received", date: "2026-06-15" },
    ],
  },
  {
    id: "sample-holiday",
    name: "Sample Energy staff holiday party",
    venue: "Sample Convention Centre",
    city: "Edmonton, AB",
    date: "2026-12-11",
    time: "8:00 p.m.",
    stage: "Enquiry",
    action: "contact",
    fee: 1800,
    paid: 0,
    merch: 0,
    contract: "Not started",
    format: "Two 20 min sets during dinner",
    outfit: "Black suits, red ties",
    callTime: "TBC",
    performers: [],
    done: [],
    calendar: [],
  },
  {
    id: "sample-wedding",
    name: "Sample wedding ceremony and cocktails",
    venue: "Sample Golf Club",
    city: "St. Albert, AB",
    date: "2027-06-19",
    time: "3:00 p.m.",
    stage: "Enquiry",
    action: "tbc",
    fee: 1500,
    paid: 0,
    merch: 0,
    contract: "Not started",
    format: "Processional, signing, 30 min cocktail set",
    outfit: "Black suits, blue ties",
    callTime: "TBC",
    performers: [],
    done: [],
    calendar: [],
  },
  {
    id: "lakeside",
    name: "Lakeside Summer Festival",
    venue: "Lakeside Park main stage",
    city: "Sample Lake, AB",
    date: "2026-08-08",
    time: "2:15 p.m.",
    stage: "Completed",
    action: "payment",
    fee: 2800,
    paid: 1400,
    merch: 640,
    contract: "Signed",
    format: "3 × 30 min sets",
    outfit: "Summer whites",
    callTime: "12:30 p.m.",
    performers: core,
    done: ["Availability check & calendar", "Admin", "Set list picked", "Rehearsals booked", "Poster design", "Marketing", "Merch"],
    calendar: [
      { label: "New tentative gig", date: "2026-03-02" },
      { label: "Gig confirmed", date: "2026-03-15" },
      { label: "Contract uploaded", date: "2026-03-18" },
      { label: "Deposit received", date: "2026-04-01" },
      { label: "Show day", date: "2026-08-08" },
    ],
  },
];

export type Answer = "yes" | "no" | "maybe";

export const availability: Record<string, Record<string, Answer>> = {
  riverbend: { bryan: "yes", brett: "yes", bernard: "yes", brayden: "yes", taylor: "yes", jo: "yes" },
  "prairie-awards": { bryan: "yes", brett: "yes", bernard: "maybe", brayden: "yes", taylor: "yes", jo: "yes" },
  harbourview: { bryan: "yes", brett: "yes", bernard: "yes", brayden: "yes", taylor: "yes", jo: "no", "sub-bass": "yes" },
  "sample-holiday": { bryan: "yes", brett: "maybe", bernard: "yes", taylor: "yes", jo: "yes" },
  "sample-wedding": { brett: "yes" },
};

export interface Song {
  id: string;
  title: string;
  key: string;
  minutes: number;
  status: "Ready" | "Learning" | "Retired";
  soloist: string;
  tags: string[];
  lastPerformed: string;
  readiness: Record<string, 1 | 2 | 3>;
}

export const readinessLabels = { 1: "Learning notes", 2: "Off book, shaky", 3: "Performance ready" } as const;

export const songs: Song[] = [
  { id: "o-canada", title: "O Canada", key: "B♭", minutes: 2, status: "Ready", soloist: "", tags: ["Anthem"], lastPerformed: "2026-08-08", readiness: { bryan: 3, brett: 3, bernard: 3, brayden: 3, taylor: 3, jo: 3, "sub-bass": 3, "sub-tenor": 3 } },
  { id: "attention", title: "Attention", key: "E♭ minor", minutes: 4, status: "Ready", soloist: "bernard", tags: ["Pop"], lastPerformed: "2026-08-08", readiness: { bryan: 3, brett: 3, bernard: 3, brayden: 3, taylor: 3, jo: 3, "sub-bass": 2, "sub-tenor": 3 } },
  { id: "hallelujah", title: "Hallelujah", key: "C", minutes: 5, status: "Ready", soloist: "taylor", tags: ["Ballad"], lastPerformed: "2026-08-08", readiness: { bryan: 3, brett: 3, bernard: 3, brayden: 3, taylor: 3, jo: 2, "sub-bass": 3, "sub-tenor": 2 } },
  { id: "bringin", title: "Bringin' It Back", key: "G", minutes: 4, status: "Ready", soloist: "brayden", tags: ["Original"], lastPerformed: "2026-02-27", readiness: { bryan: 3, brett: 3, bernard: 3, brayden: 3, taylor: 2, jo: 3, "sub-bass": 1, "sub-tenor": 2 } },
  { id: "let-it-snow", title: "Let It Snow", key: "D", minutes: 3, status: "Ready", soloist: "taylor", tags: ["Christmas"], lastPerformed: "2025-12-13", readiness: { bryan: 3, brett: 3, bernard: 3, brayden: 3, taylor: 3, jo: 2, "sub-bass": 3, "sub-tenor": 3 } },
  { id: "bleak-midwinter", title: "In the Bleak Midwinter", key: "F", minutes: 4, status: "Learning", soloist: "jo", tags: ["Christmas"], lastPerformed: "", readiness: { bryan: 3, brett: 2, bernard: 2, brayden: 1, taylor: 2, jo: 2, "sub-bass": 1, "sub-tenor": 1 } },
  { id: "stand-by", title: "Stand By Christmas", key: "A", minutes: 4, status: "Learning", soloist: "brayden", tags: ["Christmas", "Music video"], lastPerformed: "", readiness: { bryan: 3, brett: 2, bernard: 1, brayden: 3, taylor: 1, jo: 1, "sub-bass": 1 } },
  { id: "sample-medley", title: "Sample 90s R&B medley", key: "Various", minutes: 7, status: "Learning", soloist: "bernard", tags: ["Pop"], lastPerformed: "", readiness: { bryan: 2, brett: 2, bernard: 2, brayden: 1, taylor: 1, jo: 1, "sub-tenor": 1 } },
];

export const setlists: Record<string, string[]> = {
  riverbend: ["o-canada", "attention", "bringin", "hallelujah", "sample-medley"],
  harbourview: ["let-it-snow", "bleak-midwinter", "stand-by", "hallelujah"],
};

export const rehearsals = [
  { date: "2026-09-22", time: "7:00–9:30 p.m.", place: "Sample rehearsal studio", focus: ["sample-medley", "bleak-midwinter"] },
  { date: "2026-09-29", time: "7:00–9:30 p.m.", place: "Sample rehearsal studio", focus: ["stand-by", "attention"] },
  { date: "2026-10-01", time: "7:00–8:30 p.m.", place: "Sample living room", focus: ["o-canada", "attention", "bringin", "hallelujah", "sample-medley"] },
];

export const tasks = [
  { gig: "riverbend", task: "Send invoice for the remaining balance", category: "Admin", owner: "manager", due: "2026-09-25", status: "To do" },
  { gig: "riverbend", task: "Book rehearsal studio and confirm schedule", category: "Rehearsals", owner: "bryan", due: "2026-09-20", status: "Done" },
  { gig: "riverbend", task: "Confirm gear and in-ear packs are packed", category: "Gear", owner: "brett", due: "2026-10-02", status: "To do" },
  { gig: "riverbend", task: "Arrange carpool and accommodation", category: "Travel", owner: "taylor", due: "2026-09-30", status: "In progress" },
  { gig: "prairie-awards", task: "Send performance contract", category: "Admin", owner: "manager", due: "2026-09-21", status: "To do" },
  { gig: "harbourview", task: "Create Facebook event", category: "Marketing", owner: "brayden", due: "2026-10-15", status: "To do" },
  { gig: "harbourview", task: "Design gig poster", category: "Poster design", owner: "brett", due: "2026-10-20", status: "To do" },
  { gig: "harbourview", task: "Order new merch", category: "Merch", owner: "manager", due: "2026-10-30", status: "To do" },
];

export const expenses = [
  { who: "brett", what: "Batteries and gaffer tape", amount: 38.4, date: "2026-09-02", status: "Submitted" },
  { who: "taylor", what: "Gas, Lakeside Summer Festival", amount: 72.1, date: "2026-08-09", status: "Approved" },
  { who: "bryan", what: "Rehearsal studio, August", amount: 180, date: "2026-08-31", status: "Reimbursed" },
];

export const inquiries = [
  { received: "2026-09-17", from: "Sample planner", type: "Awards gala", date: "2027-02-12", where: "Calgary, AB", message: "Awards night for 400 guests; music between presentations." },
  { received: "2026-09-15", from: "Sample couple", type: "Wedding", date: "2027-06-19", where: "St. Albert, AB", message: "Ceremony and cocktail hour, outdoors." },
  { received: "2026-09-10", from: "Sample arts council", type: "Concert series or presenter", date: "2027-03-20", where: "Sample Town, SK", message: "Considering you for our 2027 season." },
];

export const deadlines = [
  { date: "2026-09-30", label: "Showcase technical questionnaire due" },
  { date: "2026-10-16", label: "Showcase performance" },
  { date: "2027-04-01", label: "Arts education grant application due" },
];

export const today = "2026-09-18";

export function memberName(id: string) {
  if (id === "manager") return "Manager";
  return members.find((m) => m.id === id)?.name ?? id;
}

export function daysSince(date: string) {
  return date ? Math.round((Date.parse(today) - Date.parse(date)) / 86400000) : Infinity;
}

export function isStale(song: Song) {
  return song.status === "Ready" && daysSince(song.lastPerformed) > staleAfterDays;
}

export function firstName(id: string) {
  return memberName(id).split(" ")[0];
}

export function money(n: number) {
  const digits = Number.isInteger(n) ? 0 : 2;
  return n.toLocaleString("en-CA", { style: "currency", currency: "CAD", minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function day(date: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }) {
  if (!date) return "—";
  return new Date(`${date}T12:00:00-06:00`).toLocaleDateString("en-CA", { ...opts, timeZone: "America/Edmonton" });
}

export function gigById(id: string) {
  return gigs.find((g) => g.id === id);
}

export function songById(id: string) {
  return songs.find((s) => s.id === id);
}

export function upcomingGigs() {
  return gigs.filter((g) => g.date >= today && g.stage !== "Completed").sort((a, b) => a.date.localeCompare(b.date));
}
