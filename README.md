# BEST Calendar

A public month calendar of BEST International events and application deadlines. When a call arrives on the BEST Zagreb international mailing list, its event and deadline show up on the site automatically.

## How it works

1. **Emails arrive** in Gmail from the BEST Zagreb international list (subject `[BEST International]`). Local `[BEST Active]` emails are not included.
2. **Once an hour, a Claude routine** reads the new international emails through the Gmail connector. It pulls out each event's dates, place, type and a short description, and saves them in `data/events.json`. The full instructions are in `.claude/skills/sync-events/SKILL.md`.
3. **The same routine prices the trip** from Zagreb to each upcoming event abroad and saves it in `data/flights.json` (see [Travel prices](#travel-prices)).
4. **GitHub Pages** republishes the site. `index.html` loads `data/events.json` and draws the month grid. An open page also reloads the data every 10 minutes.

| Path | What it is |
| --- | --- |
| `index.html`, `assets/` | The site: month grid, type filters, list of the selected day's events, event details |
| `data/events.json` | All events, in the shape described below |
| `data/sync-state.json` | Which emails have already been read, so none is processed twice |
| `data/flights.json` | The cheapest trips from Zagreb to each upcoming event; written by the routine, never by hand |
| `scripts/validate-events.mjs` | Checks the data files; the routine runs it before every push |
| `.claude/skills/sync-events/` | The steps the hourly routine follows |
| `designs/` | The first design round, with three layout options and sample data |

## Turning the site on

1. Merge this work into `main`.
2. In the repo on GitHub, go to **Settings → Pages**, choose **Deploy from a branch**, then select **main** and **/ (root)**, and save.
3. After a minute the site is live at `https://zkristo.github.io/best-calendar/`.

To try it locally, run `python3 -m http.server` in the repo folder and open http://localhost:8000. Opening `index.html` directly from disk won't work, because the browser blocks loading the data file.

## Fixing an event by hand

Edit `data/events.json` on GitHub using the pencil icon, then check it:

```sh
node scripts/validate-events.mjs --fix
```

The sync never re-adds an event from an email it has already read, so you can safely delete or correct any event.

## Event shape

```jsonc
{
  "id": "g-<gmailMessageId>-1",
  "title": "aRM 2026 – Region Peach",
  "tag": "meeting",            // meeting | course | competition | social | deadline | other
  "start": "2026-10-29",            // a plain date for all-day, or local time with offset "2026-10-13T23:00+02:00"
  "end": "2026-11-01",              // same formats, or null; for plain dates it is the last day (inclusive)
  "location": { "name": "Camping Golden Sunset", "city": "Patras, Greece" },  // or { "name": "Online" } or null
  "airports": ["ATH", "GPA"],       // optional, nearest airports for travel prices (events abroad only)
  "url": "https://forms.gle/…",     // optional, the public application form only
  "description": "One or two sentences.",
  "status": "confirmed",           // or "cancelled"
  "source": { "from": "BEST Zagreb International list", "subject": "…", "receivedAt": "2026-10-12T09:05+02:00", "messageId": "…" }
}
```

The site and this repo are public, so the data never contains email addresses or other personal contact details.

## Travel prices

Each upcoming event abroad shows the cheapest way to get there from Zagreb and back. The event list shows a "Round trip from Zagreb" price, and the event's details show every bus and flight with times and booking links.

- **Where the prices come from:** the routine installs [zagflights](https://github.com/zkristo/google-flights) and runs `zagflights events data/events.json --out data/flights.json`. It combines:
  - live FlixBus buses to nearby airports (Zagreb, Ljubljana, Graz, Venice, Treviso, Trieste, Vienna, Bratislava, Budapest, Belgrade and others);
  - Kiwi.com flights, with Ryanair and Wizz Air fares taken from the airlines themselves;
  - cheap first flights out of Zagreb.
  The way out and the way back are priced separately, so you can fly into one airport and out of another.
- **Which dates:** you arrive on the event's first day and leave on its last day. A cheaper option flying a day earlier or later is shown underneath.
- **Which events:** in-person events with an `airports` list. The routine fills it in for events abroad and leaves it out for places an easy bus ride from Zagreb (Croatia, Slovenia, Hungary, Graz, Trieste).
- **How fresh:** each run re-prices up to 4 events whose prices are older than 20 hours, so every event is re-checked about once a day. The site shows when each price was checked.

Prices are snapshots for one person with a small bag. Every bus and flight is a separate ticket, so check the booking page before you buy, and leave time between connections.
