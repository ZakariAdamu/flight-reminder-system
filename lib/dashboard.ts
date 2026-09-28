import { db } from "./db";

function serializeDate(value: unknown): string {
	return String(value);
}

export async function getDashboardData() {
	const [flights, validationIssues, auditLogs] = await Promise.all([
		db.orm.public.Flight.include("traveller")
			.include("reminders", (reminder) =>
				reminder.orderBy((item) => item.type.asc()),
			)
			.orderBy((flight) => flight.departureAt.asc())
			.limit(200)
			.all(),
		db.orm.public.ValidationIssue.where((issue) => issue.resolvedAt.isNull())
			.orderBy((issue) => issue.firstSeenAt.desc())
			.limit(200)
			.all(),
		db.orm.public.AuditLog.include("traveller")
			.include("reminder")
			.orderBy((log) => log.createdAt.desc())
			.limit(100)
			.all(),
	]);

	return {
		flights: flights.map((flight) => ({
			id: flight.id,
			sheetRow: flight.sheetRow,
			origin: flight.origin,
			destination: flight.destination,
			departureAt: serializeDate(flight.departureAt),
			traveller: {
				name: flight.traveller.name,
				email: flight.traveller.email,
				location: flight.traveller.location,
			},
			reminders: flight.reminders.map((reminder) => ({
				type: reminder.type,
				status: reminder.status,
				scheduledFor: serializeDate(reminder.scheduledFor),
				sentAt: reminder.sentAt ? serializeDate(reminder.sentAt) : null,
				nextAttemptAt: reminder.nextAttemptAt
					? serializeDate(reminder.nextAttemptAt)
					: null,
				errorMessage: reminder.errorMessage,
			})),
		})),
		validationIssues: validationIssues.map((issue) => ({
			id: issue.id,
			sheetRow: issue.sheetRow,
			field: issue.field,
			code: issue.code,
			severity: issue.severity,
			value: issue.value,
			message: issue.message,
			firstSeenAt: serializeDate(issue.firstSeenAt),
		})),
		auditLogs: auditLogs.map((log) => ({
			id: log.id,
			eventType: log.eventType,
			message: log.message,
			createdAt: serializeDate(log.createdAt),
			travellerName: log.traveller?.name ?? null,
			reminderType: log.reminder?.type ?? null,
		})),
	};
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
