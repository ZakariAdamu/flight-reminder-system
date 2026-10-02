# Flight Reminder System

## 1. Project Overview

A full-stack flight reminder and traveller notification management system.

The system will:

- Synchronize traveller and flight data from Google Sheets.
- Display traveller records and operational history in a web dashboard.
- Store application state and operational data in PostgreSQL.
- Calculate reminder times automatically from flight departure date/time.
- Send personalized flight reminders to travellers.
- CC two administrators on traveller reminder emails.
- Send an administrator reminder exactly 48 hours before flight departure.
- Send the traveller reminder exactly 24 hours before flight departure.
- Notify administrators after a traveller reminder has been successfully sent.
- Maintain detailed audit logs.
- Prevent duplicate notifications through database-backed idempotency.
- Retry failed notification attempts using controlled retry logic.
- Run recurring synchronization and reminder-processing jobs.
- Run using Docker in the production environment.

---

## 2. Core Business Rules

### 2.1 Flight Departure Time

The system uses the departure date and departure time supplied by Google Sheets.

**No airport timezone conversion is performed.**

The Sheet's local date/time values are treated as the authoritative input values supplied by the operational data source.

Reminder calculations are based exclusively on flight departure date/time.

---

### 2.2 Administrator Reminder

Administrators receive an operational reminder:

**Exactly 48 hours before flight departure.**

This is the administrator reminder and replaces the earlier 2-hour advance-notification requirement.

---

### 2.3 Traveller Reminder

The traveller receives their personalized flight reminder:

**Exactly 24 hours before flight departure.**

Two administrators are CC'd on the traveller reminder email.

---

### 2.4 Administrator Confirmation

After a traveller reminder email is successfully submitted/sent, the administrators receive a confirmation that the traveller reminder was sent successfully.

The confirmation is a separate operational notification from the 48-hour administrator reminder.

---

### 2.5 Reminder Calculation

Reminder times are calculated deterministically:

```text
ADMIN reminder  = departureAt - 48 hours
CLIENT reminder = departureAt - 24 hours
```

The manually entered Google Sheet columns:

```text
24 hrs reminder date
48hr Reminder Date
```

are **not authoritative**.

The application calculates reminder times itself.

---

### 2.6 Reminder Types

Each flight has two reminder records:

```text
Flight
 ├── ADMIN reminder
 └── CLIENT reminder
```

A database uniqueness constraint on:

```text
(flightId, type)
```

prevents duplicate reminder records.

---

### 2.7 Reminder Status

Reminder lifecycle:

```text
PENDING
PROCESSING
SENT
FAILED
CANCELLED
SKIPPED
```

Reminder records should support:

- `sentAt`
- `failedAt`
- `errorMessage`
- `attemptCount`
- `providerMessageId`
- `nextAttemptAt`

---

## 3. Data Architecture

```text
Google Sheets
      │
      ▼
Fetch entire sheet
      │
      ▼
Row normalization
      │
      ▼
PostgreSQL sync
      │               │
      ▼               ▼
Dashboard          Traveller
                  + Flight
                      │
                      ▼
                  Reminders
                      │
                      ▼
                    Email
```

### Source of Truth

Google Sheets is the external operational data source/interface.

PostgreSQL is the application's source of truth for:

- Traveller records
- Flight records
- Reminder records
- Reminder state
- Audit logs
- Validation issues
- Notification processing state

---

## 4. Traveller and Flight Relationship

A traveller may have multiple flight records.

Example:

```text
Traveller: Garba Nura Baba

Flight 1:
ABV → MED

Flight 2:
MED → ABV
```

Therefore:

```text
Traveller
   │
   └──< Flight
          │
          ├── ADMIN Reminder
          └── CLIENT Reminder
```

### Google Sheet Row Identity

`Flight.sheetRow` uniquely identifies the source Google Sheet row.

`Traveller.sheetRow` is not used.

Travellers are identified using their unique email address.

This allows multiple Google Sheet rows to belong to the same traveller.

---

## 5. Technology Stack

### Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS

### Backend

- Next.js server-side functionality
- PostgreSQL
- Prisma 8
- Background processing/scheduling to be implemented

### Infrastructure

- Docker
- Docker Compose

### External Services

- Google Sheets API
- Resend transactional email API (free tier for development and low-volume operation)

---

## 6. Current Project Structure

The project uses a root-level Next.js `app/` directory.

Do not introduce a `src/` directory unless the architecture is deliberately changed and documented.

Current important directories/files include:

```text
app/
lib/
  google-sheets.ts
  google-sheets/
    mapping.ts
prisma/
  contract.prisma
scripts/
PROJECT_CONTEXT.md
docker-compose.yml
```

