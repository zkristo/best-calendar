"use strict";

/* Month-grid calendar for BEST group events.
   Events come from data/events.json, which the hourly email sync keeps up to date.
   Event times are local to the event, with their UTC offset, the way the emails state them. */

const DATA_URL = "data/events.json";
const FLIGHTS_URL = "data/flights.json"; // cheapest trips from Zagreb, written by the prices workflow (optional)
const STATE_URL = "data/sync-state.json"; // when the nightly routine last checked Gmail (optional)
const REFRESH_MS = 10 * 60 * 1000;

const TAGS = {
  meeting:     { label: "Meeting" },
  course:      { label: "Course" },
  competition: { label: "Competition" },
  social:      { label: "Social" },
  deadline:    { label: "Deadline" },
  other:       { label: "Other" },
};

/* What the site shows: the routine tags each email by type (above), and the site groups events the way
   BEST members think of them, from the title. A deadline takes the category of the event it belongs to. */
const CATS = { // short: the tag at the start of each bar in the month grid (Other events use their own name)
  rm:     { label: "Regional Meeting",     short: "RM",  icon: "meeting" },
  course: { label: "Course",               short: "CRS", icon: "course" },
  mw:     { label: "Motivational Weekend", short: "MW",  icon: "flame" },
  jam:    { label: "JAM",                  short: "JAM", icon: "music" },
  ce:     { label: "Cultural Exchange",    short: "CE",  icon: "globe" },
  other:  { label: "Other",                short: "",    icon: "other" },
};
const MAIN = new Set(["rm", "course", "mw"]); // their deadlines always show; the rest only when switched on

const ICON = {
  meeting: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  course: '<path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/><path d="M22 10v6"/>',
  competition: '<path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M17 5h3v2a3 3 0 0 1-3 3"/><path d="M7 5H4v2a3 3 0 0 0 3 3"/>',
  social: '<path d="M8 22h8"/><path d="M12 11v11"/><path d="m19 3-7 8-7-8Z"/>',
  deadline: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M5 3 2 6"/><path d="m22 6-3-3"/>',
  other: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  sliders: '<path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M2 14h4"/><path d="M10 8h4"/><path d="M18 16h4"/>',
  grid: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 10h18"/><path d="M9 10v11"/><path d="M15 10v11"/><path d="M3 15.5h18"/>',
  list: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  ext: '<path d="M7 17 17 7"/><path d="M8 7h9v9"/>',
  plane: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
  bus: '<path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/>',
  car: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
};
const svg = (name, size = 18) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`;

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const NEW = '<span class="new">New</span>';

/* ---------- Dates ----------
   A "day" is an integer count of days since 1970-01-01 for a calendar date.
   Minutes-of-day stay local; `abs` (minutes, UTC) is only used for ordering and "how long ago". */
const WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WD_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MON_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/;

const dayOf = (y, m, d) => Date.UTC(y, m, d) / 864e5;
function parseWhen(s) {
  if (typeof s !== "string") return null;
  let m = DATE_RE.exec(s);
  if (m) {
    const day = dayOf(+m[1], +m[2] - 1, +m[3]);
    return { day, min: null, off: 0, abs: day * 1440 };
  }
  m = TIME_RE.exec(s);
  if (!m) return null;
  const off = m[6] && m[6] !== "Z" ? (m[6][0] === "-" ? -1 : 1) * (+m[6].slice(1, 3) * 60 + +m[6].slice(4, 6)) : 0;
  const day = dayOf(+m[1], +m[2] - 1, +m[3]);
  const min = +m[4] * 60 + +m[5];
  return { day, min, off, abs: day * 1440 + min - off };
}
function info(day) {
  const dt = new Date(day * 864e5);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth(), d: dt.getUTCDate(), wd: (dt.getUTCDay() + 6) % 7 };
}
const pad = (n) => String(n).padStart(2, "0");
const fmtTime = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
const fmtDay = (day) => { const i = info(day); return `${WD[i.wd]} ${i.d} ${MON[i.m]}`; };
const fmtDayLong = (day) => { const i = info(day); return `${WD_LONG[i.wd]} ${i.d} ${MON_LONG[i.m]} ${i.y}`; };

const nowDate = new Date();
const TODAY = dayOf(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate());
const nowAbs = () => Math.floor(Date.now() / 60000);

function ago(absMin) {
  const d = nowAbs() - absMin;
  if (d < 2) return "just now";
  if (d < 60) return `${d} min ago`;
  if (d < 48 * 60) return `${Math.round(d / 60)} h ago`;
  return `${Math.round(d / 1440)} days ago`;
}

/* ---------- Data ---------- */
let EVENTS = [];
let BY_ID = {};
let FLIGHTS = {};          // event id → cheapest trips from Zagreb (data/flights.json)
let flightsOrigin = "Zagreb";
let updatedAt = null;      // when an email last changed the calendar
let checkedAt = null;      // when the routine last looked for new emails, changes or not
let loaded = false;

function prepare(raw) {
  const out = [];
  for (const r of raw) {
    const s = parseWhen(r && r.start);
    if (!s || !TAGS[r.tag] || !r.title || !r.id) continue;
    const e = r.end ? parseWhen(r.end) : null;
    const ev = { ...r, s, e, allDay: s.min === null, sDay: s.day };
    if (!e) ev.eDay = s.day;
    else if (e.min === null) ev.eDay = Math.max(e.day, s.day);
    else ev.eDay = Math.max(e.min === 0 && e.day > s.day ? e.day - 1 : e.day, s.day);
    ev.multi = ev.eDay > ev.sDay;
    ev.cancelled = r.status === "cancelled";
    const rec = r.source ? parseWhen(r.source.receivedAt) : null;
    ev.rec = rec && rec.min !== null ? rec : null;
    ev.isNew = !!ev.rec && nowAbs() - ev.rec.abs >= 0 && nowAbs() - ev.rec.abs < 1440;
    ev.dl = r.tag === "deadline";
    ev.cat = ev.dl ? null : categorise(ev);
    ev.dls = [];
    out.push(ev);
  }
  linkDeadlines(out);
  return out.sort((a, b) => a.s.abs - b.s.abs);
}

const fold = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
function catOfText(title) {
  const t = fold(title);
  if (/\b[as]?rm\b|regional meeting/.test(t)) return "rm"; // aRM, sRM, Joint aRM
  if (/motivational weekend|\bmw\b/.test(t)) return "mw";
  if (/jam\b/.test(t)) return "jam"; // JAM, Alpine Jam, RoJAM
  if (/cultural exchange|\bce\b/.test(t)) return "ce";
  if (/\bcourses?\b/.test(t) && !/t-?shirt|merch|order/.test(t)) return "course";
  return null;
}
const categorise = (e) => catOfText(e.title) || (e.tag === "course" && !/training/i.test(e.title) ? "course" : "other");

/* Match each deadline to its event: "Crasher applications close: aRM Athens" → the aRM held in Athens. */
const STOP = new Set(("applications application apply close closes closing opens due crasher crashers co organiser organisers " +
  "participant participants partner registration payment early bird delegate delegates extra the for and with " +
  "joint region regions arm srm motivational weekend cultural exchange course courses jam best lbg vol edition").split(" "));
const keyWords = (s) => fold(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w) && !/^20\d\d$/.test(w));
function linkDeadlines(all) {
  const events = all.filter((e) => !e.dl);
  const words = new Map(events.map((e) => [e, new Set(keyWords(`${e.title} ${e.location?.name || ""} ${e.location?.city || ""}`))]));
  for (const d of all.filter((x) => x.dl)) {
    const want = catOfText(d.title);
    const key = keyWords(d.title.includes(":") ? d.title.slice(d.title.indexOf(":") + 1) : d.title);
    let best = null, top = 0;
    for (const e of events) {
      if (e.eDay < d.sDay || (want && e.cat !== want)) continue;
      const score = key.filter((w) => words.get(e).has(w)).length;
      if (score > top || (score && score === top && (e.multi > best.multi || (e.multi === best.multi && e.sDay < best.sDay)))) {
        best = e; top = score;
      }
    }
    d.forEv = best;
    d.cat = best ? best.cat : want || "other";
    if (best) best.dls.push(d);
  }
}
const dlShort = (t) => (t.includes(":") ? t.slice(t.indexOf(":") + 1).trim() : t);
const catLabel = (e) => (e.dl ? `Deadline · ${CATS[e.cat].label}` : CATS[e.cat].label);
const feeText = (f) => (/^free$/i.test(f) ? "Free" : `Fee ${f}`);

/* What a bar says: tag, city, fee, then the trip price. "Hørsholm, Denmark" → "Hørsholm". */
function shortCity(e) {
  const L = e.location;
  if (!L || !L.name) return e.bus || "";
  if (/^online$/i.test(L.name.trim())) return "Online";
  const c = (L.city || (L.name.includes(",") ? L.name : "")).split(",")[0].replace(/^near\s+/i, "").trim();
  return c || e.bus || L.name;
}
function shortName(e) { // Other events have no tag, so their own name leads: "(aGA26)", "YEHS – …", "SCARLET Vol. XVI – …"
  const ab = /\(([^\s()]{2,10})\)/.exec(e.title);
  return ab ? ab[1] : e.title.split(/\s[–—-]\s|:\s|\s\(/)[0].trim();
}
const tagOf = (e) => CATS[e.cat].short || shortName(e);
// every deadline for the event has passed: applications are closed
const dlPassed = (d) => (d.allDay ? d.eDay < TODAY : d.s.abs < nowAbs());
const isClosed = (e) => !e.dl && e.dls.length > 0 && e.dls.every(dlPassed);

/* ---------- State ---------- */
const DEFAULT_CATS = new Set(["rm", "course", "mw", "jam", "ce"]); // Other starts switched off
let picked = null;          // the categories the reader picked, or null for the default set
const catOn = (k) => (picked ? picked.has(k) : DEFAULT_CATS.has(k));
let otherDeadlines = false; // deadlines outside RM, Course and MW
const todayInfo = info(TODAY);
/* Pages of the grid: page 0 is six weeks starting this week, so nothing past fills the screen; pages 1, 2, …
   are whole months after that. There is no going back past this week. */
const WEEK0 = TODAY - todayInfo.wd;
const NEXT0 = info(WEEK0 + 42); // the month page 1 shows
let page = 0;
const pageMonth = (k) => { const d = new Date(Date.UTC(NEXT0.y, NEXT0.m + k - 1, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() }; };
const pageStart = (k) => { if (!k) return WEEK0; const { y, m } = pageMonth(k), f = dayOf(y, m, 1); return f - info(f).wd; };
const pageOf = (day) => { const i = info(day); return day < WEEK0 + 42 ? 0 : i.y * 12 + i.m - (NEXT0.y * 12 + NEXT0.m) + 1; };
const pageHash = () => { if (!page) return ""; const { y, m } = pageMonth(page); return `#${y}-${pad(m + 1)}`; };
// past events stay off the calendar (the agenda can still show them on request)
const visible = (withPast = false) => EVENTS.filter((e) =>
  (withPast || e.eDay >= TODAY) && catOn(e.cat) && (!e.dl || MAIN.has(e.cat) || otherDeadlines));

