import "temporal-polyfill/full/global";
import { Temporal } from "temporal-polyfill";
import { randomUUID } from "node:crypto";

import { db } from "./db";
import {
	getSheetReminderStates,
	updateSheetReminderStatus,
} from "./google-sheets";

const instant = (value: Temporal.Instant): Temporal.Instant => value;

const now = (): Temporal.Instant =>
	instant(Temporal.Instant.fromEpochMilliseconds(Date.now()));

const retryDelayMinutes = (attemptCount: number): number =>
	Math.min(60, 2 ** Math.max(0, attemptCount - 1));

type ReminderDate = Date | Temporal.Instant;

export type ReminderToSend = {
	id: string;
	reminderId: string;
	type: "ADMIN" | "CLIENT";
	attemptCount: number;
	travellerId: string;
	travellerName: string;
	travellerEmail: string;
	origin: string;
	destination: string;
	departureAt: ReminderDate;
	arrivalAt: ReminderDate | null;
	layoverCity: string | null;
	layoverBeginsAt: ReminderDate | null;
	layoverEndsAt: ReminderDate | null;
	layoverDuration: string | null;
};

type ReminderCandidate = Awaited<ReturnType<typeof dueReminders>>[number];
type FlightRecord = NonNullable<
	Awaited<ReturnType<typeof db.orm.public.Flight.first>>
>;
type TravellerRecord = NonNullable<
	Awaited<ReturnType<typeof db.orm.public.Traveller.first>>
>;

export type ReminderSender = (
	reminder: ReminderToSend,
) => Promise<{ providerMessageId?: string }>;

async function dueReminders(at: Temporal.Instant) {
	const pending = await db.orm.public.Reminder.where({ status: "PENDING" })
		.where((reminder) => reminder.scheduledFor.lte(at))
		.limit(100)
		.all();

	const retryable = await db.orm.public.Reminder.where({ status: "FAILED" })
		.where((reminder) => reminder.nextAttemptAt.isNotNull())
		.where((reminder) => reminder.nextAttemptAt.lte(at))
		.limit(100)
		.all();

	return [...pending, ...retryable];
}

async function recoverStaleProcessing(at: Temporal.Instant): Promise<void> {
	const staleBefore = Temporal.Instant.from(at).subtract({ minutes: 10 });
	const stale = await db.orm.public.Reminder.where({ status: "PROCESSING" })
		.where((reminder) => reminder.updatedAt.lte(staleBefore))
		.limit(100)
		.all();

	for (const reminder of stale) {
		await db.orm.public.Reminder.where({
			id: reminder.id,
			status: "PROCESSING",
		}).update({
			status: "FAILED",
			failedAt: at,
			nextAttemptAt: at,
			errorMessage: "Recovered a stale processing claim.",
			updatedAt: at,
		});
	}
}

async function loadReminderContext(candidate: ReminderCandidate): Promise<{
	flight: FlightRecord;
	traveller: TravellerRecord;
} | null> {
	const flight = await db.orm.public.Flight.first({ id: candidate.flightId });

	if (!flight) {
		return null;
	}

	const traveller = await db.orm.public.Traveller.first({
		id: flight.travellerId,
	});

	return traveller ? { flight, traveller } : null;
}

async function markSkipped(
	candidate: ReminderCandidate,
	context: { flight: FlightRecord; traveller: TravellerRecord },
	reason: string,
): Promise<boolean> {
	const timestamp = now();
	const skipped = await db.orm.public.Reminder.where({
		id: candidate.id,
		status: candidate.status,
	}).update({
		status: "SKIPPED",
		errorMessage: reason,
		updatedAt: timestamp,
	});

	if (!skipped) {
		return false;
	}

	await db.orm.public.AuditLog.create({
		id: randomUUID(),
		travellerId: context.traveller.id,
		reminderId: candidate.id,
		eventType: "REMINDER_CANCELLED",
		message: `${candidate.type} reminder skipped: ${reason}`,
		metadata: null,
		createdAt: timestamp,
	});

	return true;
}

async function markUnavailable(
	candidate: ReminderCandidate,
	errorMessage: string,
	at: Temporal.Instant,
): Promise<boolean> {
	const updated = await db.orm.public.Reminder.where({
		id: candidate.id,
		status: candidate.status,
	}).update({
		status: "FAILED",
		failedAt: at,
		nextAttemptAt: at,
		errorMessage,
		updatedAt: at,
	});

	return Boolean(updated);
}

async function claimReminder(
	reminder: ReminderCandidate,
	flight: FlightRecord,
	traveller: TravellerRecord,
): Promise<ReminderToSend | null> {
	const timestamp = now();
	const claimed = await db.orm.public.Reminder.where({
		id: reminder.id,
		status: reminder.status,
	}).update({
		status: "PROCESSING",
		attemptCount: reminder.attemptCount + 1,
		nextAttemptAt: null,
		updatedAt: timestamp,
	});

	if (!claimed) {
		return null;
	}

	await db.orm.public.AuditLog.create({
		id: randomUUID(),
		travellerId: traveller.id,
		reminderId: reminder.id,
		eventType:
			reminder.type === "ADMIN" ? "ADMIN_REMINDER_DUE" : "CLIENT_REMINDER_DUE",
		message: `${reminder.type} reminder claimed for processing.`,
		metadata: null,
		createdAt: timestamp,
	});

	return {
		id: reminder.id,
		reminderId: reminder.reminderId,
		type: reminder.type,
		attemptCount: reminder.attemptCount + 1,
		travellerId: traveller.id,
		travellerName: traveller.name,
		travellerEmail: traveller.email,
		origin: flight.origin,
		destination: flight.destination,
		departureAt: flight.departureAt,
		arrivalAt: flight.arrivalAt,
		layoverCity: flight.layoverCity,
		layoverBeginsAt: flight.layoverBeginsAt,
		layoverEndsAt: flight.layoverEndsAt,
		layoverDuration: flight.layoverDuration,
	};
}