---

## 7. Database Schema

Current core models:

```text
Traveller
   │
   └──< Flight
          │
          ├──< Reminder
          │       │
          │       └──< AuditLog
          │
          └── ...
```

### Traveller

Contains:

- UUID primary key
- name
- location
- unique email
- created/updated timestamps
- flights
- audit logs

### Flight

Contains:

- UUID primary key
- traveller relationship
- origin
- destination
- departure date/time
- arrival date/time
- layover city
- layover beginning
- layover ending
- layover duration
- unique Google Sheet row
- created/updated timestamps
- reminders

### Reminder

Contains:

- UUID primary key
- unique `reminderId`
- flight relationship
- reminder type
- scheduled time
- status
- attempt count
- sent/failed timestamps
- retry time
- error information
- provider message ID
- created/updated timestamps

Reminder types:

```text
ADMIN
CLIENT
```

Uniqueness:

```text
(flightId, type)
```

### AuditLog

Records important system events involving:

- travellers
- flights
- reminders
- notification processing
- failures
- retries
- cancellations

---

## 8. Google Sheets Integration

The operational Google Sheet currently returns 17 populated columns in the configured range.

Important application fields include:

```text
SN
Name of  Clients
Route
Origin
Destination
Departure Date
Departure Time
Arrival Date
Arrival Time
Layover City
Layover Start Date
Layover End Date
Layover Start Time
Layover End Time
Layover Duration
Client Email
Flight Status
Reminder Status
```

The application must use **header-based mapping**, not fixed column positions.

This allows columns to be rearranged or additional columns to be added without breaking the integration.

`SN` is presentation/source-row information and is not the database identity.

### Current Google Sheets implementation

`lib/google-sheets.ts` provides:

```text
getSheetValues()
```

`lib/google-sheets/mapping.ts` provides:

- required-header definitions
- header validation
- raw row-to-record mapping
- empty-row and cancelled-row classification
- ARRAYFORMULA `Nil`-tail detection
- status-column read/write helpers for `Flight Status` and `Reminder Status`

Google Sheets authentication currently works through local Google Application Default Credentials with service-account impersonation.

Service-account JSON keys must not be stored in the project.

---

## 9. Google Sheets Synchronization

Synchronization should:

1. Fetch the entire configured Sheet.
2. Validate required headers.
3. Convert rows into header-based records.
4. Preserve the physical Sheet row number.
5. Normalize values.
6. Validate every row.
7. Persist validation issues.
8. Synchronize valid records into PostgreSQL.
9. Create or update the corresponding flight reminders.
10. Record relevant audit events.

Current sync behavior:

- A row containing only `Nil` values is treated as the first ARRAYFORMULA-generated tail row.
- The first `Nil`-only row and every row after it are excluded from sync, UI display, and empty-row counts.
- Cancelled rows are skipped and counted separately.
- Placeholder-only optional values such as `Nil`, `—`, `N/A`, and `-` do not abort synchronization.
- The latest verified run read 39 real rows, synchronized 37, skipped 2 cancelled rows, and created no duplicate reminders.
- `Flight Status` is the cancellation source; `Reminder Status` does not override database idempotency during sync.

A traveller is upserted using its unique email.

A flight is upserted using its unique `sheetRow`.

---

## 10. Data Validation & Data Quality

Google Sheets data must be validated across the **entire Sheet during every synchronization**, regardless of how far away the flight departure date is.

A flight being five months away does not exempt its data from validation.

### Validation Principles

- Validate the entire Sheet, not only upcoming flights.
- Validate every relevant field before synchronization.
- Detect missing, malformed, inconsistent, or logically suspicious data.
- Do not silently correct potentially erroneous user-entered data.
- Preserve the original Sheet value when reporting an issue.
- Validation operates independently of the reminder scheduler.
- Data-entry problems should be detected as soon as the synchronization cycle sees them.

### Required/Expected Validation

The system should validate:

- Traveller name
- Location where applicable
- Origin
- Destination
- Departure date
- Departure time
- Arrival date
- Arrival time
- Layover city
- Layover beginning
- Layover ending
- Layover duration
- Email address
- Reminder-date discrepancies where applicable

### Date Validation

Detect:

- invalid calendar dates
- malformed dates
- missing required dates
- arrival before departure
- other logically inconsistent date relationships

Overnight flights are valid when the arrival date is later than the departure date.

### Time Validation

The operational Sheet uses 24-hour time.

Valid examples:

```text
00:00
01:25
06:05
13:25
21:20
23:59
```

Invalid examples:

```text
25:30
12:75
24:15
```