const hashMonth = /^#(\d{4})-(\d{2})$/.exec(location.hash);
if (hashMonth && +hashMonth[2] >= 1 && +hashMonth[2] <= 12) {
  page = Math.max(0, pageOf(dayOf(+hashMonth[1], +hashMonth[2] - 1, 1)));
}

/* The agenda (one scrolling list) is a sheet pulled up over the grid; #agenda opens it. */
let agendaOpen = false;
let showPast = false; // the agenda starts today unless the reader asks for earlier events

/* ---------- Event row (selected-day list) ---------- */
function timeCell(e, day) {
  const kind = !e.multi ? "single" : day === e.sDay ? "first" : day === e.eDay ? "last" : "middle";
  let big = "All day", small = "", word = true;
  if (kind === "single" && !e.allDay) {
    big = fmtTime(e.s.min);
    word = false;
    if (e.e && e.e.min !== null) small = `to ${fmtTime(e.e.min)}`;
    else if (e.dl) small = "Due";
  } else if (kind === "first" && !e.allDay) {
    big = fmtTime(e.s.min); small = "Starts"; word = false;
  } else if (kind === "last" && e.e && e.e.min !== null) {
    big = fmtTime(e.e.min); small = "Ends"; word = false;
  }
  return { kind, big, small, word };
}
const sortKeyOn = (e, day) => {
  const t = timeCell(e, day);
  if (t.word) return -1;
  return t.kind === "last" ? e.e.min : e.s.min;
};
function cityCountry(e) { // "Patras, Greece", "Online"; a venue name only when that's all there is
  const L = e.location;
  if (!L || !L.name) return e.bus || "";
  if (/^online$/i.test(L.name.trim())) return "Online";
  return L.city || L.name;
}
function fmtRange(a, b) { // "6–9 Nov", "30 Oct – 2 Nov", "6 Nov"
  const x = info(a), y = info(b);
  if (a === b) return `${x.d} ${MON[x.m]}`;
  return x.m === y.m ? `${x.d}–${y.d} ${MON[y.m]}` : `${x.d} ${MON[x.m]} – ${y.d} ${MON[y.m]}`;
}
function feeRange(e) { // the fee in euros as [low, high]; "€18/night" counts the event's nights
  if (!e.fee) return null;
  if (/^free$/i.test(e.fee)) return [0, 0];
  const m = /€\s?(\d+(?:\.\d+)?)(?:\s?[–-]\s?(\d+(?:\.\d+)?))?(\/night)?/.exec(e.fee);
  if (!m) return null;
  const n = m[3] ? Math.max(e.eDay - e.sDay, 1) : 1;
  return [+m[1] * n, +(m[2] ?? m[1]) * n];
}
function tripLine(e, t, icon) {
  const a = firstTimed(t.out)?.a, b = lastTimed(t.back)?.b;
  const fee = feeRange(e);
  const sum = fee && fee[1] > 0
    ? `<span class="ev-sum">= ${fee[0] === fee[1] ? euro(fee[0] + t.total) : `${euro(fee[0] + t.total)}–${euro(fee[1] + t.total)}`}</span>` : "";
  return `<span class="ev-trip">${svg(icon, 14)}${a && b ? `<span>${fmtRange(a.day, b.day)}</span>` : ""}${priceTag(t.total)}${sum}</span>`;
}
const dlKind = (d) => (d.title.includes(":") ? d.title.slice(0, d.title.indexOf(":")) : d.title);
function evRow(e) {
  const fl = !e.cancelled && !isClosed(e) ? FLIGHTS[e.id] : null; // no trips to plan once applications are closed
  const icon = fl?.mode === "bus" ? "bus" : "plane";
  // the best trip on the event's dates, then the second option (±1 day, or the next one on the same dates)
  const trips = [fl?.best?.[0], fl?.alternative || fl?.best?.[1]].filter(Boolean);
  const when = e.multi ? fmtRange(e.sDay, e.eDay)
    : e.allDay ? ""
    : e.dl ? `Due ${fmtTime(e.s.min)}`
    : e.e && e.e.min !== null ? `${fmtTime(e.s.min)}–${fmtTime(e.e.min)}` : fmtTime(e.s.min);
  const place = e.dl ? "" : cityCountry(e);
  const meta = [
    when && `<span>${when}</span>`,
    place && `<span>${svg("pin", 14)}${esc(place)}</span>`,
    e.fee && `<span>${esc(feeText(e.fee))}</span>`,
  ].filter(Boolean);
  // a deadline points at its event; an event lists the deadlines still ahead (tap one to open it)
  const links = e.dl
    ? (e.forEv ? [`<span class="ev-dl tag-${e.forEv.cat}" data-open="${esc(e.forEv.id)}"><i class="sw"></i>${esc(e.forEv.title)}</span>`] : [])
    : e.dls.filter((d) => d.eDay >= TODAY).sort((p, q) => p.s.abs - q.s.abs).map((d) =>
        `<span class="ev-dl tag-${d.cat}" data-open="${esc(d.id)}">${svg("flag", 13)}${esc(dlKind(d))} · ${fmtDay(d.sDay)}</span>`);
  const cls = `ev-row tag-${e.cat}${e.dl ? " is-dl" : ""}${e.cancelled ? " is-cancelled" : ""}`;
  return `<button class="${cls}" type="button" data-id="${esc(e.id)}">
    <span class="ev-title">${e.dl ? svg("flag", 15) : ""}${isClosed(e) ? `<span class="ev-closed">Closed</span>` : ""}${esc(e.title)}${e.cancelled ? " (cancelled)" : ""}${e.isNew ? " " + NEW : ""}</span>
    ${meta.length ? `<span class="ev-meta">${meta.join("")}</span>` : ""}
    ${trips.length ? `<span class="ev-trips">${trips.map((t) => tripLine(e, t, icon)).join("")}</span>` : ""}
    ${links.length ? `<span class="ev-dls">${links.join("")}</span>` : ""}
  </button>`;
}
const onDay = (evs, day) =>
  evs.filter((e) => e.sDay <= day && e.eDay >= day).sort((a, b) => sortKeyOn(a, day) - sortKeyOn(b, day));

