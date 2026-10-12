---
name: sync-events
description: Read new BEST International emails from Gmail, turn the events and application deadlines in them into entries in data/events.json, validate, and push to main so the public calendar site updates. Used by the hourly routine; also run it by hand for a backfill.
---

# Sync events from Gmail

The calendar site (`index.html`) shows whatever is in `data/events.json`. This skill keeps that file up to date from the **BEST International** emails, the calls from other BEST groups across Europe that reach the user through the BEST Zagreb international list. Local Zagreb emails (`[BEST Active]`) are deliberately **not** included. The skill needs the **Gmail connector**. If no Gmail tools are available in this session, stop and say so; do not invent events.

**The repo and the site are public.** Anything written to `data/` is visible to anyone.

## Settings

- **Gmail query:** `{list:best_zagreb-international.googlegroups.com from:best_zagreb-international@googlegroups.com subject:"[BEST International]"} after:<YYYY/MM/DD>`
  - Some of these emails arrive forwarded by `board@best.hr`. The subject tag catches them too.
- **Time zone:** Europe/Zagreb. The offset is `+02:00` from the last Sunday of March to the last Sunday of October, and `+01:00` otherwise.
  - Calls write "CET" or "CEST" loosely. Use whichever offset is actually in force on that date: 23:00 on 15 October is `+02:00`, and 23:00 on 25 October is `+01:00`.
  - A deadline with no time zone from a Greek, Romanian or Turkish group can use that country's offset.
- **First run window:** if `lastCheckedAt` is null, read the last 45 days.

## The email format

Almost every call starts with a header block, which is the main thing to read:

```
#WHAT: Nordic Joint Board Training
#WHEN: 23-25 October
#WHERE: Dresso (LOCATION)
#FEE: 0€ + 20€ optional alco fee
#APPLY: FORM
#DEADLINE: 16 October 23:59
```

Field names vary: `#What❓`, `# WHO:`, `#DL`, `#ddl`, `#How`, `#Application`.

- **Reminders and extensions.** Many messages are reminders in the same thread ("REMINDER", "LAST DAY", "[Extended]", "NEW DL: …"). They do not create new events. If they change a deadline, update the existing deadline entry (see step 5).
- **Years.** Dates often omit the year; use the next occurrence after the email date. If a stated year contradicts the rest of the email (for example "16/10/2027" in a call that closes on 4 October 2026), trust the text and mention it in the description.

## Steps

1. **Read the state.** Open `data/sync-state.json` (`lastCheckedAt`, `processed`) and `data/events.json`.

2. **Search Gmail.**
   - Run the query above. Set the date 2 days before `lastCheckedAt`, so nothing at the boundary is missed.
   - Skip every message whose ID is already in `processed`.
   - If nothing is left, stop here. Make no commit and report "No new emails".

3. **Read each new email**, oldest first, and pull out **zero or more entries**:
   - A typical call gives two: **the event itself** (dates and place) and **its application deadline**. An event with several calls (co-organisers, crashers, participants) gets one event entry and one deadline per call.
   - Calls for international teams, projects or hosting give a deadline only.
   - Skip emails with no concrete date, such as plans, tools or newsletters. They still go into `processed`.

4. **Fill each entry** using the shape below.
   - `id`: `g-<messageId>-<n>`, where `n` is 1, 2, … within that email.
   - `title`: short and specific, in English.
     - Events use their name, e.g. "aRM 2026 – Region Peach" or "Alpine Jam 2026 – Tied Up to the Middle Ages".
     - Deadlines say what closes, e.g. "Crasher applications close: aRM Region Peach", "Apply as Extra Delegate for aGA26", "Apply to host wIPF27".
   - `tag`: pick the closest match.
     - `meeting`: General Assemblies (GA), Regional Meetings (RM, aRM, sRM), other statutory meetings.
     - `course`: BEST courses, trainings, Joint Board Trainings (JBT), Motivational Weekends (MW), design weeks, workshops.
     - `competition`: EBEC, hackathons, engineering sprints, case studies.
     - `social`: Jams, Cultural Exchanges (CE), New Year's Eve events, parties.
     - `deadline`: any application, registration, proposal, payment or order deadline. Use a single point in time with `end: null`.
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
   - `url`: only the call's **application form** (Google Forms or Microsoft Forms) or a public information page. Never:
     - a Zoom, Meet or Teams link
     - a Google Doc, Sheet or Drive file
     - a `private.best.eu.org` or `pa.best.eu.org` page
     - payment links, or anything else that needs a login
     When applying means sending an email, leave `url` out and say "apply by email" in the description.
   - `description`: one or two neutral, factual sentences: who it's for, the fee, and how to apply.
     - Leave out jokes, innuendo and party slogans; calls are often written that way.
     - No personal data: no names of individual organisers, phone numbers, email addresses, IBANs or payment handles.
   - `status`: `"confirmed"`.
   - `source`:
     - `from`: `"BEST Zagreb International list"`, or `"BEST Zagreb Board"` when the message came from `board@best.hr`. Never an email address.
     - `subject`: the email subject.
     - `receivedAt`: the received time with offset.
     - `messageId`: the Gmail message ID.

5. **Changes to existing events.** If an email changes an event already in `events.json`, update that entry in place and keep its `id`. An email counts as a change when it is in the same thread, or names the same event (similar title, same date or the original date).
   - **Moved or changed:** update the dates, place or details.
   - **Cancelled** (cancelled, postponed indefinitely): set `"status": "cancelled"` and keep the entry.
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