Ambiguous 12-hour formats such as:

```text
6:05 PM
2:30 pm
```

should be flagged rather than silently interpreted.

### Logical Flight Validation

Examples:

```text
Departure: 10 August 2026 21:20
Arrival:   10 August 2026 16:15
```

should be flagged because arrival occurs before departure on the same date.

However:

```text
Departure: 9 September 2026 21:15
Arrival:   10 September 2026 09:55
```

is a valid overnight relationship.

### Layover Validation

Validate:

- presence/absence consistency
- layover start/end times
- layover duration
- logical consistency between the values

Where a layover appears to cross midnight but no layover date is supplied, the system should flag the ambiguity rather than silently guessing.

Where determinable, calculated layover duration should be compared with the Sheet's stated duration.

### Email Validation

Detect malformed or incomplete email addresses.

Do not silently modify an email address.

### Duplicate Detection

Detect suspicious duplicate flight records while allowing legitimate multiple flights for the same traveller.

A traveller having multiple different flights is normal.

---

## 11. Validation Severity

Use three validation levels:

### INFO

Informational observation.

- Does not block synchronization.
- Displayed where useful.

### WARNING

Potential problem requiring review.

- Display on dashboard.
- Does not necessarily prevent synchronization unless the affected data is unsafe for reminder processing.

### ERROR

Data is unsafe or invalid for reminder processing.

- Display on dashboard.
- Prevent the affected flight/reminders from being created or updated until the issue is corrected.

---

## 12. Validation Issues Dashboard

Data-validation issues must be surfaced on the application dashboard.

The dashboard should provide:

- Number of open validation issues.
- Issues grouped by severity.
- Google Sheet row number.
- Traveller name where available.
- Affected field.
- Original Sheet value.
- Validation code.
- Human-readable validation message.
- Detection time.
- Resolution status.
- Ability to identify the Sheet row requiring correction.

### Validation Email Policy

**Data-validation issues must NOT automatically generate email notifications to the administrator or developer.**

The dashboard is the primary mechanism for reviewing and resolving data-entry issues.

Operational email notifications remain separate and are reserved for explicitly defined operational events, such as:

- reminder failures
- successful client reminder confirmation
- administrator reminder emails

---

## 13. Validation Issue Persistence

Validation issues should be stored in PostgreSQL.

This allows the system to:

- Prevent the same unchanged error from creating duplicate issues.
- Track when an issue was first detected.
- Track subsequent observations.
- Mark an issue as resolved after the Sheet data is corrected.
- Maintain historical validation information.
- Display current open issues on the dashboard.

Validation issues should use a deterministic identity/fingerprint based on information such as:

```text
Sheet row
Field
Validation code
Relevant value/content
```

The synchronization process must not create duplicate validation issues simply because it runs repeatedly.

---

## 14. Reminder Processing

Reminder processing must be independent of Google Sheet validation.

Recommended processing frequency:

```text
Every 1–5 minutes
```

The worker should identify reminders whose scheduled time has arrived within the configured processing tolerance/window.

Reminder processing must be deterministic and database-backed.

Current implementation:

- `lib/reminder-processing.ts` selects due `PENDING` reminders and retryable `FAILED` reminders.
- Reminders are conditionally claimed as `PROCESSING` before sending.
- Failed sends receive capped exponential retry timing through `nextAttemptAt`.
- `scripts/process-reminders.ts` runs one processing cycle and reports claimed, sent, and failed totals.
- Stale `PROCESSING` claims are recovered after ten minutes.
- Cancelled Sheet flights become `SKIPPED` before any email is sent.
- Successful, failed, and skipped processing writes the reminder type/status back to the Sheet.
- Production scheduling is configured through Vercel Cron at `/api/cron/reminders` every five minutes.

AI must not control critical reminder timing or scheduling decisions.

---

## 15. Reliability and Idempotency

The system must prevent duplicate emails even when:

- a worker retries
- a process crashes
- a request is repeated
- the same Sheet data is synchronized multiple times
- a reminder is processed more than once

Use database constraints and idempotency mechanisms rather than relying solely on status checks.

Failed sends should support controlled retries with exponential backoff.

---

## 16. Audit Logging

Important system actions should be recorded in the audit log.

Current event categories include:

```text
TRAVELLER_CREATED
TRAVELLER_UPDATED

FLIGHT_CREATED
FLIGHT_UPDATED

REMINDER_CREATED

ADMIN_REMINDER_DUE
ADMIN_REMINDER_SENT

CLIENT_REMINDER_DUE
CLIENT_REMINDER_SENT

ADMIN_CONFIRMATION_SENT

REMINDER_FAILED
REMINDER_RETRY_SCHEDULED
REMINDER_CANCELLED
```