/* ---------- Month ----------
   The grid fills the screen. Each week fits as many lanes of bars as its row has room for (bars get thinner
   on short screens so at least four fit); a day with more says "+N" beside its date. */
function weekBars(evs, w0, lanes) {
  const w1 = w0 + 6;
  const items = evs
    .filter((e) => e.sDay <= w1 && e.eDay >= w0)
    .map((e) => ({ e, a: Math.max(e.sDay, w0) - w0, b: Math.min(e.eDay, w1) - w0 }))
    .sort((p, q) => p.e.dl - q.e.dl || p.a - q.a || (q.b - q.a) - (p.b - p.a) || q.e.multi - p.e.multi || q.e.allDay - p.e.allDay || p.e.s.abs - q.e.s.abs);
  const occ = [];
  for (const it of items) {
    let lane = 0;
    for (;;) {
      occ[lane] ??= Array(7).fill(false);
      let free = true;
      for (let c = it.a; c <= it.b; c++) if (occ[lane][c]) { free = false; break; }
      if (free) break;
      lane++;
    }
    for (let c = it.a; c <= it.b; c++) occ[lane][c] = true;
    it.lane = lane;
  }
  const hidden = Array(7).fill(0);
  let bars = "";
  for (const it of items) {
    if (it.lane >= lanes) { for (let c = it.a; c <= it.b; c++) hidden[c]++; continue; }
    bars += monthItem(it, w0);
  }
  return { bars, hidden };
}
function renderMonth() {
  const view = document.getElementById("view");
  const pm = page ? pageMonth(page) : null; // null: the rolling first page
  const g0 = pageStart(page);
  let weeks = "";
  for (let w = 0; w < 6; w++) {
    let days = "";
    for (let c = 0; c < 7; c++) {
      const d = g0 + w * 7 + c, i = info(d);
      const cls = ["md", pm && i.m !== pm.m && "out", c >= 5 && "wkend", d === TODAY && "today", d < TODAY && "past"].filter(Boolean).join(" ");
      const num = i.d === 1 && !pm ? `${i.d} ${MON[i.m].toUpperCase()}` : i.d; // on the rolling page, mark where a month starts
      days += `<button class="${cls}" type="button" data-day="${d}" aria-label="${fmtDayLong(d)}"><span class="md-num">${num}</span></button>`;
    }
    weeks += `<div class="mw"><div class="mw-days">${days}</div><div class="mw-items"></div></div>`;
  }
  const wd = WD.map((n) => `<span><span class="long">${n}</span><span class="short">${n[0]}</span></span>`).join("");
  const a = info(g0), z = info(g0 + 41);
  const title = pm ? `${MON[pm.m].toUpperCase()} ${pm.y}`
    : a.m === z.m ? `${MON[a.m].toUpperCase()} ${a.y}` : `${MON[a.m].toUpperCase()} – ${MON[z.m].toUpperCase()} ${z.y}`;
  document.getElementById("top-nav").innerHTML = `<h2 aria-live="polite">${title}</h2>`;
  view.innerHTML = `<div class="mgrid"><div class="m-wd">${wd}</div>${weeks}</div>`;
  const grid = view.querySelector(".mgrid"), rows = view.querySelectorAll(".mw-items");
  const h = rows[0].clientHeight, gap = parseFloat(getComputedStyle(rows[0]).rowGap) || 0;
  const lane = Math.max(12, Math.min(parseFloat(getComputedStyle(grid).getPropertyValue("--lane")) || 21, Math.floor((h + gap) / 4) - gap));
  grid.style.setProperty("--lane", `${lane}px`);
  grid.classList.toggle("dense", lane < 15);
  const lanes = Math.max(1, Math.floor((h + gap) / (lane + gap)));
  const evs = visible();
  rows.forEach((el, w) => {
    const { bars, hidden } = weekBars(evs, g0 + w * 7, lanes);
    el.innerHTML = bars;
    const days = el.previousElementSibling.children;
    hidden.forEach((n, c) => {
      if (!n) return;
      days[c].insertAdjacentHTML("beforeend", `<span class="md-more" aria-hidden="true">+${n}</span>`);
      days[c].setAttribute("aria-label", `${days[c].getAttribute("aria-label")}, ${n} more`);
    });
  });
  fitTickers(view);
}

/* Text that doesn't fit its bar scrolls sideways, like the display on a train: two copies side by side,
   moved left by one copy's width so the loop is seamless. Reduced motion keeps it still and cut off. */
const calm = matchMedia("(prefers-reduced-motion: reduce)");
const TICK_SPEED = 30; // px per second
function fitTickers(root) {
  if (calm.matches) return;
  for (const run of root.querySelectorAll(".mi-run")) {
    const txt = run.firstElementChild;
    if (txt.scrollWidth <= run.clientWidth + 1) continue;
    run.parentElement.classList.add("tick");
    const copy = txt.cloneNode(true);
    copy.setAttribute("aria-hidden", "true");
    const track = document.createElement("span");
    track.className = "mi-track";
    track.append(txt, copy);
    run.append(track);
    const d = txt.offsetWidth;
    track.style.setProperty("--d", `${d}px`);
    track.style.animationDuration = `${(d / TICK_SPEED / 0.75).toFixed(1)}s`; // a quarter of each loop rests at the start
  }
}

