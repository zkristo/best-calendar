# BEST Calendar

A public month calendar of BEST International events and application deadlines. When a call arrives on the BEST Zagreb international mailing list, its event and deadline show up on the site automatically.

## How it works

1. **Emails arrive** in Gmail from the BEST Zagreb international list (subject `[BEST International]`). Local `[BEST Active]` emails are not included.
2. **Every night at midnight, a Claude routine** reads the new international emails through the Gmail connector. It pulls out each event's dates, place, type and a short description, and saves them in `data/events.json`. The full instructions are in `.claude/skills/sync-events/SKILL.md`.
3. **A GitHub Actions workflow prices the trip** from Zagreb to each upcoming event abroad and saves it in `data/flights.json` (see [Travel prices](#travel-prices)). It runs every night, and again whenever the routine changes `events.json`.
4. **GitHub Pages** republishes the site. `index.html` loads `data/events.json` and draws the month grid. An open page also reloads the data every 10 minutes.

| Path | What it is |
| --- | --- |
| `index.html`, `assets/` | The site: month grid, type filters, list of the selected day's events, event details |
| `data/events.json` | All events, in the shape described below |
| `data/sync-state.json` | Which emails have already been read, so none is processed twice, and when Gmail was last checked (the site shows it) |
| `data/flights.json` | The cheapest trips from Zagreb to each upcoming event; written by the workflow, never by hand |
| `scripts/validate-events.mjs` | Checks the data files; the routine runs it before every push |
| `.claude/skills/sync-events/` | The steps the nightly routine follows |
| `.github/workflows/prices.yml` | The travel-price workflow |
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
  "bus": "Ljubljana",               // optional, instead of airports: FlixBus city for events a bus ride away
  "url": "https://forms.gle/…",     // optional, the public application form only
  "description": "One or two sentences.",
  "fee": "€70",                     // optional, the participation fee as a short label ("€18/night", "free")
  "status": "confirmed",           // or "cancelled"
  "source": { "from": "BEST Zagreb International list", "subject": "…", "receivedAt": "2026-10-12T09:05+02:00", "messageId": "…" }
}
```

The site and this repo are public, so the data never contains email addresses or other personal contact details.

## Travel prices

Each upcoming event abroad shows the cheapest way to get there from Zagreb and back.

- **Event list:** the round-trip price, when you arrive and when you leave, and the ±1 day price when it's at least €5 cheaper.
- **Event details:** each option leads with the price and big departure/arrival times, then a travel line drawn to scale for each direction: riding, waiting (hatched; purple when it runs through the night), riding again. Flights use their real time in the air, so time zones don't stretch them. The bus and flight tickets with booking links are one click below.
- **Price colours:** every price is coloured against the other events' trips: green for the cheapest third, yellow for the middle, red for the priciest third.

- **Where the prices come from:** the workflow installs [zagflights](https://github.com/zkristo/google-flights) (public) and runs `zagflights events data/events.json --out data/flights.json`. It combines:
  - live FlixBus buses to nearby airports (Zagreb, Ljubljana, Graz, Venice, Treviso, Trieste, Vienna, Bratislava, Budapest, Belgrade and others);
  - Kiwi.com flights, with Ryanair and Wizz Air fares taken from the airlines themselves;
  - cheap first flights out of Zagreb.
  The way out and the way back are priced separately, so you can fly into one airport and out of another.
- **Which dates:** option 1 arrives on the event's first day and leaves on its last day. Option 2 is always shown: the cheapest trip that is a day off, e.g. "Arrive a day late (Sat 7 Nov) · €50 cheaper", or "€12 more" when the event dates are already the cheapest.
- **Which events:** in-person events with an `airports` list (bus + flight) or a `bus` city (FlixBus alone, for places an easy bus ride from Zagreb such as Ljubljana, Budapest, Graz, Vienna, Trieste or Belgrade). The routine fills in one of the two when it adds an event.
- **How fresh:** every night the workflow re-prices each event whose prices are older than 20 hours, so every event is re-checked once a day. New or changed events are priced as soon as the routine adds them. The site shows when each price was checked. To refresh by hand, open the repo's **Actions** tab, pick **Travel prices** and press **Run workflow**.

Prices are snapshots for one person with a small bag. Every bus and flight is a separate ticket, so check the booking page before you buy, and leave time between connections.