Validation issues should have their own persistence mechanism and should not be conflated with reminder audit events.

---

## 17. Dashboard

The dashboard should provide switchable views for:

### Travellers

Display relevant traveller/flight information such as:

- Traveller name
- Flight
- Origin
- Destination
- Departure
- Reminder status
- Client reminder status
- Admin reminder status

Include:

- Search
- Filtering
- Status indicators

### Google Sheets source

- The raw Sheet table is rendered before summary metrics or computed flight views.
- Headers and cells are displayed in the live Sheet order.
- Search operates across raw Sheet row values.
- Empty and cancelled row counts are displayed above the table.

### Upcoming reminder

The dashboard displays the next reminder eligible for processing:

- `PENDING` reminders use `scheduledFor`.
- Retryable `FAILED` reminders use `nextAttemptAt`.
- The panel shows process time, scheduled time, reminder type and status, attempts, reminder ID, traveller, email, route, Sheet row, and the latest error.

### Validation Issues

Display:

- Open issues
- Severity
- Sheet row
- Traveller
- Field
- Original value
- Error/warning message
- Detection time
- Resolution state

### Audit Logs

Display:

- Timestamp
- Traveller
- Event
- Result
- Relevant reminder/flight information

---

## 18. Recommended Operational Features

Where useful, the system should support:

- Test Email
- Preview Email
- Dry Run
- Health Check
- Structured Logging
- Retry visibility
- Reminder processing visibility
- Synchronization status

---

## 19. Development Workflow

Each meaningful milestone should:

1. Be developed and tested locally.
2. Be committed to Git using a meaningful conventional commit.
3. Be pushed to GitHub.
4. Be submitted as a Pull Request where applicable.
5. Be reviewed and corrected where necessary.
6. Be merged into `main`.

Meaningful commit prefixes:

```text
feat:
fix:
refactor:
test:
docs:
build:
ci:
perf:
```

---

## 20. Current Git State

Current branch:

```text
main
```

Working tree:

```text
clean
```

Current commits:

```text
17e2357 fix: use flight sheet rows as sync identifiers
ac9944c feat: add flight reminder database schema
8d5c8f8 chore: add PostgreSQL Docker foundation
fa27fc2 chore: initialize flight reminder system
```

---

## 21. Completed Milestones

### Milestone 1 — Project Foundation

Completed:

- Next.js project initialized
- TypeScript configured
- ESLint configured
- Tailwind CSS configured
- App Router configured
- Initial project documentation created

### Milestone 2 — Docker + PostgreSQL Foundation

Completed:

- PostgreSQL Docker container configured
- Docker Compose configured
- PostgreSQL health check configured
- Local database established

### Milestone 3 — Database Schema

Completed:

- Traveller model
- Flight model
- Reminder model
- AuditLog model
- Reminder status lifecycle
- Reminder type separation
- Database migrations
- Migration integrity verification

### Milestone 3b — Flight Reminder Architecture Correction

Completed:

- Added `ADMIN` and `CLIENT` reminder types.
- Changed flights to support multiple reminders.
- Added unique `(flightId, type)` constraint.
- Removed traveller `sheetRow` as a unique identifier.
- Made `Flight.sheetRow` the unique Sheet-row identifier.
- Added deterministic reminder architecture for 48-hour and 24-hour reminders.

### Google Sheets Foundation

Completed:

- Google Sheets API installed.
- Google Cloud service account configured.
- Service-account impersonation configured for local development.
- Google Sheet shared with the service account.
- Google Sheets API successfully reading the configured Sheet.
- Header-based mapping implemented.
- Additional Sheet columns can exist without breaking the required application mapping.

---

## 22. End-to-End Project Todo Status

This checklist tracks the project from initial setup through production deployment.

Status meanings:

- **DONE** — implemented and verified in the repository.
- **IN PROGRESS** — partially implemented or functional, but not complete.
- **NOT STARTED** — no usable implementation exists yet.

### Phase 1 — Project Foundation

- [x] **DONE** — Initialize the Next.js application with the App Router.
- [x] **DONE** — Configure TypeScript.
- [x] **DONE** — Configure ESLint.
- [x] **DONE** — Configure Tailwind CSS.
- [x] **DONE** — Establish the root-level `app/` and `lib/` project structure.
- [x] **DONE** — Add initial project documentation and environment configuration structure.

### Phase 2 — Local Infrastructure

- [x] **DONE** — Add Docker Compose configuration for PostgreSQL.
- [x] **DONE** — Configure PostgreSQL credentials, database name, persistent volume, and health check.
- [x] **DONE** — Create the local PostgreSQL development foundation.
- [ ] **NOT STARTED** — Document and verify the complete local start-up workflow.