const priceKey = () => (TIER_CUTS
  ? `<p class="m-legend price-key">Trip prices<span class="keys"><span class="key tier-cheap">cheap</span><span class="key tier-mid">mid</span><span class="key tier-dear">pricey</span></span></p>`
  : "");

/* ---------- Agenda ---------- */
function renderAgenda() {
  const evs = visible(showPast);
  // each event once: on its first day, or under today while it is running
  const groups = new Map();
  for (const e of evs) {
    if (!showPast && e.eDay < TODAY) continue;
    const day = !showPast && e.sDay < TODAY ? TODAY : e.sDay;
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day).push(e);
  }
  if (evs.length && !groups.has(TODAY)) groups.set(TODAY, []); // today is always there to find your place
  let body = "", month = null;
  for (const d of [...groups.keys()].sort((a, b) => a - b)) {
    const i = info(d);
    if (i.y * 12 + i.m !== month) {
      month = i.y * 12 + i.m;
      body += `<h3 class="ag-month">${MON[i.m].toUpperCase()} ${i.y}</h3>`;
    }
    const list = groups.get(d).sort((a, b) => a.dl - b.dl || sortKeyOn(a, d) - sortKeyOn(b, d));
    body += `<section class="ag-day${d === TODAY ? " today" : d < TODAY ? " past" : ""}" id="ag-${d}" aria-label="${fmtDayLong(d)}">
      <div class="ag-date"><b>${i.d}</b><span>${WD[i.wd]}</span>${d === TODAY ? "<em>Today</em>" : ""}</div>
      ${list.length ? `<div class="ev-list">${list.map((e) => evRow(e)).join("")}</div>` : `<p class="ag-none">Nothing today.</p>`}
    </section>`;
  }
  const empty = !EVENTS.length
    ? `<p class="m-legend">No events yet. They appear here when BEST International emails arrive.</p>`
    : !evs.length ? `<p class="m-legend">No events match these categories. <button class="linkbtn" type="button" data-showall>Reset categories</button></p>` : "";
  document.getElementById("ag-scroll").innerHTML = `<div class="ag">
    ${empty || `${showPast ? "" : `<button class="linkbtn ag-past" type="button" data-past>Show past events</button>`}
    <div class="ag-list">${body}</div>
    <p class="m-legend">That's everything announced so far.</p>`}
    ${priceKey()}${statusHtml()}
  </div>`;
}
const agendaEl = document.getElementById("agenda"), agScroll = document.getElementById("ag-scroll"), grip = document.getElementById("grip");
function setAgenda(open) {
  if (open === agendaOpen) return;
  agendaOpen = open;
  if (open) { renderAgenda(); agScroll.scrollTop = 0; }
  agendaEl.classList.toggle("open", open);
  agScroll.inert = !open;
  grip.setAttribute("aria-expanded", String(open));
  grip.setAttribute("aria-label", open ? "Close the agenda" : "Open the agenda");
  try { history.replaceState(null, "", open ? "#agenda" : pageHash() || location.pathname); } catch {}
}
const scrollToToday = () => document.getElementById(`ag-${TODAY}`)?.scrollIntoView({ behavior: "smooth", block: "start" });

const tripFare = (e) => (e.cancelled || isClosed(e) ? null : FLIGHTS[e.id]?.best?.[0]?.total ?? null);
function barText(e) {
  if (e.dl) { // a deadline names the event it belongs to, in that event's colour
    const f = e.forEv;
    const what = f ? [`<b>${esc(tagOf(f))}</b>`, shortCity(f) && `<span>${esc(shortCity(f))}</span>`] : [`<span>${esc(dlShort(e.title))}</span>`];
    return svg("flag", 11) + what.filter(Boolean).join("");
  }
  const fare = tripFare(e), tier = tierOf(fare), city = shortCity(e), mode = FLIGHTS[e.id]?.mode;
  if (isClosed(e)) {
    const words = [`<b>${esc(tagOf(e))}</b>`, city && esc(city), e.fee && esc(e.fee)].filter(Boolean).join("&ensp;");
    return `<b class="mi-closed">Closed</b><span class="x">${words}</span>`;
  }
  return [
    `<b>${esc(tagOf(e))}</b>`,
    city && `<span>${esc(city)}</span>`,
    e.fee && `<span class="mi-fee">${esc(e.fee)}</span>`,
    fare != null && `<span class="mi-p${tier ? " tier-" + tier : ""}">${svg(mode === "bus" ? "bus" : "plane", 11)}€${Math.round(fare)}</span>`,
  ].filter(Boolean).join("");
}
function monthItem(it, w0) {
  const e = it.e;
  const fare = tripFare(e);
  const tier = tierOf(fare);
  const contL = e.sDay < w0 + it.a, contR = e.eDay > w0 + it.b;
  const pos = `grid-column:${it.a + 1}/${it.b + 2};grid-row:${it.lane + 1}`;
  const when = e.allDay ? fmtDay(e.sDay) : `${fmtDay(e.sDay)} ${fmtTime(e.s.min)}`;
  const label = `${catLabel(e)}${e.cancelled ? ", cancelled" : ""}${isClosed(e) ? ", applications closed" : ""}: ${e.title}, ${when}${e.fee ? `, ${feeText(e.fee).toLowerCase()}` : ""}` +
    `${fare != null ? `, trip ${euro(fare)}${tier ? ` (${TIER_WORD[tier]})` : ""}` : ""}`;
  const cls = ["mi", `tag-${e.cat}`, e.dl && "dl", contL && "cont-l", contR && "cont-r", e.cancelled && "is-cancelled", isClosed(e) && "is-closed"].filter(Boolean).join(" ");
  return `<button class="${cls}" type="button" style="${pos}" data-id="${esc(e.id)}" aria-label="${esc(label)}"><span class="mi-run"><span class="mi-txt">${barText(e)}</span></span></button>`;
}

/* ---------- Detail drawer ---------- */
const drawer = document.getElementById("drawer");
const scrim = document.getElementById("scrim");
document.getElementById("dr-close").innerHTML = svg("close");
let lastFocus = null;

function lengthNote(e) {
  if (!e.e) return "";
  if (e.multi && (e.allDay || e.e.min === null)) return `${e.eDay - e.sDay + 1} days`;
  const mins = e.e.abs - e.s.abs;
  if (mins <= 0) return "";
  if (mins >= 1440) return `${e.eDay - e.sDay + 1} days`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return [h ? `${h}h` : "", m ? `${m}m` : ""].filter(Boolean).join(" ");
}
function whenHtml(e) {
  const len = lengthNote(e);
  const note = len ? `<p class="note">${len}</p>` : "";
  if (!e.multi) {
    if (e.allDay) return `<div class="when-one"><span class="lbl">When</span><b>${fmtDayLong(e.sDay)}</b><span>All day</span></div>`;
    if (!e.e && e.dl) {
      return `<div class="when-one"><span class="lbl">Due</span><b>${fmtDayLong(e.sDay)}</b><span class="mono">${fmtTime(e.s.min)}</span></div>`;
    }
    const range = e.e && e.e.min !== null ? `${fmtTime(e.s.min)} – ${fmtTime(e.e.min)}` : fmtTime(e.s.min);
    return `<div class="when-one"><span class="lbl">When</span><b>${fmtDayLong(e.sDay)}</b><span class="mono">${range}</span></div>${note}`;
  }
  const endDay = e.e && e.e.min !== null ? e.e.day : e.eDay;
  const sT = e.allDay ? "" : `<span class="mono">${fmtTime(e.s.min)}</span>`;
  const eT = e.e && e.e.min !== null ? `<span class="mono">${fmtTime(e.e.min)}</span>` : "";
  return `<div class="when">
      <div><span class="lbl">Starts</span><b>${fmtDay(e.sDay)}</b>${sT}</div>
      <div class="arrow" aria-hidden="true">→</div>
      <div class="r"><span class="lbl">Ends</span><b>${fmtDay(endDay)}</b>${eT}</div>
    </div>${note}`;
}
function safeUrl(u) {
  try {
    const url = new URL(u);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}
function fmtReceived(r) {
  const when = r.day === TODAY ? "Today" : r.day === TODAY - 1 ? "Yesterday" : fmtDay(r.day);
  return `${when}, ${fmtTime(r.min)}`;
}

/* ---------- Getting there (data/flights.json) ---------- */
const euro = (n) => "€" + (Math.round(n * 100) / 100).toFixed(2).replace(/\.00$/, "");
const BOOK = { ryanair: "Ryanair", wizz: "Wizz Air", kiwi: "Kiwi.com" };

/* Price colours: every trip price is compared with the other events' trips.
   Cheapest third green, middle third yellow, priciest third red. */
const TIER_WORD = { cheap: "cheap", mid: "mid-priced", dear: "pricey" };
let TIER_CUTS = null; // [top of the cheap third, top of the middle third], or null when too few prices
function computeTiers() {
  const ref = Object.entries(FLIGHTS)
    .filter(([id]) => BY_ID[id] && !BY_ID[id].cancelled)
    .map(([, f]) => f?.best?.[0]?.total ?? f?.alternative?.total)
    .filter((n) => typeof n === "number")
    .sort((a, b) => a - b);
  const n = ref.length;
  TIER_CUTS = n >= 3 ? [ref[Math.ceil(n / 3) - 1], ref[Math.ceil((2 * n) / 3) - 1]] : null;
}
const tierOf = (n) => (!TIER_CUTS || typeof n !== "number" ? "" : n <= TIER_CUTS[0] ? "cheap" : n <= TIER_CUTS[1] ? "mid" : "dear");
function priceTag(n) {
  const t = tierOf(n);
  if (!t) return `<b class="price">${euro(n)}</b>`;
  return `<b class="price tier-${t}" title="${TIER_WORD[t]} compared with the other events' trips">${euro(n)}<span class="vh"> (${TIER_WORD[t]})</span></b>`;
}

/* ---------- Travel line: riding, waiting, riding, drawn to scale ----------
   dep/arr are local clock times where each step happens. Waits are always measured in one place, so
   they are exact; flights use their real air time ("minutes") because their two ends can be in different
   time zones. */
const fmtDur = (min) => {
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return h ? (m ? `${h}h ${pad(m)}m` : `${h}h`) : `${m}m`;
};
const wall = (w) => w.day * 1440 + w.min;
const timedSteps = (leg) =>
  (leg?.steps || []).filter((s) => s.kind !== "transfer")
    .map((s) => ({ s, a: parseWhen(s.dep), b: parseWhen(s.arr) }))
    .filter((x) => x.a && x.b && x.a.min !== null && x.b.min !== null);
const firstTimed = (leg) => timedSteps(leg)[0];
const lastTimed = (leg) => timedSteps(leg).at(-1);
function overnight(a, b) { // does the local span a..b touch 00:00–06:00?
  for (let d = Math.floor(a / 1440); d <= Math.floor(b / 1440); d++) if (d * 1440 < b && d * 1440 + 360 > a) return true;
  return false;
}
function legSegments(leg) {
  const timed = timedSteps(leg);
  const segs = [];
  timed.forEach((x, i) => {
    if (i) {
      const prev = timed[i - 1];
      const from = wall(prev.b), to = wall(x.a);
      const tr = (prev.s.kind === "bus" && prev.s.transfer) || (x.s.kind === "bus" && x.s.transfer) || null;
      if (to > from) segs.push({ kind: overnight(from, to) ? "night" : "wait", min: to - from, a: prev.b, b: x.a, transfer: tr?.minutes || 0 });
    }
    const real = x.s.kind === "flight" && typeof x.s.minutes === "number" ? x.s.minutes : null;
    const approx = x.s.kind === "flight" && (real === null || x.s.approxArrival);
    segs.push({ kind: x.s.kind === "flight" ? "flight" : "bus", min: Math.max(real ?? wall(x.b) - wall(x.a), 0), a: x.a, b: x.b, approx, step: x.s });
  });
  return { timed, segs };
}
const placeFrom = (s) => (s.kind === "flight" ? s.fromName || s.from : s.from);
const placeTo = (s) => (s.kind === "flight" ? s.toName || s.to : s.to);
function segText(g) {
  if (g.kind === "wait" || g.kind === "night") {
    return `wait ${fmtDur(g.min)}${g.kind === "night" ? " overnight" : ""}${g.transfer ? ` (incl. ${g.transfer} min transfer)` : ""}`;
  }
  return `${g.kind === "bus" ? "bus" : "flight"} ${g.approx ? "≈" : ""}${fmtDur(g.min)}`;
}
function legTimeline(label, leg) {
  const { timed, segs } = legSegments(leg);
  if (!timed.length) return legHtml(label, leg);
  const first = timed[0], last = timed.at(-1);
  const refDay = first.a.day;
  const total = segs.reduce((n, g) => n + g.min, 0);
  const home = (leg.steps || []).find((s) => s.kind === "transfer");
  const note = segs.map(segText).join(" · "); // for screen readers; the bar says the same
  const ICONS = { bus: "bus", flight: "plane", night: "moon" };
  const bar = segs.map((g) => {
    const what = g.kind === "night" ? "Overnight wait" : g.kind === "wait" ? "Wait" : g.kind === "bus" ? "Bus" : "Flight";
    const tip = `${what} ${fmtTime(g.a.min)}–${fmtTime(g.b.min)} (${g.approx ? "≈" : ""}${fmtDur(g.min)})${g.transfer ? `, incl. ${g.transfer} min transfer` : ""}`;
    return `<i class="seg ${g.kind}" style="flex-grow:${Math.max(g.min, 1)}" title="${esc(tip)}">${ICONS[g.kind] ? svg(ICONS[g.kind], 12) : ""}<span>${g.approx ? "≈" : ""}${fmtDur(g.min)}</span></i>`;
  }).join("");
  return `<div class="tl">
    <p class="tl-head"><span><b>${label}</b> · ${fmtDay(refDay)}</span><span class="tl-dur">${fmtDur(total)} total</span></p>
    <div class="tl-ends">
      <span class="tl-end"><b>${clock(first.a, refDay)}</b><span>${esc(placeFrom(first.s))}</span></span>
      <span class="tl-end r"><b>${clock(last.b, refDay)}</b><span>${esc(placeTo(last.s))}</span></span>
    </div>
    <div class="tl-bar" aria-hidden="true">${bar}</div>
    <p class="vh">${esc(note[0].toUpperCase() + note.slice(1))}</p>
    ${home && home.minutes ? `<p class="tl-home">${svg("car", 13)}${esc(home.text)} · ${fmtDur(home.minutes)}</p>` : ""}
  </div>`;
}
function bookHtml(t) {
  const n = [...t.out.steps, ...t.back.steps].filter((s) => s.kind !== "transfer").length;
  return `<details class="trip-book"><summary>Tickets and booking links (${n})</summary>
    <div class="trip-book-body">${legHtml("Out", t.out)}${legHtml("Back", t.back)}</div>
  </details>`;
}

function clock(w, refDay) {
  const shift = w.day - refDay;
  return fmtTime(w.min) + (shift ? `<small>${shift > 0 ? "+" : ""}${shift}</small>` : "");
}
function bookLink(url, label) {
  const u = url ? safeUrl(url) : null;
  return u ? `<a href="${esc(u.href)}" target="_blank" rel="noopener">${esc(label)} ${svg("ext", 13)}</a>` : "";
}
function stepHtml(st, refDay) {
  if (st.kind === "transfer") {
    return `<li class="st">${svg("car", 16)}<div><b>${esc(st.text)}</b><span>${st.minutes} min · ${euro(st.price)}</span></div></li>`;
  }
  const a = parseWhen(st.dep), b = parseWhen(st.arr);
  if (!a || !b) return "";
  if (st.kind === "bus") {
    const extra = [st.changes ? `${st.changes} change${st.changes > 1 ? "s" : ""}` : "",
      st.transfer ? `then ${st.transfer.minutes} min to the terminal${st.transfer.price ? ` (${euro(st.transfer.price)})` : ""}` : ""].filter(Boolean);
    return `<li class="st">${svg("bus", 16)}<div><b>${esc(st.from)} ${clock(a, refDay)} → ${esc(st.to)} ${clock(b, refDay)}</b>
      <span>FlixBus · ${euro(st.price)}${extra.length ? " · " + esc(extra.join(", ")) : ""}</span>${bookLink(st.url, "Book bus")}</div></li>`;
  }
  const via = st.via && st.via.length ? ` · via ${esc(st.via.join(", "))}` : "";
  const hop = st.hop ? `<em>Separate first flight</em> · ` : "";
  return `<li class="st">${svg("plane", 16)}<div><b>${esc(st.from)} ${clock(a, refDay)} → ${esc(st.to)} ${st.approxArrival ? "≈" : ""}${clock(b, refDay)}</b>
    <span>${hop}${esc((st.carriers || []).join(", "))}${via} · ${euro(st.price)}</span>${bookLink(st.url, `Book on ${BOOK[st.source] || "Kiwi.com"}`)}</div></li>`;
}
function legHtml(label, leg) {
  const main = mainStep(leg);
  const refDay = main.dep ? parseWhen(main.dep)?.day : null;
  if (refDay == null) return "";
  const via = leg.mode === "bus" ? "by FlixBus" : leg.viaFlight ? `fly via ${leg.airport}` : `via ${leg.airportName}`;
  return `<div class="trip-leg">
    <p class="trip-leg-head"><span><b>${label}</b> · ${fmtDay(refDay)} · ${esc(via)}</span><span>${euro(leg.total)}</span></p>
    <ol class="steps">${leg.steps.map((s) => stepHtml(s, refDay)).join("")}</ol>
    ${leg.wait ? `<p class="trip-note">${esc(leg.wait)}</p>` : ""}
  </div>`;
}
function routeLine(t) {
  const part = (leg, dir) => {
    const fl = leg.steps.filter((s) => s.kind === "flight").map((s) => `${s.from}→${s.to}`).join(", ");
    const bus = leg.steps.some((s) => s.kind === "bus");
    return (dir === "out" ? [bus && `bus to ${leg.airport}`, fl] : [fl, bus && "bus home"]).filter(Boolean).join(", ");
  };
  return `${part(t.out, "out")} · ${part(t.back, "back")}`;
}
const mainStep = (leg) =>
  leg.steps.find((s) => s.kind === "flight" && !s.hop) || leg.steps.find((s) => s.kind === "flight")
  || leg.steps.find((s) => s.kind === "bus") || {};
function shiftText(n, verb, when) {
  const d = Math.abs(n) === 1 ? "a day" : `${Math.abs(n)} days`;
  return `${verb} ${d} ${n < 0 ? "early" : "late"}${when ? ` (${fmtDay(when.day)})` : ""}`;
}
function tripHtml(t, tag, title, sub, cls = "") {
  return `<div class="trip-opt">
    <p class="trip-opt-head"><span class="trip-tag${cls}">${tag}</span><span>${title}</span></p>
    <div class="trip-total">${priceTag(t.total)}<span>${sub}</span></div>
    ${legTimeline("Out", t.out)}
    ${legTimeline("Back", t.back)}
    ${bookHtml(t)}
  </div>`;
}
function altHtml(alt, hasBest, e, bus) {
  const dep = parseWhen(mainStep(alt.out).dep);
  const changes = [
    alt.arriveShift ? shiftText(alt.arriveShift, "arrive", parseWhen(mainStep(alt.out).arr))
      : dep && dep.day < e.sDay ? `${bus ? "leave" : "fly out"} the day before (${fmtDay(dep.day)})` : "",
    alt.leaveShift ? shiftText(alt.leaveShift, "leave", parseWhen(mainStep(alt.back).dep)) : "",
  ].filter(Boolean).join(", ");
  const title = changes ? changes[0].toUpperCase() + changes.slice(1) : "Other dates";
  const s = alt.saving;
  const diff = s == null ? "" : s >= 0.5 ? `<strong class="save">${euro(s)} cheaper</strong> · ` : s <= -0.5 ? `<strong class="dearer">${euro(-s)} more</strong> · ` : "same price · ";
  return tripHtml(alt, hasBest ? "Option 2 · ±1 day" : "Closest dates", esc(title), `${diff}${esc(routeLine(alt))}`, " alt");
}
function flightsHtml(e) {
  const f = FLIGHTS[e.id];
  if (!f || e.cancelled) return "";
  const checked = parseWhen(f.searchedAt);
  const when = checked && checked.min !== null ? `Prices checked ${ago(checked.abs)}. ` : "";
  const bus = f.mode === "bus";
  const head = `<p class="trip-head">${svg(bus ? "bus" : "plane", 16)} Getting there${bus ? " by bus" : ""}</p>`;
  const best = f.best && f.best[0];
  const alt = f.alternative;
  if (!best && !alt) {
    return `<section class="trip">${head}<p class="trip-note">${bus ? "No FlixBus rides found for these dates yet." : "No bus + flight combination found for these dates yet."} ${esc(when)}</p></section>`;
  }
  const baseline = best && f.baseline && f.baseline > best.total + 0.5
    ? `<p class="trip-note">Flying both ways on these dates: ${euro(f.baseline)}</p>` : "";
  const more = (f.best || []).slice(1);
  return `<section class="trip">
    ${head}
    ${best ? tripHtml(best, "Option 1 · event dates", `Arrive ${fmtDay(e.sDay)}, leave ${fmtDay(e.eDay)}`, bus ? "cheapest FlixBus there and back · 1 person" : "cheapest door to door · 1 person, small bag") : `<p class="trip-note">Nothing fits the event's dates exactly; here is the closest.</p>`}
    ${alt ? altHtml(alt, !!best, e, bus) : ""}
    ${baseline}
    ${more.length ? `<details class="trip-more"><summary>${more.length} more option${more.length > 1 ? "s" : ""} on the event dates</summary>
      ${more.map((t) => `<div class="trip-alt"><p class="trip-total sm">${priceTag(t.total)}<span>${esc(routeLine(t))}</span></p>${legTimeline("Out", t.out)}${legTimeline("Back", t.back)}${bookHtml(t)}</div>`).join("")}
    </details>` : ""}
    ${TIER_CUTS ? `<p class="trip-foot">Price colours compare with the other events' trips: green is the cheapest third, yellow the middle, red the priciest.</p>` : ""}
    <p class="trip-foot">${esc(when)}${bus ? "Live FlixBus fares change quickly; check the booking page before you buy." : "Live fares from Ryanair, Wizz Air, Kiwi.com and FlixBus change quickly. Every leg is a separate ticket, so a late bus or flight won't be waited for."}</p>
  </section>`;
}

function openEvent(id) {
  const e = BY_ID[id];
  if (!e) return;
  sheetDay = null;
  lastFocus = document.activeElement;
  const L = e.location;
  let where = "";
  if (L && L.name) {
    const sub = [L.address, L.city].filter(Boolean).join(", ");
    const online = /^online$/i.test(L.name.trim());
    const maps = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent([L.name, L.address, L.city].filter(Boolean).join(", "));
    where = `<div><dt class="lbl">Where</dt><dd><span>${esc(L.name)}</span>${sub ? `<span class="muted">${esc(sub)}</span>` : ""}${online ? "" : `<a href="${esc(maps)}" target="_blank" rel="noopener">Open in Maps ${svg("ext", 14)}</a>`}</dd></div>`;
  }
  const fee = e.fee ? `<div><dt class="lbl">Fee</dt><dd>${esc(e.fee)}</dd></div>` : "";
  const url = e.url ? safeUrl(e.url) : null;
  const link = url ? `<div><dt class="lbl">Link</dt><dd><a href="${esc(url.href)}" target="_blank" rel="noopener">Open link ${svg("ext", 14)}</a><span class="muted">${esc(url.hostname)}</span></dd></div>` : "";
  const linked = e.dl && e.forEv
    ? `<div><dt class="lbl">For</dt><dd><button class="evlink tag-${e.forEv.cat}" type="button" data-open="${esc(e.forEv.id)}"><i class="sw"></i>${esc(e.forEv.title)}</button><span class="muted">${fmtDay(e.forEv.sDay)}</span></dd></div>`
    : !e.dl && e.dls.length
      ? `<div><dt class="lbl">Deadlines</dt><dd class="dl-list">${e.dls.slice().sort((a, b) => a.s.abs - b.s.abs).map((d) =>
          `<button class="evlink tag-${d.cat}${d.eDay < TODAY ? " past" : ""}" type="button" data-open="${esc(d.id)}">${svg("flag", 13)}<span>${esc(d.title.includes(":") ? d.title.slice(0, d.title.indexOf(":")) : d.title)}</span><span class="muted">${fmtDay(d.sDay)}</span></button>`).join("")}</dd></div>`
      : "";
  const src = e.source || {};
  const srcRows = [
    src.from ? `<div><dt class="lbl">From</dt><dd>${esc(src.from)}</dd></div>` : "",
    src.subject ? `<div><dt class="lbl">Subject</dt><dd>${esc(src.subject)}</dd></div>` : "",
    e.rec ? `<div><dt class="lbl">Received</dt><dd>${fmtReceived(e.rec)}</dd></div>` : "",
  ].join("");
  document.getElementById("dr-body").innerHTML = `<article class="ticket tag-${e.cat}">
    <div class="tk-band">${svg(e.dl ? "flag" : CATS[e.cat].icon, 18)}<span>${esc(catLabel(e))}${e.cancelled ? " · Cancelled" : ""}</span></div>
    <div class="tk-body">
      <h2 class="tk-title${e.cancelled ? " is-cancelled" : ""}" id="tk-title">${esc(e.title)}${e.isNew ? NEW : ""}</h2>
      ${whenHtml(e)}
      ${where || fee || link || linked ? `<dl class="fields">${linked}${where}${fee}${link}</dl>` : ""}
      ${e.description ? `<p class="desc">${esc(e.description)}</p>` : ""}
      ${flightsHtml(e)}
    </div>
    ${srcRows ? `<div class="perf" aria-hidden="true"><i></i><i></i></div>
    <div class="src">
      <p class="src-head">${svg("mail", 16)} Added from email</p>
      <dl class="fields">${srcRows}</dl>
    </div>` : ""}
  </article>`;
  showDrawer();
}
let sheetDay = null; // the day the drawer is showing, when it shows a day
function openDay(day) {
  const fresh = drawer.hidden;
  if (fresh) lastFocus = document.activeElement;
  sheetDay = day;
  const items = onDay(visible(), day);
  document.getElementById("dr-body").innerHTML = `<section class="day-sheet">
    <h2 class="day-title" id="tk-title">${fmtDayLong(day)}${day === TODAY ? "<small>Today</small>" : ""}</h2>
    ${items.length ? `<div class="ev-list">${items.map((e) => evRow(e)).join("")}</div>` : `<p class="m-legend">Nothing on this day.</p>`}
  </section>`;
  if (fresh) showDrawer();
  else drawer.scrollTop = 0;
}
function stepDay(delta) {
  const d = sheetDay + delta, g0 = pageStart(page);
  if (d < g0 || d > g0 + 41) goMonth(pageOf(d) - page); // keep the grid behind on a page showing this day
  openDay(d);
}
function fitBars(root) {
  for (const bar of root.querySelectorAll(".tl-bar")) {
    if (bar.scrollWidth > bar.clientWidth + 1) bar.classList.add("tight");
    if (bar.scrollWidth > bar.clientWidth + 1) bar.classList.add("tighter");
  }
}
function showDrawer() {
  drawer.hidden = false;
  scrim.hidden = false;
  drawer.scrollTop = 0;
  requestAnimationFrame(() => { drawer.classList.add("open"); scrim.classList.add("open"); });
  fitBars(drawer);
  document.getElementById("dr-close").focus();
}
function closeDrawer() {
  if (drawer.hidden) return;
  drawer.classList.remove("open");
  scrim.classList.remove("open");
  drawer.hidden = true;
  scrim.hidden = true;
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
}
document.getElementById("dr-close").addEventListener("click", closeDrawer);
scrim.addEventListener("click", closeDrawer);

/* ---------- Chrome: header, filters, navigation ---------- */
document.getElementById("mark-mon").textContent = MON[todayInfo.m];
document.getElementById("mark-day").textContent = todayInfo.d;

function statusHtml() {
  const parts = [];
  const fresh = EVENTS.filter((e) => e.isNew).length;
  if (fresh) parts.push(`<span class="new">New</span><span><strong>${fresh} ${fresh === 1 ? "event" : "events"}</strong> added in the last day</span>`);
  const absOf = (s) => { const t = Date.parse(s); return Number.isNaN(t) ? parseWhen(s)?.abs : Math.floor(t / 60000); };
  const checked = checkedAt ? absOf(checkedAt) : null, changed = updatedAt ? absOf(updatedAt) : null;
  if (checked != null) parts.push(`<span>Checked for new emails ${ago(checked)}</span>`);
  if (changed != null && (checked == null || checked - changed > 60)) parts.push(`<span>· last change ${ago(changed)}</span>`);
  if (checked == null && changed == null && loaded) parts.push(`<span>Waiting for the first email sync</span>`);
  return parts.length ? `<p class="status">${parts.join("")}</p>` : "";
}
function renderFilters() {
  document.getElementById("filters").innerHTML =
    Object.entries(CATS).map(([k, c]) =>
      `<button class="fchip tag-${k}" type="button" data-cat="${k}" aria-pressed="${catOn(k)}" title="${c.label}">${c.short || c.label}${c.short ? `<span class="vh"> (${c.label})</span>` : ""}</button>`
    ).join("") +
    `<button class="fchip dl-chip" type="button" data-otherdl aria-pressed="${otherDeadlines}" title="Other deadlines">${svg("flag", 15)}<span class="vh">Other deadlines</span></button>`;
}
function render() {
  renderFilters();
  renderMonth();
  if (agendaOpen) renderAgenda();
}
function goMonth(delta) {
  const next = Math.max(0, page + delta);
  if (next === page) return;
  page = next;
  try { history.replaceState(null, "", pageHash() || location.pathname); } catch {}
  renderMonth();
}

document.addEventListener("click", (ev) => {
  if (ev.target.closest("#grip")) { setAgenda(!agendaOpen); return; }
  const chip = ev.target.closest("[data-cat]");
  if (chip) {
    const k = chip.dataset.cat;
    if (!picked) picked = new Set([k]); // the first tap narrows to that one
    else if (picked.has(k)) { picked.delete(k); if (!picked.size) picked = null; }
    else picked.add(k); // later taps add more
    render();
    return;
  }
  if (ev.target.closest("[data-past]")) {
    showPast = true;
    renderAgenda();
    document.getElementById(`ag-${TODAY}`)?.scrollIntoView({ block: "start" });
    return;
  }
  if (agendaOpen && ev.target.closest("[data-today]")) { scrollToToday(); return; }
  if (ev.target.closest("[data-otherdl]")) {
    otherDeadlines = !otherDeadlines;
    render();
    return;
  }
  if (ev.target.closest("[data-showall]")) {
    picked = null;
    render();
    return;
  }
  const jump = ev.target.closest("#drawer [data-open], #drawer [data-id], #view [data-open], #agenda [data-open]");
  if (jump) {
    const back = lastFocus, inDrawer = !!jump.closest("#drawer");
    openEvent(jump.dataset.open || jump.dataset.id);
    if (inDrawer) lastFocus = back; // closing still returns focus to where the reader started
    return;
  }
  if (ev.target.closest("[data-retry]")) { load(); return; }
  const evBtn = ev.target.closest("#view [data-id], #agenda [data-id]");
  if (evBtn) { openEvent(evBtn.dataset.id); return; }
  if (ev.target.closest("[data-today]")) {
    goMonth(-page);
    return;
  }
  const dayBtn = ev.target.closest("#view [data-day]");
  if (dayBtn) openDay(+dayBtn.dataset.day);
});
document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape") {
    if (!drawer.hidden) closeDrawer();
    else if (agendaOpen) { setAgenda(false); grip.focus(); }
    return;
  }
  if (!drawer.hidden && sheetDay !== null && (ev.key === "ArrowLeft" || ev.key === "ArrowRight")) {
    stepDay(ev.key === "ArrowLeft" ? -1 : 1);
    return;
  }
  if (!drawer.hidden || !loaded || agendaOpen || ev.altKey || ev.ctrlKey || ev.metaKey) return;
  if (ev.target.closest && ev.target.closest("input, textarea, select, [contenteditable]")) return;
  if (ev.key === "ArrowLeft") goMonth(-1);
  if (ev.key === "ArrowRight") goMonth(1);
});

async function loadFlights() {
  try {
    const res = await fetch(FLIGHTS_URL, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    FLIGHTS = data && typeof data.events === "object" && data.events ? data.events : {};
    flightsOrigin = (data && data.origin) || "Zagreb";
  } catch {
    // travel prices are optional; the calendar works without them
  }
}

async function loadState() {
  try {
    const res = await fetch(STATE_URL, { cache: "no-store" });
    if (res.ok) checkedAt = (await res.json())?.lastCheckedAt || null;
  } catch {
    // optional: without it the site shows when the calendar last changed
  }
}
async function load() {
  try {
    const flights = loadFlights(), state = loadState();
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    await flights;
    await state;
    EVENTS = prepare(Array.isArray(data.events) ? data.events : []);
    BY_ID = Object.fromEntries(EVENTS.map((e) => [e.id, e]));
    computeTiers();
    updatedAt = data.updatedAt || null;
    const first = !loaded;
    loaded = true;
    render();
    if (first && location.hash === "#agenda") setAgenda(true);
  } catch (err) {
    if (loaded) return; // keep showing the last good data during a background refresh
    console.warn("Could not load events:", err);
    document.getElementById("view").innerHTML =
      `<div class="state"><p>Couldn't load the events. Check your connection and try again.</p><button class="btn" type="button" data-retry>Try again</button></div>`;
  }
}

