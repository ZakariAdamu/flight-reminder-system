# Flight Reminder System

## Project Overview

A full-stack flight reminder and traveller notification management system.

The system will:

- Synchronize traveller/flight data with Google Sheets.
- Display traveller records in a web dashboard.
- Calculate flight reminder times automatically.
- Send personalized flight reminders to travellers.
- CC two administrators on traveller reminder emails.
- Notify administrators 2 hours before a traveller reminder is due.
- Notify administrators after a traveller reminder has been successfully sent.
- Maintain detailed audit logs.
- Prevent duplicate notifications.
- Retry failed notification attempts.
- Handle flight and timezone calculations reliably.
- Run using Docker in the production environment.

## Technology Stack

### Frontend
- Next.js
- React
- TypeScript
- Tailwind CSS

### Backend
- Next.js server-side functionality
- PostgreSQL
- ORM: To be selected

### Infrastructure
- Docker
- Docker Compose

### External Services
- Google Sheets API
- Transactional email provider: To be selected

## Current Phase

Phase 1 — Project Foundation

## Current Milestone

Milestone 1 — Initial Next.js project setup

## Completed

- Project initialized with Next.js
- TypeScript configured
- ESLint configured
- Tailwind CSS configured
- App Router configured
- Initial project documentation created

## Not Yet Implemented

- PostgreSQL
- Docker
- Database schema
- Google Sheets integration
- Email integration
- Reminder scheduler
- Background worker
- Audit logging
- Authentication
- Production deployment

## Important Business Rules

### Traveller Reminder

The traveller reminder is scheduled for:

24 hours and 2 minutes before the flight departure time.

### Administrator Advance Notification

Two administrators should receive a notification:

2 hours before the traveller reminder is due.

### Traveller Email

The traveller receives the personalized flight reminder.

Two administrators are CC'd.

### Administrator Confirmation

After successful email submission, the administrators receive a confirmation that the traveller reminder was sent.

### Reliability

The system must prevent duplicate reminder emails even if a worker retries or crashes during processing.

## Development Workflow

Each meaningful milestone should be:

1. Developed on a feature branch.
2. Tested locally.
3. Committed to Git.
4. Pushed to GitHub.
5. Submitted as a Pull Request.
6. Reviewed and corrected where necessary.
7. Merged into main.

## Current Branch

To be updated after Git setup.

## Next Milestone

Milestone 2 — Docker and PostgreSQL foundation.