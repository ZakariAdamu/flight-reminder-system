import "temporal-polyfill/full/global";
import { Temporal } from "temporal-polyfill";
import { randomUUID } from "node:crypto";

import { getSheetValues } from "./google-sheets";
import {
	isCancelledSheetRow,
	isEmptySheetRow,
	isNilOnlySheetRow,
	rowsToRecords,
} from "./google-sheets/mapping";
import {
	normalizeSheetRows,
	type NormalizedSheetRow,
} from "./google-sheets/normalize";
import { combineSheetDateAndTime } from "./google-sheets/date-time";
import { db } from "./db";

const instant = (date: Date): Temporal.Instant =>
	Temporal.Instant.fromEpochMilliseconds(date.getTime());

const now = (): Temporal.Instant => instant(new Date());

function parseDateTime(dateValue: string, timeValue: string): Temporal.Instant {
	const date = combineSheetDateAndTime(dateValue, timeValue);

	if (!date) {
		throw new Error(`Unable to parse date/time: ${dateValue} ${timeValue}`);
	}

	return instant(date);
}

function optionalDateTime(
	dateValue: string,
	timeValue: string,
): Temporal.Instant | null {
	const placeholderValues = new Set([
		"-",
		"—",
		"n/a",
		"na",
		"nil",
		"cancelled",
	]);
	const normalizedDate = dateValue.trim().toLowerCase();
	const normalizedTime = timeValue.trim().toLowerCase();

	if (
		!normalizedDate ||
		!normalizedTime ||
		placeholderValues.has(normalizedDate) ||
		placeholderValues.has(normalizedTime)
	) {
		return null;
	}

	return parseDateTime(dateValue, timeValue);
}

function reminderTime(
	departureAt: Temporal.Instant,
	hoursBeforeDeparture: number,
) {
	const departure = Temporal.Instant.from(departureAt);

	return departure.subtract({
		hours: hoursBeforeDeparture,
	});
}

function usableFlightRow(row: NormalizedSheetRow): boolean {
	return Boolean(
		row.name &&
		row.email &&
		row.origin &&
		row.destination &&
		row.departureDate &&
		row.departureTime &&
		row.arrivalDate &&
		row.arrivalTime,
	);
}

async function upsertTraveller(row: NormalizedSheetRow) {
	const existing = await db.orm.public.Traveller.where({
		email: row.email,
	}).first();
	const timestamp = now();

	if (existing) {
		await db.orm.public.Traveller.where({ email: row.email }).update({
			name: row.name,
			location: row.location || null,
			updatedAt: timestamp,
		});

		return { id: existing.id, created: false };
	}

	const traveller = await db.orm.public.Traveller.create({
		id: randomUUID(),
		name: row.name,
		location: row.location || null,
		email: row.email,
		createdAt: timestamp,
		updatedAt: timestamp,
	});

	return { id: traveller.id, created: true };
}

async function upsertFlight(row: NormalizedSheetRow, travellerId: string) {
	const departureAt = parseDateTime(row.departureDate, row.departureTime);
	const arrivalAt = optionalDateTime(row.arrivalDate, row.arrivalTime);
	const layoverBeginsAt = optionalDateTime(
		row.layoverBeginsDate || row.departureDate,
		row.layoverBegins,
	);
	const layoverEndsAt = optionalDateTime(
		row.layoverEndsDate || row.departureDate,
		row.layoverEnds,
	);
	const timestamp = now();
	const existing = await db.orm.public.Flight.where({
		sheetRow: row.sheetRow,
	}).first();

	const values = {
		travellerId,
		origin: row.origin,
		destination: row.destination,
		departureAt,
		arrivalAt,
		layoverCity: row.layoverCity || null,
		layoverBeginsAt,
		layoverEndsAt,
		layoverDuration: row.layoverDuration || null,
		updatedAt: timestamp,
	};

	if (existing) {
		await db.orm.public.Flight.where({ sheetRow: row.sheetRow }).update(values);
		return { id: existing.id, created: false, departureAt };
	}

	const flight = await db.orm.public.Flight.create({
		id: randomUUID(),
		sheetRow: row.sheetRow,
		createdAt: timestamp,
		...values,
	});

	return { id: flight.id, created: true, departureAt };
}

