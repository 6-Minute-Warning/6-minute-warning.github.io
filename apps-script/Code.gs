const RECIPIENT = "manager@6minutewarning.com";
const MIN_FILL_MS = 3000;
const FIELDS = ["name", "email", "phone", "eventType", "date", "location", "message"];

function doPost(e) {
  const p = e.parameter;
  const loadedAt = Number(p.loadedAt);
  if (p.website || !loadedAt || Date.now() - loadedAt < MIN_FILL_MS) {
    return json({ ok: true });
  }
  if (!p.name || !p.email || !p.message) {
    return json({ ok: false, error: "missing fields" });
  }

  const subject = `Booking inquiry: ${p.eventType || "Event"}${p.date ? ` on ${p.date}` : ""} (${p.name})`;
  const body = FIELDS.map((k) => `${k}: ${p[k] || ""}`).join("\n");
  MailApp.sendEmail({ to: RECIPIENT, replyTo: p.email, subject, body, name: "6minutewarning.com" });

  const sheetId = PropertiesService.getScriptProperties().getProperty("SHEET_ID");
  if (sheetId) {
    SpreadsheetApp.openById(sheetId).getSheets()[0].appendRow([new Date(), ...FIELDS.map((k) => p[k] || "")]);
  }
  return json({ ok: true });
}

function json(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