export async function processDueReminders(
	sender: ReminderSender,
	at: Temporal.Instant = now(),
): Promise<{
	claimed: number;
	sent: number;
	failed: number;
	skipped: number;
	sheetStatusFailures: number;
}> {
	await recoverStaleProcessing(at);
	const sheetStates = await getSheetReminderStates();
	const due = await dueReminders(at);
	let claimed = 0;
	let sent = 0;
	let failed = 0;
	let skipped = 0;
	let sheetStatusFailures = 0;

	for (const candidate of due) {
		const context = await loadReminderContext(candidate);

		if (!context) {
			if (
				await markUnavailable(
					candidate,
					"Flight or traveller record is missing.",
					at,
				)
			) {
				failed += 1;
			}
			continue;
		}

		const sheetState = sheetStates.get(context.flight.sheetRow);

		if (!sheetState) {
			if (
				await markUnavailable(
					candidate,
					`Google Sheet row ${context.flight.sheetRow} could not be verified.`,
					at,
				)
			) {
				failed += 1;
			}
			continue;
		}

		if (sheetState.flightStatus.trim().toLowerCase() === "cancelled") {
			if (
				await markSkipped(
					candidate,
					context,
					"Flight is cancelled in Google Sheets.",
				)
			) {
				skipped += 1;
				try {
					await updateSheetReminderStatus(
						context.flight.sheetRow,
						candidate.type,
						"SKIPPED",
					);
				} catch (error) {
					sheetStatusFailures += 1;
					console.error(
						"Could not write skipped status to Google Sheets:",
						error,
					);
				}
			}
			continue;
		}

		if (
			Temporal.Instant.compare(
				Temporal.Instant.from(context.flight.departureAt),
				at,
			) <= 0
		) {
			if (
				await markSkipped(
					candidate,
					context,
					"Flight departure has already passed.",
				)
			) {
				skipped += 1;
				try {
					await updateSheetReminderStatus(
						context.flight.sheetRow,
						candidate.type,
						"SKIPPED",
					);
				} catch (error) {
					sheetStatusFailures += 1;
					console.error(
						"Could not write expired status to Google Sheets:",
						error,
					);
				}
			}
			continue;
		}

		const reminder = await claimReminder(
			candidate,
			context.flight,
			context.traveller,
		);

		if (!reminder) {
			continue;
		}

		claimed += 1;

		try {
			const result = await sender(reminder);
			const timestamp = now();

			await db.orm.public.Reminder.where({ id: reminder.id }).update({
				status: "SENT",
				sentAt: timestamp,
				failedAt: null,
				errorMessage: null,
				providerMessageId: result.providerMessageId ?? null,
				updatedAt: timestamp,
			});

			await db.orm.public.AuditLog.create({
				id: randomUUID(),
				travellerId: reminder.travellerId,
				reminderId: reminder.id,
				eventType:
					reminder.type === "ADMIN"
						? "ADMIN_REMINDER_SENT"
						: "CLIENT_REMINDER_SENT",
				message: `${reminder.type} reminder sent successfully.`,
				metadata: null,
				createdAt: timestamp,
			});

			try {
				await updateSheetReminderStatus(
					context.flight.sheetRow,
					reminder.type,
					"SENT",
				);
			} catch (error) {
				sheetStatusFailures += 1;
				console.error("Could not write sent status to Google Sheets:", error);
			}

			sent += 1;
		} catch (error) {
			const timestamp = now();
			const nextAttemptAt = Temporal.Instant.from(at).add({
				minutes: retryDelayMinutes(reminder.attemptCount),
			});
			const errorMessage =
				error instanceof Error ? error.message : String(error);

			await db.orm.public.Reminder.where({ id: reminder.id }).update({
				status: "FAILED",
				failedAt: timestamp,
				nextAttemptAt: instant(nextAttemptAt),
				errorMessage,
				updatedAt: timestamp,
			});

			await db.orm.public.AuditLog.create({
				id: randomUUID(),
				travellerId: reminder.travellerId,
				reminderId: reminder.id,
				eventType: "REMINDER_FAILED",
				message: `${reminder.type} reminder failed: ${errorMessage}`,
				metadata: null,
				createdAt: timestamp,
			});

			try {
				await updateSheetReminderStatus(
					context.flight.sheetRow,
					reminder.type,
					"FAILED",
				);
			} catch (sheetError) {
				sheetStatusFailures += 1;
				console.error(
					"Could not write failed status to Google Sheets:",
					sheetError,
				);
			}

			failed += 1;
		}
	}

	return { claimed, sent, failed, skipped, sheetStatusFailures };
}
