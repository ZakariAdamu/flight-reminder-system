import "temporal-polyfill/full/global";
import { Temporal } from "temporal-polyfill";
import { randomUUID } from "node:crypto";

import type { Timestamptz } from "@prisma/orm-postgres/target/codec-types";

import { db } from "./db";

const instant = (value: Temporal.Instant): Timestamptz =>
	value as unknown as Timestamptz;

const now = (): Timestamptz =>
	instant(Temporal.Instant.fromEpochMilliseconds(Date.now()));

const retryDelayMinutes = (attemptCount: number): number =>
	Math.min(60, 2 ** Math.max(0, attemptCount - 1));

export type ReminderToSend = {
	id: string;
	reminderId: string;
	type: "ADMIN" | "CLIENT";
	attemptCount: number;
	travellerId: string;
	travellerName: string;
	travellerEmail: string;
};

export type ReminderSender = (
	reminder: ReminderToSend,
) => Promise<{ providerMessageId?: string }>;

async function dueReminders(at: Timestamptz) {
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

async function claimReminder(
	reminder: Awaited<ReturnType<typeof dueReminders>>[number],
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

	const flight = await db.orm.public.Flight.first({ id: reminder.flightId });

	if (!flight) {
		return null;
	}

	const traveller = await db.orm.public.Traveller.first({
		id: flight.travellerId,
	});

	if (!traveller) {
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
	};
}

export async function processDueReminders(
	sender: ReminderSender,
	at: Timestamptz = now(),
): Promise<{ claimed: number; sent: number; failed: number }> {
	const due = await dueReminders(at);
	let claimed = 0;
	let sent = 0;
	let failed = 0;

	for (const candidate of due) {
		const reminder = await claimReminder(candidate);

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

			failed += 1;
		}
	}

	return { claimed, sent, failed };
}
