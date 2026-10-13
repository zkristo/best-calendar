"use strict";

/* Month-grid calendar for BEST group events.
   Events come from data/events.json, which the hourly email sync keeps up to date.
   Event times are local to the event, with their UTC offset, the way the emails state them. */

const DATA_URL = "data/events.json";
const FLIGHTS_URL = "data/flights.json"; // cheapest trips from Zagreb, written by the sync routine (optional)
const REFRESH_MS = 10 * 60 * 1000;

const TAGS = {
  meeting:     { label: "Meeting" },
  course:      { label: "Course" },
  competition: { label: "Competition" },
  social:      { label: "Social" },
  deadline:    { label: "Deadline" },
  other:       { label: "Other" },
};

const ICON = {
  meeting: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  course: '<path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/><path d="M22 10v6"/>',
  competition: '<path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M17 5h3v2a3 3 0 0 1-3 3"/><path d="M7 5H4v2a3 3 0 0 0 3 3"/>',
  social: '<path d="M8 22h8"/><path d="M12 11v11"/><path d="m19 3-7 8-7-8Z"/>',
  deadline: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M5 3 2 6"/><path d="m22 6-3-3"/>',
  other: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
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
let updatedAt = null;
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
    out.push(ev);
  }
  return out.sort((a, b) => a.s.abs - b.s.abs);
}

/* ---------- State ---------- */
const active = new Set(Object.keys(TAGS));
const todayInfo = info(TODAY);
let monthCur = { y: todayInfo.y, m: todayInfo.m };
let selDay = TODAY;
const mqPhone = matchMedia("(max-width: 640px)");
const visible = () => EVENTS.filter((e) => active.has(e.tag));

const hashMonth = /^#(\d{4})-(\d{2})$/.exec(location.hash);
if (hashMonth && +hashMonth[2] >= 1 && +hashMonth[2] <= 12) {
  monthCur = { y: +hashMonth[1], m: +hashMonth[2] - 1 };
  selDay = monthCur.y === todayInfo.y && monthCur.m === todayInfo.m ? TODAY : dayOf(monthCur.y, monthCur.m, 1);
}

/* ---------- Event row (selected-day list) ---------- */
function timeCell(e, day) {
  const kind = !e.multi ? "single" : day === e.sDay ? "first" : day === e.eDay ? "last" : "middle";
  let big = "All day", small = "", word = true;
  if (kind === "single" && !e.allDay) {
    big = fmtTime(e.s.min);
    word = false;
    if (e.e && e.e.min !== null) small = `to ${fmtTime(e.e.min)}`;
    else if (e.tag === "deadline") small = "Due";
  } else if (kind === "first" && !e.allDay) {
    big = fmtTime(e.s.min); small = "Starts"; word = false;
  } else if (kind === "last" && e.e && e.e.min !== null) {
    big = fmtTime(e.e.min); small = "Ends"; word = false;
  }
  const progress = e.multi ? `Day ${day - e.sDay + 1} of ${e.eDay - e.sDay + 1}` : "";
  return { kind, big, small, word, progress };
}
const sortKeyOn = (e, day) => {
  const t = timeCell(e, day);
  if (t.word) return -1;
  return t.kind === "last" ? e.e.min : e.s.min;
};
function placeLine(e) {
  const L = e.location;
  if (!L || !L.name) return "";
  return L.city && !L.name.includes(L.city) ? `${L.name}, ${L.city}` : L.name;
}
function evRow(e, day) {
  const t = timeCell(e, day);
  const cont = t.kind === "middle" || t.kind === "last";
  const eyebrow = [TAGS[e.tag].label, e.cancelled ? "Cancelled" : t.progress].filter(Boolean).join(" · ");
  const place = placeLine(e);
  const fl = !e.cancelled ? FLIGHTS[e.id] : null; // shown on every day of the event, not just the first
  const best = fl?.best?.[0];
  const fare = best?.total ?? null;
  const altFare = fl?.alternative && fl.alternative.saving >= 5 ? fl.alternative.total : null; // only when worth a day's shift
  const arrive = best ? lastTimed(best.out)?.b : null, leave = best ? firstTimed(best.back)?.a : null;
  const times = [arrive && `arrive ${fmtTime(arrive.min)}`, leave && `leave ${fmtTime(leave.min)}`].filter(Boolean).join(" · ");
  const cls = `ev-row tag-${e.tag}${cont ? " is-cont" : ""}${e.cancelled ? " is-cancelled" : ""}`;
  return `<button class="${cls}" type="button" data-id="${esc(e.id)}">
    <span class="ev-time"><b class="${t.word ? "word" : ""}">${t.big}</b>${t.small ? `<small>${t.small}</small>` : ""}</span>
    <span class="ev-main">
      <span class="ev-eyebrow">${esc(eyebrow)}</span>
      <span class="ev-title">${esc(e.title)}${e.isNew && !cont ? " " + NEW : ""}</span>
      ${place ? `<span class="ev-loc">${svg("pin", 14)}<span>${esc(place)}</span></span>` : ""}
      ${fare != null ? `<span class="ev-fly">${svg(fl.mode === "bus" ? "bus" : "plane", 14)}<span>From ${esc(flightsOrigin)}: ${priceTag(fare)}${times ? ` · ${times}` : ""}${altFare != null ? ` · ±1 day ${priceTag(altFare)}` : ""}</span></span>` : ""}
      ${e.description ? `<span class="ev-desc">${esc(e.description)}</span>` : ""}
    </span>
  </button>`;
}
const onDay = (evs, day) =>
  evs.filter((e) => e.sDay <= day && e.eDay >= day).sort((a, b) => sortKeyOn(a, day) - sortKeyOn(b, day));