### Phase 3 — Database and Domain Model

- [x] **DONE** — Define Traveller, Flight, Reminder, and AuditLog models.
- [x] **DONE** — Add reminder types for ADMIN and CLIENT reminders.
- [x] **DONE** — Add reminder lifecycle statuses.
- [x] **DONE** — Add `SKIPPED` as a terminal reminder state for cancelled flights.
- [x] **DONE** — Enforce unique traveller email addresses.
- [x] **DONE** — Use the Google Sheet row as the unique flight source identifier.
- [x] **DONE** — Enforce one ADMIN and one CLIENT reminder per flight.
- [x] **DONE** — Add database migrations and generated contract artifacts.
- [x] **DONE** — Verify migration integrity.
- [x] **DONE** — Add the Prisma 8 application database runtime client.
- [ ] **IN PROGRESS** — Add the remaining repository/data-access layer for broader application queries; synchronization data access is functional.

### Phase 4 — Google Sheets Integration

- [x] **DONE** — Install and configure the Google Sheets API client.
- [x] **DONE** — Configure local Google authentication and service-account impersonation.
- [x] **DONE** — Read the configured Google Sheet.
- [x] **DONE** — Map rows by header names instead of fixed column positions.
- [x] **DONE** — Preserve physical Google Sheet row numbers.
- [x] **DONE** — Normalize incoming Sheet values.
- [x] **DONE** — Allow additional Sheet columns without breaking application mapping.
- [x] **DONE** — Implement the one-shot Google Sheets synchronization service.
- [x] **DONE** — Upsert travellers by email during synchronization.
- [x] **DONE** — Upsert flights by Sheet row during synchronization.
- [x] **DONE** — Create or update ADMIN and CLIENT reminders during synchronization.
- [x] **DONE** — Record traveller, flight, and reminder synchronization audit events.
- [x] **DONE** — Stop at the first ARRAYFORMULA-generated `Nil`-only row and exclude the generated tail from counts.
- [x] **DONE** — Skip and count cancelled rows without parsing their flight values.
- [x] **DONE** — Read separate `Flight Status` and `Reminder Status` columns.
- [x] **DONE** — Write reminder processing status back to Google Sheets.

### Phase 5 — Validation and Data Quality

- [x] **DONE** — Validate required Sheet headers.
- [x] **DONE** — Validate the complete set of fetched rows through the validation scripts.
- [x] **DONE** — Validate names, email addresses, dates, times, routes, arrival ordering, and layovers.
- [x] **DONE** — Detect duplicate flight rows.
- [x] **DONE** — Generate validation severity, code, message, field, value, and Sheet row information.
- [x] **DONE** — Use deterministic validation fingerprints.
- [x] **DONE** — Support 12-hour `h:mm AM/PM` time parsing and conversion.
- [ ] **IN PROGRESS** — Align the remaining project documentation with the current 12-hour time format.
- [x] **DONE** — Persist validation issues in PostgreSQL.
- [x] **DONE** — Prevent unchanged validation issues from being duplicated across runs by fingerprint.
- [x] **DONE** — Mark corrected validation issues as resolved.
- [x] **DONE** — Keep validation persistence functional in scripts and expose open issues in the dashboard.
- [ ] **NOT STARTED** — Compare manually entered reminder dates with calculated reminder dates.

### Phase 6 — Reminder Calculation and Processing

- [x] **DONE** — Calculate ADMIN reminders exactly 48 hours before departure.
- [x] **DONE** — Calculate CLIENT reminders exactly 24 hours before departure.
- [x] **DONE** — Create deterministic reminder identifiers.
- [x] **DONE** — Implement due-reminder selection for pending and retryable failed reminders.
- [x] **DONE** — Implement PROCESSING, SENT, and FAILED reminder state transitions.
- [x] **DONE** — Implement controlled retries with capped exponential backoff.
- [x] **DONE** — Prevent concurrent duplicate claims with conditional database updates.
- [ ] **IN PROGRESS** — Complete reminder cancellation and failure handling policy.
- [x] **DONE** — Connect the worker to the Resend email API through an injected sender.
- [x] **DONE** — Expose the next pending or retryable reminder in the dashboard with processing details.
- [x] **DONE** — Recover stale `PROCESSING` claims and retry them safely.
- [x] **DONE** — Check live Sheet flight status before claiming or sending a reminder.

### Phase 7 — Email and Operational Notifications