async function upsertReminder(
	flightId: string,
	sheetRow: number,
	type: "ADMIN" | "CLIENT",
	departureAt: Temporal.Instant,
) {
	const reminderId = `flight-${sheetRow}-${type.toLowerCase()}`;
	const scheduledFor = reminderTime(departureAt, type === "ADMIN" ? 48 : 24);
	const existing = await db.orm.public.Reminder.where({ reminderId }).first();
	const timestamp = now();

	if (existing) {
		await db.orm.public.Reminder.where({ reminderId }).update({
			scheduledFor,
			updatedAt: timestamp,
		});
		return { id: existing.id, created: false };
	}

	const reminder = await db.orm.public.Reminder.create({
		id: randomUUID(),
		reminderId,
		flightId,
		type,
		scheduledFor,
		status: "PENDING",
		attemptCount: 0,
		sentAt: null,
		failedAt: null,
		nextAttemptAt: null,
		errorMessage: null,
		providerMessageId: null,
		createdAt: timestamp,
		updatedAt: timestamp,
	});

	return { id: reminder.id, created: true };
}

async function recordAudit(
	travellerId: string,
	message: string,
	eventType:
		| "TRAVELLER_CREATED"
		| "TRAVELLER_UPDATED"
		| "FLIGHT_CREATED"
		| "FLIGHT_UPDATED"
		| "REMINDER_CREATED",
	reminderId?: string,
) {
	await db.orm.public.AuditLog.create({
		id: randomUUID(),
		travellerId,
		reminderId: reminderId ?? null,
		eventType,
		message,
		metadata: null,
		createdAt: now(),
	});
}

export type SyncSummary = {
	rowsRead: number;
	rowsSynced: number;
	rowsSkipped: number;
	emptyRows: number;
	cancelledRows: number;
	remindersCreated: number;
};

export async function syncGoogleSheet(): Promise<SyncSummary> {
	const values = await getSheetValues();

	if (values.length === 0) {
		return {
			rowsRead: 0,
			rowsSynced: 0,
			rowsSkipped: 0,
			emptyRows: 0,
			cancelledRows: 0,
			remindersCreated: 0,
		};
	}

	const [headers, ...allRows] = values;
	const nilBoundary = allRows.findIndex(isNilOnlySheetRow);
	const rows = nilBoundary === -1 ? allRows : allRows.slice(0, nilBoundary);
	const records = rowsToRecords(headers, rows);
	const normalizedRows = normalizeSheetRows(records, 2);

	let rowsSynced = 0;
	let rowsSkipped = 0;
	let emptyRows = 0;
	let cancelledRows = 0;
	let remindersCreated = 0;

	for (const [index, row] of normalizedRows.entries()) {
		const rawRow = rows[index];
		const record = records[index];

		if (isEmptySheetRow(rawRow)) {
			emptyRows += 1;
			rowsSkipped += 1;
			continue;
		}

		if (isCancelledSheetRow(record)) {
			cancelledRows += 1;
			rowsSkipped += 1;
			continue;
		}

		if (!usableFlightRow(row)) {
			rowsSkipped += 1;
			continue;
		}

		const traveller = await upsertTraveller(row);
		await recordAudit(
			traveller.id,
			`${traveller.created ? "Created" : "Updated"} traveller from Sheet row ${row.sheetRow}.`,
			traveller.created ? "TRAVELLER_CREATED" : "TRAVELLER_UPDATED",
		);

		const flight = await upsertFlight(row, traveller.id);
		await recordAudit(
			traveller.id,
			`${flight.created ? "Created" : "Updated"} flight from Sheet row ${row.sheetRow}.`,
			flight.created ? "FLIGHT_CREATED" : "FLIGHT_UPDATED",
		);

		for (const type of ["ADMIN", "CLIENT"] as const) {
			const reminder = await upsertReminder(
				flight.id,
				row.sheetRow,
				type,
				flight.departureAt,
			);

			if (reminder.created) {
				remindersCreated += 1;
				await recordAudit(
					traveller.id,
					`Created ${type} reminder for Sheet row ${row.sheetRow}.`,
					"REMINDER_CREATED",
					reminder.id,
				);
			}
		}

		rowsSynced += 1;
	}

	return {
		rowsRead: normalizedRows.length,
		rowsSynced,
		rowsSkipped,
		emptyRows,
		cancelledRows,
		remindersCreated,
	};
}
