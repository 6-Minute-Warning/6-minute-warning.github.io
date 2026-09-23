import { execSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { shows, formatShowDay } from "../src/data/shows.ts";

const globalRoot = execSync("npm root -g").toString().trim();
const { chromium } = (await import(pathToFileURL(`${globalRoot}/playwright/index.js`).href)).default;

const source = new URL("./press-info.html", import.meta.url);
const output = fileURLToPath(new URL("../public/brand/6mw-press-info.pdf", import.meta.url));

const today = new Date().toISOString().slice(0, 10);
const upcoming = shows
  .filter((s) => s.public && s.start.slice(0, 10) >= today)
  .sort((a, b) => a.start.localeCompare(b.start))
  .map((s) => ({
    date: formatShowDay(s.start, { weekday: "short", month: "long", day: "numeric", year: "numeric" }),
    place: [s.title, s.venue, s.city].filter(Boolean).join(" · "),
  }));
const updated = `Updated ${new Intl.DateTimeFormat("en-CA", { month: "long", year: "numeric" }).format(new Date())}`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(source.href, { waitUntil: "networkidle" });
await page.evaluate(
  ({ upcoming, updated }) => {
    document.getElementById("updated").textContent = updated;
    if (!upcoming.length) return;
    const list = document.getElementById("shows-list");
    for (const show of upcoming) {
      const li = document.createElement("li");
      const date = document.createElement("span");
      date.className = "shows__date";
      date.textContent = show.date;
      li.append(date, show.place);
      list.append(li);
    }
    document.getElementById("shows").hidden = false;
  },
  { upcoming, updated },
);
await page.evaluate(() => document.fonts.ready);
await page.pdf({ path: output, format: "Letter", printBackground: true, preferCSSPageSize: true });
await browser.close();
console.log(`Wrote ${output}`);
