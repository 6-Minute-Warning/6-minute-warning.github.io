export interface Show {
  start: string;
  title: string;
  venue?: string;
  city: string;
  url?: string;
  public: boolean;
}

export const shows: Show[] = [
  { start: "2026-09-26T19:30:00-06:00", title: "6 Minute Warning in Okotoks", venue: "Old Church Theatre", city: "Okotoks, AB", public: false },
  { start: "2026-10-16", title: "OSAC showcase", city: "Saskatchewan", public: false },
  { start: "2026-11-26", title: "Festival of Trees", city: "Edmonton, AB", public: false },
  { start: "2026-12-12T19:00:00-07:00", title: "Christmas with 6 Minute Warning", venue: "Alumni Hall Theatre, Lakeland College", city: "Vermilion, AB", public: false },
  { start: "2027-04-08", title: "River Cree Resort & Casino", city: "Enoch, AB", public: false },
  { start: "2027-04-17", title: "Markerville", city: "Markerville, AB", public: false },
];

export function upcomingShows(now = new Date()) {
  const drafts = import.meta.env.SHOW_DRAFT_SHOWS === "1";
  const today = now.toISOString().slice(0, 10);
  return shows.filter((s) => (s.public || drafts) && s.start.slice(0, 10) >= today).sort((a, b) => a.start.localeCompare(b.start));
}
