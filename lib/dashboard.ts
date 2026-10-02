import { db, ensureDatabaseConnection } from "./db";
import { getSheetValues } from "./google-sheets";
import {
	isCancelledSheetRow,
	isEmptySheetRow,
	isNilOnlySheetRow,
	rowsToRecords,
} from "./google-sheets/mapping";

function serializeDate(value: unknown): string {
	return String(value);
}

function reminderProcessTime(reminder: {
	status: string;
	nextAttemptAt: unknown;
	scheduledFor: unknown;
}): number {
	const value =
		reminder.status === "FAILED" && reminder.nextAttemptAt
			? reminder.nextAttemptAt
			: reminder.scheduledFor;

	return new Date(String(value)).getTime();
}

export async function getDashboardData() {
	await ensureDatabaseConnection();

	const [flights, auditLogs, sheetValues] = await Promise.all([
		db.orm.public.Flight.include("traveller")
			.include("reminders", (reminder) =>
				reminder.orderBy((item) => item.type.asc()),
			)
			.orderBy((flight) => flight.departureAt.asc())
			.limit(200)
			.all(),
		db.orm.public.AuditLog.include("traveller")
			.include("reminder")
			.orderBy((log) => log.createdAt.desc())
			.limit(100)
			.all(),
		getSheetValues(),
	]);

	const [pendingReminders, retryableReminders] = await Promise.all([
		db.orm.public.Reminder.where({ status: "PENDING" }).limit(100).all(),
		db.orm.public.Reminder.where({ status: "FAILED" })
			.where((reminder) => reminder.nextAttemptAt.isNotNull())
			.limit(100)
			.all(),
	]);
	const nextReminder = [...pendingReminders, ...retryableReminders].sort(
		(first, second) => reminderProcessTime(first) - reminderProcessTime(second),
	)[0];
	const nextReminderFlight = nextReminder
		? await db.orm.public.Flight.first({ id: nextReminder.flightId })
		: null;
	const nextReminderTraveller = nextReminderFlight
		? await db.orm.public.Traveller.first({
				id: nextReminderFlight.travellerId,
			})
		: null;

	const [sheetHeaders = [], ...allSheetRows] = sheetValues;
	const nilBoundary = allSheetRows.findIndex(isNilOnlySheetRow);
	const sheetRows =
		nilBoundary === -1 ? allSheetRows : allSheetRows.slice(0, nilBoundary);
	const sheetRecords = rowsToRecords(sheetHeaders, sheetRows);
	const sheetRowsForDisplay = sheetRows.map((row) =>
		sheetHeaders.map((_, index) => String(row[index] ?? "")),
	);

	return {
		sheet: {
			headers: sheetHeaders,
			rows: sheetRowsForDisplay,
			emptyRows: sheetRows.filter(isEmptySheetRow).length,
			cancelledRows: sheetRecords.filter(isCancelledSheetRow).length,
		},
		upcomingReminder:
			nextReminder && nextReminderFlight && nextReminderTraveller
				? {
						id: nextReminder.id,
						reminderId: nextReminder.reminderId,
						type: nextReminder.type,
						status: nextReminder.status,
						attemptCount: nextReminder.attemptCount,
						scheduledFor: serializeDate(nextReminder.scheduledFor),
						nextAttemptAt: nextReminder.nextAttemptAt
							? serializeDate(nextReminder.nextAttemptAt)
							: null,
						errorMessage: nextReminder.errorMessage,
						processAt: serializeDate(
							nextReminder.status === "FAILED" && nextReminder.nextAttemptAt
								? nextReminder.nextAttemptAt
								: nextReminder.scheduledFor,
						),
						traveller: {
							name: nextReminderTraveller.name,
							email: nextReminderTraveller.email,
							location: nextReminderTraveller.location,
						},
						flight: {
							origin: nextReminderFlight.origin,
							destination: nextReminderFlight.destination,
							departureAt: serializeDate(nextReminderFlight.departureAt),
							arrivalAt: nextReminderFlight.arrivalAt
								? serializeDate(nextReminderFlight.arrivalAt)
								: null,
							sheetRow: nextReminderFlight.sheetRow,
						},
					}
				: null,
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