let refit = 0;
const refitMonth = () => { if (loaded) renderMonth(); };
addEventListener("resize", () => { clearTimeout(refit); refit = setTimeout(refitMonth, 150); });
document.fonts?.ready.then(refitMonth);

const viewEl = document.getElementById("view");
// mouse wheel or trackpad over the grid turns the month (the grid itself never scrolls)
let wheelSum = 0, wheelLock = 0, wheelLast = 0;
viewEl.addEventListener("wheel", (ev) => {
  if (ev.ctrlKey || viewEl.scrollHeight > viewEl.clientHeight + 1) return; // a short window scrolls the grid
  ev.preventDefault();
  const now = Date.now();
  if (now < wheelLock) { wheelLock = now + 250; return; } // let a trackpad's flick run out before the next month
  if (now - wheelLast > 300) wheelSum = 0; // a fresh gesture starts from zero
  wheelLast = now;
  const px = ev.deltaMode === 1 ? 40 : ev.deltaMode === 2 ? 800 : 1; // lines or pages, on some mice
  wheelSum += (Math.abs(ev.deltaX) > Math.abs(ev.deltaY) ? ev.deltaX : ev.deltaY) * px;
  if (Math.abs(wheelSum) >= 50) { goMonth(wheelSum > 0 ? 1 : -1); wheelSum = 0; wheelLock = now + 400; }
}, { passive: false });

