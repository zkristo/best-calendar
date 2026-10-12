# best-calendar

A personal calendar website for travel bookings. Booking emails (flights, hotels, trains, car rentals, restaurants, tours) will be turned into events and shown on a big calendar.

## Design options

`designs/index.html` is a self-contained preview of three layouts. They all use the same sample bookings, so you can compare them side by side:

- **A · Agenda**: an itinerary-style list grouped by day. Best on a phone.
- **B · Month**: a Google-Calendar-style month grid. Hotel stays and rentals show as bars across the days they cover.
- **C · Timeline**: a Gantt-style view grouped by trip, so long bookings appear as long bars.

All three share tag colour filters and an event detail panel. The panel shows when, where, the booking reference, the description and which email the booking came from.

To view it, open `designs/index.html` in a browser. It needs no build step and no server.

### Event shape

The page already uses the data shape that the email parser will produce:

```js
{
  id, trip, tag,            // tag: flight | hotel | train | car | dining | activity
  title, meta,
  start, end,               // local time with UTC offset, e.g. "2026-10-16T07:05+02:00"
  route,                    // optional: { from, fromSub, to, toSub } for flights and trains
  location: { name, address, city },
  ref, description,
  source: { from, subject, receivedAt }
}
```
