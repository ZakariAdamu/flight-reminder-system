import { db, ensureDatabaseConnection } from "./db";

export type ReminderReportItem = {
	id: string;
	reminderId: string;
	type: "ADMIN" | "CLIENT";
	status: string;
	scheduledFor: string;
	sentAt: string | null;
	nextAttemptAt: string | null;
	travellerName: string;
	travellerEmail: string;
	origin: string;
	destination: string;
	departureAt: string;
	sheetRow: number;
};

export type ReminderWindowReport = {
	windowStart: string;
	windowEnd: string;
	total: number;
	byStatus: Record<string, number>;
	byType: { ADMIN: number; CLIENT: number };
	reminders: ReminderReportItem[];
};

async function loadReportFlights() {
	return db.orm.public.Flight.include("traveller")
		.include("reminders", (reminder) =>
			reminder.orderBy((item) => item.scheduledFor.asc()),
		)
		.orderBy((flight) => flight.departureAt.asc())
		.all();
}

type ReportFlight = Awaited<ReturnType<typeof loadReportFlights>>[number];

function serializeDate(value: unknown): string {
	return String(value);
}

function toReportItem(
	flight: ReportFlight,
	reminder: ReportFlight["reminders"][number],
): ReminderReportItem {
	return {
		id: reminder.id,
		reminderId: reminder.reminderId,
		type: reminder.type,
		status: reminder.status,
		scheduledFor: serializeDate(reminder.scheduledFor),
		sentAt: reminder.sentAt ? serializeDate(reminder.sentAt) : null,
		nextAttemptAt: reminder.nextAttemptAt
			? serializeDate(reminder.nextAttemptAt)
			: null,
		travellerName: flight.traveller.name,
		travellerEmail: flight.traveller.email,
		origin: flight.origin,
		destination: flight.destination,
		departureAt: serializeDate(flight.departureAt),
		sheetRow: flight.sheetRow,
	};
}

export function buildReminderWindowReport(
	flights: ReportFlight[],
	windowStart: Date,
	windowEnd: Date,
): ReminderWindowReport {
	const reminders = flights
		.flatMap((flight) =>
			flight.reminders.map((reminder) => ({ flight, reminder })),
		)
		.filter(({ reminder }) => {
			const actionable =
				reminder.status === "PENDING" ||
				(reminder.status === "FAILED" && reminder.nextAttemptAt !== null);
			if (!actionable) {
				return false;
			}

			const scheduledFor = new Date(serializeDate(reminder.scheduledFor));
			return scheduledFor >= windowStart && scheduledFor < windowEnd;
		})
		.sort(
			(first, second) =>
				new Date(serializeDate(first.reminder.scheduledFor)).getTime() -
				new Date(serializeDate(second.reminder.scheduledFor)).getTime(),
		)
		.map(({ flight, reminder }) => toReportItem(flight, reminder));

	const byStatus: Record<string, number> = {};
	const byType = { ADMIN: 0, CLIENT: 0 };

	for (const reminder of reminders) {
		byStatus[reminder.status] = (byStatus[reminder.status] ?? 0) + 1;
		byType[reminder.type] += 1;
	}

	return {
		windowStart: windowStart.toISOString(),
		windowEnd: windowEnd.toISOString(),
		total: reminders.length,
		byStatus,
		byType,
		reminders,
	};
}

export async function getReminderWindowReport(
	windowStart: Date,
	windowEnd: Date,
): Promise<ReminderWindowReport> {
	await ensureDatabaseConnection();

	const flights = await loadReportFlights();

	return buildReminderWindowReport(flights, windowStart, windowEnd);
}

export function startOfUtcDay(value: Date): Date {
	return new Date(
		Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
	);
}

export function startOfUtcMonth(value: Date): Date {
	return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}

export function addDays(value: Date, days: number): Date {
	const result = new Date(value);
	result.setUTCDate(result.getUTCDate() + days);
	return result;
}

export function currentMonthWindow(value = new Date()): [Date, Date] {
	const start = startOfUtcMonth(value);
	return [
		start,
		new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)),
	];
}

export function nextDaysWindow(
	value: Date,
	startDays: number,
	endDays: number,
): [Date, Date] {
	const start =
		startDays === 0 ? value : addDays(startOfUtcDay(value), startDays);
	return [start, addDays(startOfUtcDay(value), endDays)];
}