- [x] **DONE** — Select Resend as the transactional email provider.
- [x] **DONE** — Implement traveller reminder email content.
- [x] **DONE** — CC the configured administrators on traveller reminders.
- [x] **DONE** — Implement the 48-hour administrator reminder email.
- [x] **DONE** — Send administrator confirmation after a traveller reminder succeeds.
- [x] **DONE** — Store the provider message ID on successful delivery.
- [x] **DONE** — Keep validation issues out of automatic email notifications.
- [ ] **IN PROGRESS** — Configure a verified Resend sender/domain and production credentials before real automatic sending.
- [x] **DONE** — Provide the one-cycle `pnpm process:reminders` command for controlled email processing.
- [x] **DONE** — Add an authenticated Vercel Cron route for five-minute processing.

### Phase 8 — Audit Logging

- [ ] **IN PROGRESS** — Persist traveller, flight, reminder, notification, failure, retry, and cancellation events; the current worker persists the main due, sent, and failure events, while retry and cancellation coverage remains incomplete.
- [x] **DONE** — Add audit-log query/data-access functions for the dashboard.
- [x] **DONE** — Display operational history to application users.

### Phase 9 — Dashboard and Application UI

- [x] **DONE** — Replace the default Next.js starter page with the application dashboard.
- [x] **DONE** — Add the travellers and flights view.
- [x] **DONE** — Add search, filtering, and reminder status indicators.
- [x] **DONE** — Add the validation issues view.
- [x] **DONE** — Add severity, Sheet row, field, original value, message, and resolution state to issue display.
- [x] **DONE** — Add the audit logs view.
- [x] **DONE** — Render the live Google Sheet headers and raw rows as the primary source view.
- [x] **DONE** — Display empty and cancelled Sheet row counts.
- [x] **DONE** — Display the next pending or retryable reminder in detail.
- [ ] **IN PROGRESS** — Add synchronization, reminder-processing, and health status visibility beyond the upcoming reminder panel.

### Phase 10 — Background Jobs and Operations

- [ ] **NOT STARTED** — Implement recurring Google Sheet synchronization.
- [x] **DONE** — Configure recurring reminder processing every five minutes through Vercel Cron.
- [ ] **NOT STARTED** — Add structured application logging.
- [ ] **NOT STARTED** — Add health checks for the application, database, Google Sheets, and email provider.
- [ ] **NOT STARTED** — Add test email, preview email, and dry-run operational tools.

### Phase 11 — Testing and Delivery Workflow

- [x] **DONE** — Add basic Google Sheets and validation test scripts.
- [x] **DONE** — Run the validation script against the live Sheet and PostgreSQL locally.
- [ ] **NOT STARTED** — Add automated unit tests for parsers, validators, reminder calculations, and idempotency.
- [ ] **NOT STARTED** — Add integration tests for synchronization, database writes, and notification processing.
- [ ] **NOT STARTED** — Add end-to-end dashboard tests.
- [ ] **NOT STARTED** — Add CI checks for linting, typechecking, tests, migrations, and builds.
- [ ] **NOT STARTED** — Establish the documented commit, push, pull-request, review, and merge workflow.

### Phase 12 — Production Deployment

- [x] **DONE** — Define a Docker-based PostgreSQL foundation for local and production-oriented development.
- [ ] **NOT STARTED** — Create the production Docker image for the Next.js application.
- [ ] **NOT STARTED** — Configure production environment variables and secret management.
- [ ] **NOT STARTED** — Provision production PostgreSQL.
- [ ] **NOT STARTED** — Configure production Google Sheets authentication without storing service-account keys in the repository.
- [ ] **NOT STARTED** — Configure the production email provider and sender identity.
- [ ] **NOT STARTED** — Deploy the application and background workers.
- [ ] **NOT STARTED** — Run production migrations safely.
- [ ] **NOT STARTED** — Configure HTTPS, domains, monitoring, backups, and log retention.
- [ ] **NOT STARTED** — Perform a production smoke test and verify reminder delivery.

### Current Overall Position

The project has completed its foundation, database design, Google Sheets read/write layer, one-shot synchronization, core reminder processing, Resend email integration, raw Sheet-first dashboard, upcoming-reminder visibility, and Vercel Cron scheduling. It is currently **IN PROGRESS** at production operationalization. The immediate next step is configuring the listed Vercel environment variables and running a controlled production smoke test. Remaining work includes sender/domain verification, automated delivery checks, dashboard health/synchronization visibility, and production deployment verification.

---

## 22. Current Phase

**Phase 7/10 — Transactional Email and Operational Automation**

---

## 23. Current Milestone

**Milestone 7/8 — Controlled reminder sending, upcoming-reminder visibility, and recurring processing**

