---
name: sync-events
description: Read new BEST group emails from Gmail, turn the events in them into entries in data/events.json, validate, and push to main so the public calendar site updates. Used by the hourly routine; also run it by hand for a backfill.
---

# Sync events from Gmail

The calendar site (`index.html`) shows whatever is in `data/events.json`. This skill keeps that file up to date from the group's emails. It needs the **Gmail connector**. If no Gmail tools are available in this session, stop and say so; do not invent events.

**The repo and the site are public.** Anything written to `data/` is visible to anyone.

## Settings

- **Group senders:** `TODO: set during setup` (for example `best-zagreb@googlegroups.com`). If this still says TODO, stop and ask the user which sender addresses to read.
- **Time zone:** Europe/Zagreb. The offset is `+02:00` from the last Sunday of March to the last Sunday of October, and `+01:00` otherwise.
- **First run window:** if `lastCheckedAt` is null, read the last 90 days.

## Steps

1. **Read the state.** Open `data/sync-state.json` (`lastCheckedAt`, `processed`) and `data/events.json`.

2. **Search Gmail.**
   - Use the query `from:(<sender1> OR <sender2>) after:<YYYY/MM/DD>`.
   - Set the date 2 days before `lastCheckedAt`, so nothing at the boundary is missed.
   - Skip every message whose ID is already in `processed`.
   - If nothing is left, stop here. Make no commit and report "No new emails".

3. **Read each new email in full**, oldest first, and pull out **zero or more events**:
   - An email can announce several events, for example a course and its application deadline. Create one entry for each.
   - Skip emails with no concrete date, such as general newsletters or minutes. They still go into `processed`.

4. **Fill each event** using the shape below.
   - `id`: `g-<messageId>-<n>`, where `n` is 1, 2, … within that email.
   - `title`: short and specific, in the email's language. Example: "EBEC Challenge Zagreb – final round".
   - `tag`: pick the closest match.
     - `meeting`: weekly or general meetings, board meetings, assemblies (sastanak, skupština).
     - `course`: courses, seasonal courses, workshops, trainings, lectures (tečaj, radionica, predavanje).
     - `competition`: EBEC and other engineering competitions, hackathons, case studies (natjecanje).
     - `social`: parties, team building, informal meetups, trips (druženje, tulum, izlet).
     - `deadline`: application, registration or payment deadlines (rok prijave). Use a single point in time with `end: null`.
     - `other`: anything else with a date.
   - `start` and `end`:
     - Known time: write the local time with its offset, e.g. `2026-11-03T18:00+01:00`.
     - Date with no time: use a plain date, `2026-11-03`. The event then shows as all day.
     - Events spanning several days (e.g. a 10-day course): plain dates. `end` is the **last day, inclusive**.
     - End time unknown: `end: null`.
     - Year not given: pick the nearest matching date after the email's received date.
   - `location`:
     - In person: `{ "name", "address", "city" }`, including only what the email says.
     - Online: `{ "name": "Online" }`.
     - Not stated: `null`.
   - `url`: only a **public** registration, application or information page. Never a Zoom, Meet or Teams link, a shared document, or anything that needs a login.
   - `description`: one or two sentences with the useful details, such as who it's for, what to bring, or the price. No personal data.
   - `status`: `"confirmed"`.
   - `source`:
     - `from`: the sender's **display name only**. Remove the email address.
     - `subject`: the email subject.
     - `receivedAt`: the received time with offset.
     - `messageId`: the Gmail message ID.

5. **Changes to existing events.** If an email changes an event already in `events.json`, update that entry in place and keep its `id`. An email counts as a change when it is in the same thread, or names the same event (similar title, same date or the original date).
   - **Moved or changed:** update the dates, place or details.
   - **Cancelled** (otkazano, cancelled): set `"status": "cancelled"` and keep the entry.
   - Never delete an entry. The user may also have edited or deleted entries by hand: leave those alone, and don't re-add anything from a message already in `processed`.

6. **Write the files.**
   - In `data/events.json`, add or update the events and set `updatedAt` to now (Europe/Zagreb, with offset).
   - In `data/sync-state.json`, set `lastCheckedAt` to now and append every message ID you read, including ones with no events. Keep only the newest 2000 IDs.

7. **Validate.** Run `node scripts/validate-events.mjs --fix`. It sorts the events and reports any problems. Fix every problem it lists and run it again until it prints `OK`. If you cannot get it to pass, do not push; report what is wrong.

8. **Commit and push to `main`.**
   - Commit message: `Sync events from Gmail (N new, M updated)`, or `Sync events from Gmail (no events in K emails)` when only the state changed.
   - Push with `git push origin HEAD:main`. On a network error, retry up to 4 times with waits of 2, 4, 8 and 16 seconds. If the push is rejected because `main` moved, run `git pull --rebase origin main`, validate again, then push.

9. **Report.** List the emails read and the events added, updated or cancelled, each with title, date and tag. Mention anything you were unsure about.

## Privacy rules (the site is public)

- No email addresses, phone numbers, home addresses or other contact details of people. The validator rejects email addresses.
- Don't name individual members unless they are the public speaker or host of the event.
- No private meeting links and no links to internal documents.
- If an email is clearly private or personal (not a group announcement), skip it. It still goes into `processed`.
