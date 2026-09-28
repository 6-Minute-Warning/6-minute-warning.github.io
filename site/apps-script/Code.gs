const RECIPIENT = "manager@6minutewarning.com";
const OWNER = "brett@6minutewarning.com";
const PROJECT = "six-minute-warning";
const FIRESTORE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const FCM = `https://fcm.googleapis.com/v1/projects/${PROJECT}/messages:send`;
const MIN_FILL_MS = 3000;
const PUSHES_PER_HOUR = 10;
const FIELDS = ["name", "email", "phone", "eventType", "date", "location", "message", "budget"];
const LIMITS = { name: 120, email: 160, phone: 40, eventType: 60, date: 10, location: 160, message: 4000, budget: 60 };
const SPAM_WORDS =
  /\b(seo|backlinks?|crypto|bitcoin|casino|viagra|cialis|forex|payday loans?|guest posts?|link building|web design services|first page of google|increase (your )?(traffic|sales|ranking))\b/i;

function doPost(e) {
  const raw = e.parameter;
  const p = clean(raw);
  const verdict = judge(raw, p);
  if (verdict !== "spam" && (!p.name || !p.email || !p.message)) {
    return json({ ok: false, error: "missing fields" });
  }

  if (verdict !== "spam") {
    const subject = `${verdict === "suspect" ? "[Likely spam] " : ""}Booking inquiry: ${p.eventType || "Event"}${p.date ? ` on ${p.date}` : ""} (${p.name})`;
    const body = FIELDS.map((k) => `${k}: ${p[k]}`).join("\n");
    attempt("email", () => MailApp.sendEmail({ to: RECIPIENT, replyTo: p.email, subject, body, name: "6minutewarning.com" }));
  }

  if (verdict === "ok") {
    const id = attempt("save inquiry", () => saveInquiry(p));
    if (id && underPushCap()) {
      attempt("push", () =>
        sendPush("inquiries", {
          title: `Booking inquiry from ${p.name}`,
          body: [p.eventType, p.date, p.location].filter(Boolean).join(" · ") || p.message.slice(0, 120),
          link: `/#inquiry-${id}`,
          tag: `inquiry-${id}`,
        }),
      );
    }
  }

  const sheetId = PropertiesService.getScriptProperties().getProperty("SHEET_ID");
  if (sheetId) {
    SpreadsheetApp.openById(sheetId)
      .getSheets()[0]
      .appendRow([new Date(), verdict === "ok" ? "sent" : verdict, ...FIELDS.map((k) => p[k])]);
  }
  return json({ ok: true });
}

function clean(params) {
  const out = {};
  for (const k of FIELDS) {
    const value = String(params[k] || "");
    out[k] = (k === "message" ? value : value.replace(/[\r\n\t]+/g, " ")).trim().slice(0, LIMITS[k]);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(out.date)) out.date = "";
  if (!/^[^@\s?&]+@[^@\s?&]+\.[^@\s?&]+$/.test(out.email)) out.email = "";
  return out;
}

/** Returns "spam" (a bot: drop it), "suspect" (email it, flagged) or "ok". */
function judge(raw, p) {
  if (raw.website || !(Number(raw.fillMs) >= MIN_FILL_MS)) return "spam";
  const text = `${p.name} ${p.message}`;
  const links = (p.message.match(/https?:\/\/|www\./gi) || []).length;
  const letters = text.replace(/[^\p{L}]/gu, "").length;
  const foreign = text.replace(/[^\p{Script=Cyrillic}\p{Script=Han}\p{Script=Hangul}\p{Script=Arabic}\p{Script=Thai}]/gu, "").length;
  if (/https?:\/\/|www\./i.test(p.name) || links >= 3 || SPAM_WORDS.test(text)) return "suspect";
  if (letters && foreign / letters > 0.3) return "suspect";
  return "ok";
}

/** Caps notifications per hour so a flood of forged submissions can't keep buzzing phones. */
function underPushCap() {
  const cache = CacheService.getScriptCache();
  const sent = Number(cache.get("pushes") || 0);
  if (sent >= PUSHES_PER_HOUR) return false;
  cache.put("pushes", String(sent + 1), 3600);
  return true;
}

function attempt(label, work) {
  try {
    return work();
  } catch (err) {
    console.error(`${label} failed: ${err}`);
    return null;
  }
}

function saveInquiry(p) {
  const fields = {
    status: { stringValue: "new" },
    source: { stringValue: "website" },
    receivedAt: { timestampValue: new Date().toISOString() },
  };
  for (const k of FIELDS) fields[k] = { stringValue: p[k] };
  return firestore("post", "/inquiries", { fields }).name.split("/").pop();
}

/** Sends a notification to every manager device subscribed to the topic; returns how many it reached. */
function sendPush(topic, note) {
  const roles = {};
  let sent = 0;
  for (const doc of subscribers(topic)) {
    const f = doc.fields;
    const email = f.email.stringValue;
    if (!(email in roles)) roles[email] = attempt("role check", () => isManager(email)) === true;
    if (!roles[email]) continue;
    const code = fcm(f.token.stringValue, note);
    if (code === 404) firestore("delete", `/pushTokens/${doc.name.split("/").pop()}`);
    else if (code < 300) sent++;
  }
  return sent;
}

function subscribers(topic) {
  const rows = firestore("post", ":runQuery", {
    structuredQuery: {
      from: [{ collectionId: "pushTokens" }],
      where: { fieldFilter: { field: { fieldPath: "topics" }, op: "ARRAY_CONTAINS", value: { stringValue: topic } } },
    },
  });
  return rows.filter((r) => r.document).map((r) => r.document);
}

function isManager(email) {
  if (email === OWNER) return true;
  const res = request("get", `${FIRESTORE}/users/${encodeURIComponent(email)}`);
  const code = res.getResponseCode();
  if (code === 404) return false;
  if (code >= 300) throw new Error(`role check for ${email} failed: ${code} ${res.getContentText()}`);
  const role = JSON.parse(res.getContentText()).fields?.role?.stringValue;
  return role === "admin" || role === "manager";
}

function fcm(token, note) {
  const data = { title: note.title, body: note.body, link: note.link, tag: note.tag || "" };
  const res = request("post", FCM, {
    message: { token, data, webpush: { headers: { Urgency: "high", TTL: "86400" } } },
  });
  const code = res.getResponseCode();
  if (code >= 300 && code !== 404) console.error(`push failed: ${code} ${res.getContentText()}`);
  return code;
}

function firestore(method, path, body) {
  const res = request(method, FIRESTORE + path, body);
  const code = res.getResponseCode();
  if (code >= 300 && !(method === "delete" && code === 404)) throw new Error(`Firestore ${code}: ${res.getContentText()}`);
  return method === "delete" ? null : JSON.parse(res.getContentText());
}

function request(method, url, body) {
  const options = {
    method,
    headers: { Authorization: `Bearer ${ScriptApp.getOAuthToken()}`, "x-goog-user-project": PROJECT },
    muteHttpExceptions: true,
  };
  if (body) {
    options.contentType = "application/json";
    options.payload = JSON.stringify(body);
  }
  return UrlFetchApp.fetch(url, options);
}

/** Run from the editor after a deploy: grants scopes and checks Firestore. */
function checkSetup() {
  console.log(`Firestore reachable. ${subscribers("inquiries").length} device(s) get booking inquiry notifications.`);
}

/** Run from the editor to send a test notification to every subscribed manager device. */
function sendTestPush() {
  const sent = sendPush("inquiries", { title: "Test from the booking form", body: "It works.", link: "/", tag: "test" });
  console.log(`Sent to ${sent} device(s).`);
}

function json(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