Current implementation already includes:

- Google Sheets API connection.
- Raw Sheet retrieval.
- Header validation.
- Header-based row mapping.
- ARRAYFORMULA `Nil`-tail exclusion.
- Cancelled and empty-row counting.
- PostgreSQL-backed reminder calculation and claiming.
- Resend sender and one-cycle reminder processing.
- Dashboard detail for the next pending or retryable reminder.
- Separate `Flight Status` and `Reminder Status` integration.
- `SKIPPED` cancellation state and live Sheet cancellation checks.
- Authenticated five-minute Vercel Cron route.

Next implementation steps:

1. Verify `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_EMAILS`, and `DEVELOPER_EMAILS` with a verified sender/domain.
2. Run `pnpm process:reminders` once in a controlled window and verify Resend delivery, database status, provider ID, and audit events.
3. Deploy and verify the Vercel Cron invocation with a test client and a non-cancelled due reminder.
4. Add automated tests for reminder claiming, retries, idempotency, cancellation, write-back, and email sender behavior.
5. Add synchronization, worker, database, Sheets, and Resend health status to the dashboard.

---

## 24. Future Milestones

### Milestone 5 — Traveller Dashboard

- Traveller/flight table
- Search
- Filtering
- Reminder status
- Validation issue indicators

### Milestone 6 — Audit Logs

- Audit log interface
- Event filtering
- Operational history

### Milestone 7 — Transactional Email Service

- Resend provider selected
- Environment-based credentials and recipients
- Email templates
- Traveller reminder with administrator CC
- Administrator reminder
- Administrator confirmation
- Provider message tracking and developer failure notifications

### Milestone 8 — Reminder Scheduler

- Background worker
- 1–5 minute processing cycle
- Deterministic reminder selection
- Idempotent processing

### Milestone 9 — Reliability and Retry System

- Retry strategy
- Exponential backoff
- Failure handling
- Idempotency
- Provider message tracking

### Milestone 10 — Production Deployment

- Production Docker configuration
- Production database
- Secrets management
- Google Sheets production authentication
- Email provider configuration
- Worker deployment
- Health monitoring
- Logging
- Backup/recovery considerations

---

## 25. Important Implementation Principles

- PostgreSQL is the application's source of truth.
- Google Sheets is the external operational data source.
- Sheet columns must be mapped by header name rather than fixed column position.
- A Google Sheet row represents a flight record, not necessarily a traveller.
- A traveller can have multiple flights.
- Reminder timing is calculated from departure date/time only.
- No airport timezone conversion is performed.
- ADMIN reminders are scheduled 48 hours before departure.
- CLIENT reminders are scheduled 24 hours before departure.
- Data validation runs independently of reminder processing.
- The entire Sheet must be validated during synchronization.
- Validation issues appear on the dashboard and do not automatically generate email notifications.
- Operational email notifications are separate from data-quality warnings.
- Critical scheduling logic must remain deterministic and must not depend on AI.
- Duplicate reminders and duplicate emails must be prevented through database-backed idempotency.
- Failed email operations must support controlled retries.
- Existing valid data must not be silently overwritten with malformed data.
- Potentially erroneous Sheet values should be surfaced for human review rather than silently corrected.
- Every major architectural or business-rule change should be reflected in this `PROJECT_CONTEXT.md`.
- The project should maintain clean, meaningful Git milestones so development can continue safely across sessions.

---

## 26. Chronological File Map

The file lists below follow the order a new contributor should read or change the project. Each phase maps the project steps above to the files that implement them.

### Phase 1 — Project Foundation

1. `package.json` — scripts, dependencies, and package manager.
2. `tsconfig.json` — TypeScript configuration.
3. `next.config.ts` — Next.js configuration.
4. `app/layout.tsx` — root layout and metadata.
5. `app/globals.css` — global design tokens and application styling.
6. `app/page.tsx` — root server-rendered page entry point.

### Phase 2 — Local Infrastructure

1. `docker-compose.yml` — PostgreSQL service, health check, and persistence.
2. `.env` — local runtime configuration; never commit secrets.
3. `README.md` — local setup and command documentation.
4. `prisma.config.ts` — Prisma 8 contract and database configuration.

### Phase 3 — Database and Domain Model

1. `prisma/contract.prisma` — Traveller, Flight, Reminder, AuditLog, enums, and constraints.
2. `prisma/contract.json` — generated contract artifact.
3. `prisma/contract.d.ts` — generated query types.
4. `migrations/app/*/migration.ts` — applied database changes in chronological directory order.
5. `lib/db.ts` — Prisma 8 PostgreSQL runtime connection.

