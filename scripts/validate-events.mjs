#!/usr/bin/env node
// Checks data/events.json (and data/sync-state.json) before they are pushed.
//
//   node scripts/validate-events.mjs                 validate the default files
//   node scripts/validate-events.mjs path/to.json    validate another events file
//   node scripts/validate-events.mjs --fix           also sort events by start and rewrite the file
//
// Exits with code 1 and lists every problem when something is wrong.

import { readFileSync, writeFileSync } from "node:fs";

const TAGS = ["meeting", "course", "competition", "social", "deadline", "other"];
const STATUS = ["confirmed", "cancelled"];
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

const args = process.argv.slice(2);
const fix = args.includes("--fix");
const files = args.filter((a) => a !== "--fix");
const eventsFile = files[0] || "data/events.json";
const stateFile = files[0] ? null : "data/sync-state.json";

const problems = [];
const fail = (where, msg) => problems.push(`${where}: ${msg}`);

// Same keys the site uses: a plain date sorts at the start of that day.
function parseWhen(s) {
  if (typeof s !== "string") return null;
  let m = DATE_RE.exec(s);
  if (m) {
    const t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
    if (new Date(t).getUTCDate() !== +m[3]) return null;
    const day = t / 864e5;
    return { day, timed: false, abs: day * 1440 };
  }
  m = TIME_RE.exec(s);
  if (!m) return null;
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  if (new Date(t).getUTCDate() !== +m[3] || +m[4] > 23 || +m[5] > 59) return null;
  const off = m[6] === "Z" ? 0 : (m[6][0] === "-" ? -1 : 1) * (+m[6].slice(1, 3) * 60 + +m[6].slice(4, 6));
  const day = t / 864e5;
  return { day, timed: true, abs: day * 1440 + +m[4] * 60 + +m[5] - off };
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    fail(file, `cannot read or parse JSON (${err.message})`);
    return null;
  }
}

function checkStrings(where, value) {
  if (typeof value === "string") {
    if (EMAIL_RE.test(value)) fail(where, "contains an email address; the site is public, so remove it");
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) checkStrings(`${where}.${k}`, v);
  }
}

function checkEvent(e, i, seen) {
  const at = `events[${i}]${e && typeof e.id === "string" ? ` (${e.id})` : ""}`;
  if (!e || typeof e !== "object" || Array.isArray(e)) return fail(at, "must be an object");

  if (typeof e.id !== "string" || !e.id.trim()) fail(at, "id must be a non-empty string");
  else if (seen.has(e.id)) fail(at, "id is used more than once");
  else seen.add(e.id);

  if (typeof e.title !== "string" || !e.title.trim()) fail(at, "title must be a non-empty string");
  else if (e.title.length > 200) fail(at, "title is longer than 200 characters");

  if (!TAGS.includes(e.tag)) fail(at, `tag must be one of: ${TAGS.join(", ")}`);
  if (e.status !== undefined && !STATUS.includes(e.status)) fail(at, `status must be one of: ${STATUS.join(", ")}`);

  const s = parseWhen(e.start);
  if (!s) fail(at, `start "${e.start}" must be YYYY-MM-DD or YYYY-MM-DDTHH:MM+HH:MM`);
  if (e.end !== undefined && e.end !== null) {
    const en = parseWhen(e.end);
    if (!en) fail(at, `end "${e.end}" must be YYYY-MM-DD, YYYY-MM-DDTHH:MM+HH:MM or null`);
    else if (s) {
      const before = s.timed && en.timed ? en.abs < s.abs : en.day < s.day;
      if (before) fail(at, "end is before start");
    }
  }

  if (e.location !== undefined && e.location !== null) {
    const L = e.location;
    if (typeof L !== "object" || Array.isArray(L)) fail(at, "location must be an object or null");
    else {
      if (typeof L.name !== "string" || !L.name.trim()) fail(at, "location.name must be a non-empty string");
      for (const k of ["address", "city"]) {
        if (L[k] !== undefined && L[k] !== null && typeof L[k] !== "string") fail(at, `location.${k} must be a string`);
      }
    }
  }

  if (e.url !== undefined && e.url !== null) {
    let ok = false;
    try { ok = ["https:", "http:"].includes(new URL(e.url).protocol); } catch {}
    if (!ok) fail(at, "url must be an http(s) link");
  }
  if (e.description !== undefined && e.description !== null && typeof e.description !== "string") {
    fail(at, "description must be a string");
  }

  if (e.source !== undefined && e.source !== null) {
    const src = e.source;
    if (typeof src !== "object" || Array.isArray(src)) fail(at, "source must be an object");
    else {
      for (const k of ["from", "subject", "messageId"]) {
        if (src[k] !== undefined && typeof src[k] !== "string") fail(at, `source.${k} must be a string`);
      }
      if (src.receivedAt !== undefined) {
        const r = parseWhen(src.receivedAt);
        if (!r || !r.timed) fail(at, "source.receivedAt must be YYYY-MM-DDTHH:MM+HH:MM");
      }
    }
  }
  checkStrings(at, e);
}

const data = readJson(eventsFile);
if (data) {
  if (typeof data !== "object" || Array.isArray(data)) fail(eventsFile, "must be an object with updatedAt and events");
  else {
    if (data.updatedAt !== null && !(parseWhen(data.updatedAt)?.timed)) {
      fail(eventsFile, "updatedAt must be null or YYYY-MM-DDTHH:MM+HH:MM");
    }
    if (!Array.isArray(data.events)) fail(eventsFile, "events must be an array");
    else {
      const seen = new Set();
      data.events.forEach((e, i) => checkEvent(e, i, seen));
      const key = (e) => parseWhen(e?.start)?.abs ?? Infinity;
      const sorted = data.events.every((e, i, a) => i === 0 || key(a[i - 1]) <= key(e));
      if (!sorted) {
        if (fix) {
          data.events.sort((a, b) => key(a) - key(b));
          writeFileSync(eventsFile, JSON.stringify(data, null, 2) + "\n");
          console.log(`Sorted ${data.events.length} events in ${eventsFile}.`);
        } else {
          fail(eventsFile, "events are not sorted by start (run with --fix to sort them)");
        }
      }
    }
  }
}

if (stateFile) {
  const state = readJson(stateFile);
  if (state) {
    if (state.lastCheckedAt !== null && !(parseWhen(state.lastCheckedAt)?.timed)) {
      fail(stateFile, "lastCheckedAt must be null or YYYY-MM-DDTHH:MM+HH:MM");
    }
    if (!Array.isArray(state.processed) || !state.processed.every((id) => typeof id === "string")) {
      fail(stateFile, "processed must be an array of Gmail message ids");
    }
  }
}

if (problems.length) {
  console.error(`Found ${problems.length} problem${problems.length === 1 ? "" : "s"}:`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
const n = data?.events?.length ?? 0;
console.log(`OK: ${eventsFile} has ${n} valid event${n === 1 ? "" : "s"}.`);
