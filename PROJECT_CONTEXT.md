# Flight Reminder System

## 1. Project Overview

A full-stack flight reminder and traveller notification management system.

The system will:

* Synchronize traveller and flight data from Google Sheets.
* Validate the entire Google Sheet during synchronization.
* Display traveller records and data-validation issues in a web dashboard.
* Store application state and operational data in PostgreSQL.
* Calculate reminder times automatically from flight departure date/time.
* Send personalized flight reminders to travellers.
* CC two administrators on traveller reminder emails.
* Send an administrator reminder exactly 48 hours before flight departure.
* Send the traveller reminder exactly 24 hours before flight departure.
* Notify administrators after a traveller reminder has been successfully sent.
* Maintain detailed audit logs.
* Prevent duplicate notifications through database-backed idempotency.
* Retry failed notification attempts using controlled retry logic.
* Detect and surface Google Sheets data-entry problems early.
* Run recurring synchronization and reminder-processing jobs.
* Run using Docker in the production environment.

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

The application may compare the Sheet's manually entered reminder values against its calculated values and surface discrepancies as data-validation issues.

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
```

Reminder records should support:

* `sentAt`
* `failedAt`
* `errorMessage`
* `attemptCount`
* `providerMessageId`
* `nextAttemptAt`

---

## 3. Data Architecture

```text
Google Sheets
      │
      ▼
Fetch entire sheet
      │
      ▼
Header validation
      │
      ▼
Row normalization
      │
      ▼
Full-sheet data validation
      │
      ├───────────────┐
      ▼               ▼
Validation issues   Valid records
      │               │
      ▼               ▼
PostgreSQL          PostgreSQL sync
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

* Traveller records
* Flight records
* Reminder records
* Reminder state
* Audit logs
* Validation issues
* Notification processing state

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

* Next.js
* React
* TypeScript
* Tailwind CSS

### Backend

* Next.js server-side functionality
* PostgreSQL
* Prisma 8
* Background processing/scheduling to be implemented

### Infrastructure

* Docker
* Docker Compose

### External Services

* Google Sheets API
* Transactional email provider — to be selected

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

* UUID primary key
* name
* location
* unique email
* created/updated timestamps
* flights
* audit logs

### Flight

Contains:

* UUID primary key
* traveller relationship
* origin
* destination
* departure date/time
* arrival date/time
* layover city
* layover beginning
* layover ending
* layover duration
* unique Google Sheet row
* created/updated timestamps
* reminders

### Reminder

Contains:

* UUID primary key
* unique `reminderId`
* flight relationship
* reminder type
* scheduled time
* status
* attempt count
* sent/failed timestamps
* retry time
* error information
* provider message ID
* created/updated timestamps

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

* travellers
* flights
* reminders
* notification processing
* failures
* retries
* cancellations

---

## 8. Google Sheets Integration

The operational Google Sheet currently contains columns A–T.

Important application fields include:

```text
SN
NAMES OF CLIENTS
location
Origin
Destination
Departure Date
Departure Time
Arrival Date
Arrival Time
Layover City
Layover Begins
Layover Ends
Layover Duration
Email Address
```

Additional Sheet columns currently include:

```text
TIME
24 hrs reminder date
48hr Reminder Date
Booked Dates
Status
Notes
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

* required-header definitions
* header validation
* raw row-to-record mapping

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

A traveller is upserted using its unique email.

A flight is upserted using its unique `sheetRow`.

---

## 10. Data Validation & Data Quality

Google Sheets data must be validated across the **entire Sheet during every synchronization**, regardless of how far away the flight departure date is.

A flight being five months away does not exempt its data from validation.

### Validation Principles

* Validate the entire Sheet, not only upcoming flights.
* Validate every relevant field before synchronization.
* Detect missing, malformed, inconsistent, or logically suspicious data.
* Do not silently correct potentially erroneous user-entered data.
* Preserve the original Sheet value when reporting an issue.
* Validation operates independently of the reminder scheduler.
* Data-entry problems should be detected as soon as the synchronization cycle sees them.

### Required/Expected Validation

The system should validate:

* Traveller name
* Location where applicable
* Origin
* Destination
* Departure date
* Departure time
* Arrival date
* Arrival time
* Layover city
* Layover beginning
* Layover ending
* Layover duration
* Email address
* Reminder-date discrepancies where applicable

### Date Validation

Detect:

* invalid calendar dates
* malformed dates
* missing required dates
* arrival before departure
* other logically inconsistent date relationships

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

* presence/absence consistency
* layover start/end times
* layover duration
* logical consistency between the values

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

* Does not block synchronization.
* Displayed where useful.

### WARNING

Potential problem requiring review.

* Display on dashboard.
* Does not necessarily prevent synchronization unless the affected data is unsafe for reminder processing.

### ERROR

Data is unsafe or invalid for reminder processing.

* Display on dashboard.
* Prevent the affected flight/reminders from being created or updated until the issue is corrected.

---

## 12. Validation Issues Dashboard

Data-validation issues must be surfaced on the application dashboard.

The dashboard should provide:

* Number of open validation issues.
* Issues grouped by severity.
* Google Sheet row number.
* Traveller name where available.
* Affected field.
* Original Sheet value.
* Validation code.
* Human-readable validation message.
* Detection time.
* Resolution status.
* Ability to identify the Sheet row requiring correction.

### Validation Email Policy

**Data-validation issues must NOT automatically generate email notifications to the administrator or developer.**

The dashboard is the primary mechanism for reviewing and resolving data-entry issues.

Operational email notifications remain separate and are reserved for explicitly defined operational events, such as:

* reminder failures
* successful client reminder confirmation
* administrator reminder emails

---

## 13. Validation Issue Persistence

Validation issues should be stored in PostgreSQL.

This allows the system to:

* Prevent the same unchanged error from creating duplicate issues.
* Track when an issue was first detected.
* Track subsequent observations.
* Mark an issue as resolved after the Sheet data is corrected.
* Maintain historical validation information.
* Display current open issues on the dashboard.

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

AI must not control critical reminder timing or scheduling decisions.

---

## 15. Reliability and Idempotency

The system must prevent duplicate emails even when:

* a worker retries
* a process crashes
* a request is repeated
* the same Sheet data is synchronized multiple times
* a reminder is processed more than once

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

* Traveller name
* Flight
* Origin
* Destination
* Departure
* Reminder status
* Client reminder status
* Admin reminder status

Include:

* Search
* Filtering
* Status indicators

### Validation Issues

Display:

* Open issues
* Severity
* Sheet row
* Traveller
* Field
* Original value
* Error/warning message
* Detection time
* Resolution state

### Audit Logs

Display:

* Timestamp
* Traveller
* Event
* Result
* Relevant reminder/flight information

---

## 18. Recommended Operational Features

Where useful, the system should support:

* Test Email
* Preview Email
* Dry Run
* Health Check
* Structured Logging
* Retry visibility
* Reminder processing visibility
* Synchronization status

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

* Next.js project initialized
* TypeScript configured
* ESLint configured
* Tailwind CSS configured
* App Router configured
* Initial project documentation created

### Milestone 2 — Docker + PostgreSQL Foundation

Completed:

* PostgreSQL Docker container configured
* Docker Compose configured
* PostgreSQL health check configured
* Local database established

### Milestone 3 — Database Schema

Completed:

* Traveller model
* Flight model
* Reminder model
* AuditLog model
* Reminder status lifecycle
* Reminder type separation
* Database migrations
* Migration integrity verification

### Milestone 3b — Flight Reminder Architecture Correction

Completed:

* Added `ADMIN` and `CLIENT` reminder types.
* Changed flights to support multiple reminders.
* Added unique `(flightId, type)` constraint.
* Removed traveller `sheetRow` as a unique identifier.
* Made `Flight.sheetRow` the unique Sheet-row identifier.
* Added deterministic reminder architecture for 48-hour and 24-hour reminders.

### Google Sheets Foundation

Completed:

* Google Sheets API installed.
* Google Cloud service account configured.
* Service-account impersonation configured for local development.
* Google Sheet shared with the service account.
* Google Sheets API successfully reading the configured Sheet.
* Header-based mapping implemented.
* Additional Sheet columns can exist without breaking the required application mapping.

---

## 22. Current Phase

**Phase 4 — Google Sheets Integration and Data Validation**

---

## 23. Current Milestone

**Milestone 4 — Google Sheets synchronization, normalization, and full-sheet data validation**

Current implementation already includes:

* Google Sheets API connection.
* Raw Sheet retrieval.
* Header validation.
* Header-based row mapping.

Next implementation steps:

1. Build row normalization.
2. Build full-sheet validation.
3. Define validation codes and severity.
4. Add persistent validation issues to PostgreSQL.
5. Test validation against the real `Return_Flights` data.
6. Build valid-record synchronization into PostgreSQL.
7. Create/update Traveller records.
8. Create/update Flight records.
9. Create/update ADMIN and CLIENT reminders.
10. Add synchronization audit events.
11. Build dashboard validation-issue visibility.

---

## 24. Future Milestones

### Milestone 5 — Traveller Dashboard

* Traveller/flight table
* Search
* Filtering
* Reminder status
* Validation issue indicators

### Milestone 6 — Audit Logs

* Audit log interface
* Event filtering
* Operational history

### Milestone 7 — Transactional Email Service

* Select production email provider
* Email templates
* Traveller reminder
* Administrator reminder
* Administrator confirmation
* Delivery/error handling

### Milestone 8 — Reminder Scheduler

* Background worker
* 1–5 minute processing cycle
* Deterministic reminder selection
* Idempotent processing

### Milestone 9 — Reliability and Retry System

* Retry strategy
* Exponential backoff
* Failure handling
* Idempotency
* Provider message tracking

### Milestone 10 — Production Deployment

* Production Docker configuration
* Production database
* Secrets management
* Google Sheets production authentication
* Email provider configuration
* Worker deployment
* Health monitoring
* Logging
* Backup/recovery considerations

---

## 25. Important Implementation Principles

* PostgreSQL is the application's source of truth.
* Google Sheets is the external operational data source.
* Sheet columns must be mapped by header name rather than fixed column position.
* A Google Sheet row represents a flight record, not necessarily a traveller.
* A traveller can have multiple flights.
* Reminder timing is calculated from departure date/time only.
* No airport timezone conversion is performed.
* ADMIN reminders are scheduled 48 hours before departure.
* CLIENT reminders are scheduled 24 hours before departure.
* Data validation runs independently of reminder processing.
* The entire Sheet must be validated during synchronization.
* Validation issues appear on the dashboard and do not automatically generate email notifications.
* Operational email notifications are separate from data-quality warnings.
* Critical scheduling logic must remain deterministic and must not depend on AI.
* Duplicate reminders and duplicate emails must be prevented through database-backed idempotency.
* Failed email operations must support controlled retries.
* Existing valid data must not be silently overwritten with malformed data.
* Potentially erroneous Sheet values should be surfaced for human review rather than silently corrected.
* Every major architectural or business-rule change should be reflected in this `PROJECT_CONTEXT.md`.
* The project should maintain clean, meaningful Git milestones so development can continue safely across sessions.