### Phase 4 — Google Sheets Integration and Synchronization

1. `lib/google-sheets.ts` — authenticated Sheet retrieval.
2. `lib/google-sheets/mapping.ts` — live header definitions, raw mapping, empty/cancelled classification, and `Nil` ARRAYFORMULA boundary.
3. `lib/google-sheets/normalize.ts` — header-based normalization of names, dates, times, layovers, and email.
4. `lib/google-sheets/date-time.ts` — Sheet date/time parsing.
5. `lib/sync-google-sheet.ts` — traveller, flight, reminder upserts and synchronization audit events.
6. `scripts/sync-sheet.ts` — one-shot synchronization command and row summary.

### Phase 5 — Validation and Data Quality

1. `lib/google-sheets/validation/*` — field, date/time, route, layover, duplicate, and email validation rules.
2. `prisma/contract.prisma` — validation issue model and indexes when schema changes are required.
3. `migrations/app/*/migration.ts` — validation persistence migrations in chronological order.
4. `lib/dashboard.ts` — server-side retrieval of validation and operational data.
5. `app/dashboard-client.tsx` — validation issue presentation and filtering.
6. `scripts/test-google-sheets.ts` — live Sheet validation checks.

### Phase 6 — Reminder Calculation and Processing

1. `lib/sync-google-sheet.ts` — deterministic `ADMIN - 48 hours` and `CLIENT - 24 hours` schedule creation.
2. `lib/reminder-processing.ts` — due selection, conditional claiming, sending, retries, and status transitions.
3. `scripts/process-reminders.ts` — one processing cycle and result reporting.
4. `lib/dashboard.ts` — next pending/retryable reminder selection and detail projection.
5. `app/dashboard-client.tsx` — upcoming reminder UI.

### Phase 7 — Email and Operational Notifications

1. `lib/email/resend.ts` — Resend API call, traveller email, administrator reminder, confirmation, and developer failure notification.
2. `.env` — `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_EMAILS`, and `DEVELOPER_EMAILS`.
3. `scripts/process-reminders.ts` — controlled invocation of real email sending.
4. `lib/reminder-processing.ts` — persistence of provider message IDs and send/failure audit events.

### Phase 7b — Vercel Cron Automation

1. `app/api/cron/reminders/route.ts` — authenticated production processing endpoint.
2. `vercel.json` — five-minute Vercel Cron schedule.
3. `.env.example` — `CRON_SECRET` and the complete environment contract.
4. `README.md` — Vercel environment and Google Sheets write-access setup.

### Phase 8 — Audit Logging

1. `prisma/contract.prisma` — AuditLog model and event enum.
2. `lib/sync-google-sheet.ts` — sync audit events.
3. `lib/reminder-processing.ts` — due, sent, and failed reminder audit events.
4. `lib/dashboard.ts` — audit log query and serialization.
5. `app/dashboard-client.tsx` — audit log view.

### Phase 9 — Dashboard and Application UI

1. `app/page.tsx` — dynamic dashboard data loading.
2. `lib/dashboard.ts` — raw Sheet snapshot, counts, flights, audits, and upcoming reminder.
3. `app/dashboard-client.tsx` — Sheet-first table, upcoming reminder detail, metrics, traveller view, and audit view.
4. `app/globals.css` — responsive tables, reminder panel, metrics, statuses, and mobile layout.

### Phase 10 — Background Jobs and Operations

1. `scripts/sync-sheet.ts` — synchronization worker entry point.
2. `scripts/process-reminders.ts` — reminder worker entry point.
3. `app/api/cron/reminders/route.ts` — Vercel Cron invocation and failure response.
4. `vercel.json` — recurring schedule.
5. `docker-compose.yml` — future local worker/scheduler service wiring.
6. `README.md` — recurring command and deployment instructions.
7. `lib/dashboard.ts` — future health and last-run status query.

### Phase 11 — Testing and Delivery Workflow

1. `scripts/test-google-sheets.ts` — current live integration check.
2. `package.json` — test, lint, build, and CI scripts.
3. `app/*` and `lib/*` — focused unit/integration test targets to add.
4. `.github/workflows/*` — CI workflow to add.
5. `PROJECT_CONTEXT.md` — milestone and workflow record.

### Phase 12 — Production Deployment

1. `Dockerfile` — production application image to add.
2. `docker-compose.yml` — production-oriented service composition.
3. `next.config.ts` — production build/runtime configuration.
4. `.env.example` — documented non-secret environment contract to add.
5. `prisma.config.ts` and `migrations/app/*` — production migration execution.
6. `README.md` — deployment, secrets, HTTPS, monitoring, and rollback instructions.
