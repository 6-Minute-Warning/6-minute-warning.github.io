export interface Show {
  start: string;
  title: string;
  venue?: string;
  city: string;
  url?: string;
  public: boolean;
}

export const shows: Show[] = [
  { start: "2026-09-26T19:30:00-06:00", title: "6 Minute Warning in Okotoks", venue: "Old Church Theatre", city: "Okotoks, AB", public: true },
  { start: "2026-10-16", title: "OSAC showcase", city: "Saskatchewan", public: false },
  { start: "2027-03-13", title: "SING! Edmonton Festival", city: "Edmonton, AB", public: true },
  { start: "2026-12-12T19:00:00-07:00", title: "Christmas with 6 Minute Warning", venue: "Alumni Hall Theatre, Lakeland College", city: "Vermilion, AB", public: false },
];

export function upcomingShows(now = new Date()) {
  const drafts = import.meta.env.SHOW_DRAFT_SHOWS === "1";
  const today = now.toISOString().slice(0, 10);
  return shows.filter((s) => (s.public || drafts) && s.start.slice(0, 10) >= today).sort((a, b) => a.start.localeCompare(b.start));
}

export function nextPublicShow(now = new Date()) {
  return upcomingShows(now).find((s) => s.public);
}

const zone = "America/Edmonton";
const hasTime = (start: string) => start.length > 10;

export function showDate(start: string) {
  return new Date(hasTime(start) ? start : `${start}T12:00:00-06:00`);
}

export function formatShowDay(start: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-CA", { ...options, timeZone: zone }).format(showDate(start));
}

export function formatShowTime(start: string) {
  return hasTime(start) ? formatShowDay(start, { hour: "numeric", minute: "2-digit" }) : null;
}