/* Swipes: sideways on the grid changes month and on a day sheet changes day; up from the grid or the
   category bar pulls the agenda up, and down (from the top of the list) puts it away. */
function onSwipe(el, go) {
  let t0 = null;
  el.addEventListener("touchstart", (ev) => {
    t0 = ev.touches.length === 1 ? { x: ev.touches[0].clientX, y: ev.touches[0].clientY } : null;
  }, { passive: true });
  el.addEventListener("touchend", (ev) => {
    if (!t0) return;
    const t = ev.changedTouches[0], dx = t.clientX - t0.x, dy = t.clientY - t0.y;
    t0 = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > 2 * Math.abs(dy)) go(dx < 0 ? "left" : "right");
    else if (Math.abs(dy) > 50 && Math.abs(dy) > 2 * Math.abs(dx)) go(dy < 0 ? "up" : "down");
  }, { passive: true });
}
onSwipe(viewEl, (dir) => {
  if (dir === "left" || dir === "right") goMonth(dir === "left" ? 1 : -1);
  else if (dir === "up") setAgenda(true);
});
onSwipe(document.querySelector(".catbar"), (dir) => { if (dir === "up" || dir === "down") setAgenda(dir === "up"); });
let agAtTop = true;
agendaEl.addEventListener("touchstart", () => { agAtTop = agScroll.scrollTop <= 0; }, { passive: true });
onSwipe(agendaEl, (dir) => {
  if (dir === "up" && !agendaOpen) setAgenda(true);
  if (dir === "down" && agAtTop) setAgenda(false);
});
onSwipe(drawer, (dir) => { if (sheetDay !== null && (dir === "left" || dir === "right")) stepDay(dir === "left" ? 1 : -1); });
load();
setInterval(() => { if (drawer.hidden) load(); }, REFRESH_MS);