/* ---------- Month ---------- */
const MAX_LANES = 3;
function renderMonth() {
  const view = document.getElementById("view");
  const { y, m } = monthCur;
  const first = dayOf(y, m, 1);
  const g0 = first - info(first).wd;
  const evs = visible();
  let weeks = "";
  for (let w = 0; w < 6; w++) {
    const w0 = g0 + w * 7, w1 = w0 + 6;
    const items = evs
      .filter((e) => e.sDay <= w1 && e.eDay >= w0)
      .map((e) => ({ e, a: Math.max(e.sDay, w0) - w0, b: Math.min(e.eDay, w1) - w0 }))
      .sort((p, q) => p.a - q.a || (q.b - q.a) - (p.b - p.a) || q.e.multi - p.e.multi || q.e.allDay - p.e.allDay || p.e.s.abs - q.e.s.abs);
    const occ = [];
    const hidden = Array(7).fill(0);
    let bars = "";
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
      if (lane >= MAX_LANES) { for (let c = it.a; c <= it.b; c++) hidden[c]++; continue; }
      bars += monthItem(it, lane, w0);
    }
    hidden.forEach((n, c) => {
      if (n) bars += `<button class="mi-more" type="button" style="grid-column:${c + 1}" data-day="${w0 + c}" aria-label="${n} more on ${fmtDay(w0 + c)}">+${n}<span class="more-word"> more</span></button>`;
    });
    let days = "";
    for (let c = 0; c < 7; c++) {
      const d = w0 + c, i = info(d);
      const cls = ["md", i.m !== m && "out", c >= 5 && "wkend", d === TODAY && "today", d === selDay && "sel"].filter(Boolean).join(" ");
      days += `<button class="${cls}" type="button" data-day="${d}" aria-label="${fmtDayLong(d)}"><span class="md-num">${i.d}</span></button>`;
    }
    weeks += `<div class="mw"><div class="mw-days">${days}</div><div class="mw-items">${bars}</div></div>`;
  }
  const wd = WD.map((n) => `<span><span class="long">${n}</span><span class="short">${n[0]}</span></span>`).join("");
  const si = info(selDay);
  view.innerHTML = `<div class="month">
    <div>
      <div class="m-head">
        <h2>${MON_LONG[m]} ${y}</h2>
        <div class="m-nav">
          <button class="btn" type="button" data-today>Today</button>
          <button class="iconbtn" type="button" data-nav="-1" aria-label="Previous month">${svg("left")}</button>
          <button class="iconbtn" type="button" data-nav="1" aria-label="Next month">${svg("right")}</button>
        </div>
      </div>
      <div class="mgrid"><div class="m-wd">${wd}</div>${weeks}</div>
    </div>
    <aside class="m-side" id="m-side" aria-live="polite">
      <h3>${WD_LONG[si.wd]}, ${si.d} ${MON[si.m]}<small>${selDay === TODAY ? "Today" : ""}</small></h3>
      ${sideList(evs)}
      ${TIER_CUTS ? `<p class="m-legend price-key">Trip prices from ${esc(flightsOrigin)}: <span class="key tier-cheap">cheap</span><span class="key tier-mid">mid</span><span class="key tier-dear">pricey</span></p>` : ""}
    </aside>
  </div>`;
}
function sideList(evs) {
  if (!EVENTS.length) {
    return `<p class="m-legend">No events yet. They appear here when BEST International emails arrive.</p>`;
  }
  if (!evs.length) {
    return `<p class="m-legend">No events match these filters. <button class="linkbtn" type="button" data-showall>Show all types</button></p>`;
  }
  const items = onDay(evs, selDay);
  if (items.length) {
    return `<div class="ev-list">${items.map((e) => evRow(e, selDay)).join("")}</div>
      <p class="m-legend">Pick any day in the grid to list its events here.</p>`;
  }
  const next = evs.find((e) => e.sDay > selDay);
  if (!next) return `<p class="m-legend">Nothing on this day, and nothing planned after it yet.</p>`;
  return `<p class="m-legend">Nothing on this day. Next up, ${fmtDay(next.sDay)}:</p>
    <div class="ev-list">${onDay(evs, next.sDay).map((e) => evRow(e, next.sDay)).join("")}</div>`;
}
const tripFare = (e) => (e.cancelled ? null : FLIGHTS[e.id]?.best?.[0]?.total ?? null);
function monthItem(it, lane, w0) {
  const e = it.e;
  const fare = tripFare(e);
  const tier = tierOf(fare);
  const price = fare != null ? `<span class="mi-p${tier ? " tier-" + tier : ""}">€${Math.round(fare)}</span>` : "";
  const contL = e.sDay < w0 + it.a, contR = e.eDay > w0 + it.b;
  const pos = `grid-column:${it.a + 1}/${it.b + 2};grid-row:${lane + 1}`;
  const when = e.allDay ? fmtDay(e.sDay) : `${fmtDay(e.sDay)} ${fmtTime(e.s.min)}`;
  const label = `${TAGS[e.tag].label}${e.cancelled ? ", cancelled" : ""}: ${e.title}, ${when}${fare != null ? `, trip from ${flightsOrigin} ${euro(fare)}${tier ? ` (${TIER_WORD[tier]})` : ""}` : ""}`;
  const cx = e.cancelled ? " is-cancelled" : "";
  if (e.multi) {
    const cls = `mi multi tag-${e.tag}${cx}${contL ? " cont-l" : ""}${contR ? " cont-r" : ""}`;
    const lead = contL || e.allDay ? "" : `${fmtTime(e.s.min)} `;
    return `<button class="${cls}" type="button" style="${pos}" data-id="${esc(e.id)}" aria-label="${esc(label)}"><span class="mi-n">${lead}${esc(e.title)}</span>${price}</button>`;
  }
  const time = e.allDay ? "" : `<span class="mi-t">${fmtTime(e.s.min)}</span>`;
  return `<button class="mi single tag-${e.tag}${cx}" type="button" style="${pos}" data-id="${esc(e.id)}" aria-label="${esc(label)}"><i class="mi-dot"></i>${time}<span class="mi-n">${esc(e.title)}</span>${price}</button>`;
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
    if (!e.e && e.tag === "deadline") {
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
  const words = segs.map(segText);
  if (home && home.minutes) words[label === "Out" ? "unshift" : "push"](`${home.text} ${fmtDur(home.minutes)}`);
  const note = words.join(" · ");
  const bar = segs.map((g) => {
    const what = g.kind === "night" ? "Overnight wait" : g.kind === "wait" ? "Wait" : g.kind === "bus" ? "Bus" : "Flight";
    const tip = `${what} ${fmtTime(g.a.min)}–${fmtTime(g.b.min)} (${g.approx ? "≈" : ""}${fmtDur(g.min)})`;
    const icon = (g.kind === "bus" || g.kind === "flight") && g.min / total >= 0.14 ? svg(g.kind === "bus" ? "bus" : "plane", 12) : "";
    return `<i class="seg ${g.kind}" style="flex-grow:${Math.max(g.min, 1)}" title="${esc(tip)}">${icon}</i>`;
  }).join("");
  return `<div class="tl">
    <p class="tl-head"><span><b>${label}</b> · ${fmtDay(refDay)}</span><span class="tl-dur">${fmtDur(total)} total</span></p>
    <div class="tl-ends">
      <span class="tl-end"><b>${clock(first.a, refDay)}</b><span>${esc(placeFrom(first.s))}</span></span>
      <span class="tl-end r"><b>${clock(last.b, refDay)}</b><span>${esc(placeTo(last.s))}</span></span>
    </div>
    <div class="tl-bar" aria-hidden="true">${bar}</div>
    <p class="tl-note">${esc(note[0].toUpperCase() + note.slice(1))}</p>
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
  const head = `<p class="trip-head">${svg(bus ? "bus" : "plane", 16)} Getting there from ${esc(flightsOrigin)}${bus ? " by bus" : ""}</p>`;
  const best = f.best && f.best[0];
  const alt = f.alternative;
  if (!best && !alt) {
    return `<section class="trip">${head}<p class="trip-note">${bus ? "No FlixBus rides found for these dates yet." : "No bus + flight combination found for these dates yet."} ${esc(when)}</p></section>`;
  }
  const baseline = best && f.baseline && f.baseline > best.total + 0.5
    ? `<p class="trip-note">Flying from ${esc(flightsOrigin)} both ways on these dates: ${euro(f.baseline)}</p>` : "";
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
  lastFocus = document.activeElement;
  const L = e.location;
  let where = "";
  if (L && L.name) {
    const sub = [L.address, L.city].filter(Boolean).join(", ");
    const online = /^online$/i.test(L.name.trim());
    const maps = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent([L.name, L.address, L.city].filter(Boolean).join(", "));
    where = `<div><dt class="lbl">Where</dt><dd><span>${esc(L.name)}</span>${sub ? `<span class="muted">${esc(sub)}</span>` : ""}${online ? "" : `<a href="${esc(maps)}" target="_blank" rel="noopener">Open in Maps ${svg("ext", 14)}</a>`}</dd></div>`;
  }
  const url = e.url ? safeUrl(e.url) : null;
  const link = url ? `<div><dt class="lbl">Link</dt><dd><a href="${esc(url.href)}" target="_blank" rel="noopener">Open link ${svg("ext", 14)}</a><span class="muted">${esc(url.hostname)}</span></dd></div>` : "";
  const src = e.source || {};
  const srcRows = [
    src.from ? `<div><dt class="lbl">From</dt><dd>${esc(src.from)}</dd></div>` : "",
    src.subject ? `<div><dt class="lbl">Subject</dt><dd>${esc(src.subject)}</dd></div>` : "",
    e.rec ? `<div><dt class="lbl">Received</dt><dd>${fmtReceived(e.rec)}</dd></div>` : "",
  ].join("");
  document.getElementById("dr-body").innerHTML = `<article class="ticket tag-${e.tag}">
    <div class="tk-band">${svg(e.tag, 18)}<span>${esc(TAGS[e.tag].label)}${e.cancelled ? " · Cancelled" : ""}</span></div>
    <div class="tk-body">
      <h2 class="tk-title${e.cancelled ? " is-cancelled" : ""}" id="tk-title">${esc(e.title)}${e.isNew ? NEW : ""}</h2>
      ${whenHtml(e)}
      ${where || link ? `<dl class="fields">${where}${link}</dl>` : ""}
      ${e.description ? `<p class="desc">${esc(e.description)}</p>` : ""}
      ${flightsHtml(e)}
    </div>
    ${srcRows ? `<div class="perf" aria-hidden="true"><i></i><i></i></div>
    <div class="src">
      <p class="src-head">${svg("mail", 16)} Added from email</p>
      <dl class="fields">${srcRows}</dl>
    </div>` : ""}
  </article>`;
  drawer.hidden = false;
  scrim.hidden = false;
  drawer.scrollTop = 0;
  requestAnimationFrame(() => { drawer.classList.add("open"); scrim.classList.add("open"); });
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

function renderStatus() {
  const el = document.getElementById("status");
  const parts = [];
  const fresh = EVENTS.filter((e) => e.isNew).length;
  if (fresh) parts.push(`<span class="new">New</span><span><strong>${fresh} ${fresh === 1 ? "event" : "events"}</strong> added in the last day</span>`);
  if (updatedAt) {
    const t = Date.parse(updatedAt);
    const abs = Number.isNaN(t) ? parseWhen(updatedAt)?.abs : Math.floor(t / 60000);
    if (abs != null) parts.push(`<span>Updated from email ${ago(abs)}</span>`);
  } else if (loaded) {
    parts.push(`<span>Waiting for the first email sync</span>`);
  }
  el.innerHTML = parts.join("");
}
function renderFilters() {
  const counts = {};
  for (const e of EVENTS) counts[e.tag] = (counts[e.tag] || 0) + 1;
  const allOn = active.size === Object.keys(TAGS).length;
  document.getElementById("filters").innerHTML =
    Object.entries(TAGS).map(([k, t]) =>
      `<button class="fchip tag-${k}" type="button" data-tag="${k}" aria-pressed="${active.has(k)}"><i class="sw"></i>${t.label}<span class="n">${counts[k] || 0}</span></button>`
    ).join("") + (allOn ? "" : `<button class="linkbtn" type="button" data-showall>Show all</button>`);
}
function render() {
  renderStatus();
  renderFilters();
  renderMonth();
}
function goMonth(delta) {
  const d = new Date(Date.UTC(monthCur.y, monthCur.m + delta, 1));
  monthCur = { y: d.getUTCFullYear(), m: d.getUTCMonth() };
  const isThis = monthCur.y === todayInfo.y && monthCur.m === todayInfo.m;
  selDay = isThis ? TODAY : dayOf(monthCur.y, monthCur.m, 1);
  try { history.replaceState(null, "", isThis ? location.pathname : `#${monthCur.y}-${pad(monthCur.m + 1)}`); } catch {}
  renderMonth();
}

document.addEventListener("click", (ev) => {
  const chip = ev.target.closest("[data-tag]");
  if (chip) {
    const k = chip.dataset.tag;
    active.has(k) ? active.delete(k) : active.add(k);
    render();
    return;
  }
  if (ev.target.closest("[data-showall]")) {
    Object.keys(TAGS).forEach((k) => active.add(k));
    render();
    return;
  }
  if (ev.target.closest("[data-retry]")) { load(); return; }
  const evBtn = ev.target.closest("#view [data-id]");
  if (evBtn) { openEvent(evBtn.dataset.id); return; }
  const nav = ev.target.closest("[data-nav]");
  if (nav) { goMonth(+nav.dataset.nav); return; }
  if (ev.target.closest("[data-today]")) {
    goMonth(todayInfo.y * 12 + todayInfo.m - (monthCur.y * 12 + monthCur.m));
    return;
  }
  const dayBtn = ev.target.closest("#view [data-day]");
  if (dayBtn) {
    selDay = +dayBtn.dataset.day;
    const i = info(selDay);
    if (i.y !== monthCur.y || i.m !== monthCur.m) monthCur = { y: i.y, m: i.m };
    renderMonth();
    if (mqPhone.matches || ev.target.closest(".mi-more")) {
      document.getElementById("m-side").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
});
document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape") { closeDrawer(); return; }
  if (!drawer.hidden || !loaded || ev.altKey || ev.ctrlKey || ev.metaKey) return;
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

async function load() {
  try {
    const flights = loadFlights();
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    await flights;
    EVENTS = prepare(Array.isArray(data.events) ? data.events : []);
    BY_ID = Object.fromEntries(EVENTS.map((e) => [e.id, e]));
    computeTiers();
    updatedAt = data.updatedAt || null;
    loaded = true;
    render();
  } catch (err) {
    if (loaded) return; // keep showing the last good data during a background refresh
    console.warn("Could not load events:", err);
    document.getElementById("view").innerHTML =
      `<div class="state"><p>Couldn't load the events. Check your connection and try again.</p><button class="btn" type="button" data-retry>Try again</button></div>`;
  }
}

mqPhone.addEventListener("change", () => { if (loaded) renderMonth(); });
load();
setInterval(() => { if (drawer.hidden) load(); }, REFRESH_MS);
