# Flight Reminder System

A full-stack flight reminder and traveller notification management system built with Next.js and TypeScript.

## Core Features

- Traveller and flight management
- Google Sheets synchronization
- Automated flight reminders
- Administrator advance notifications
- Transactional email delivery
- Audit logs
- Retry handling
- Duplicate notification protection
- Dockerized deployment

## Development

Install dependencies:

````bash
pnpm install

Copy `.env.example` to `.env` and configure the Google Sheets and Resend variables.
Keep `RESEND_API_KEY`, recipient lists, and sender configuration in `.env`; never
commit them. Set `EMAIL_FROM` to a Resend-verified sender before sending real mail.

For Vercel Cron, add the same variables to the Vercel project environment and
set `CRON_SECRET` to a long random value. Vercel sends this value as
`Authorization: Bearer <CRON_SECRET>` to `/api/cron/reminders`; unauthenticated
requests are rejected. The schedule is configured in `vercel.json` for every
two hours. Each run first synchronizes Google Sheets into PostgreSQL, then
processes due reminders and updates both PostgreSQL and the Sheet after each
send.

The configured Google Sheet must contain these headers, including the separate
status columns:

```text
SN, Name of  Clients, Route, Origin, Destination, Departure Date,
Departure Time, Arrival Date, Arrival Time, Layover City,
Layover Start Date, Layover End Date, Layover Start Time,
Layover End Time, Layover Duration, Client Email, Flight Status,
Reminder Status
````

The Google credentials used by the deployment must have spreadsheet read/write
access. `Reminder Status` is updated after processing, while cancellation is
read from `Flight Status`.

Run synchronization with `pnpm sync:sheet`. The reminder sender command,
`pnpm process:reminders`, synchronizes first and only sends reminders if that
sync succeeds, then updates the database and Sheet after each send.

Reminder reporting commands are read-only:

```bash
pnpm report:reminders:month
pnpm report:reminders:week
pnpm report:reminders:two-weeks
```

The first reports all reminders scheduled in the current UTC calendar month.
The second reports the next 7 days. The third reports days 8 through 14 from
today, so the one-week and two-week reports do not overlap. Each command
prints totals, ADMIN/CLIENT counts, status counts, and reminder details.

The local command processes one cycle. Production uses the authenticated
`/api/cron/reminders` route, invoked by Vercel every two hours.

Reminder timing is calculated from flight departure: the ADMIN reminder is
scheduled for 48 hours before departure and the CLIENT reminder for 24 hours
before departure. Subjects include the timing and traveller name, for example
`48hrs flight reminder for Jane Doe`.

Vercel Cron is managed by Vercel and is subject to the limits of the Vercel
plan hosting the project. It is not a personal machine cron and does not run
independently of Vercel. In particular, the Vercel Hobby plan has restrictive
cron frequency limits, so an every-two-hours schedule may require a paid plan
or an external scheduler such as cron-job.org. An external scheduler can call
the same authenticated endpoint, but it still needs the deployed Vercel route
to be available and does not remove Resend or database quotas.

```

```
