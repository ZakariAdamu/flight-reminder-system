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

```bash
pnpm install

Copy `.env.example` to `.env` and configure the Google Sheets and Resend variables.
Keep `RESEND_API_KEY`, recipient lists, and sender configuration in `.env`; never
commit them. Set `EMAIL_FROM` to a Resend-verified sender before sending real mail.

Run synchronization with `pnpm sync:sheet` and process due reminders with
`pnpm process:reminders`.
```
