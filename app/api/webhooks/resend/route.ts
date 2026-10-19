import "temporal-polyfill/full/global";
import { Webhook } from "svix";
import { Temporal } from "temporal-polyfill";

import { db, ensureDatabaseConnection } from "../../../../lib/db";
import { updateSheetReminderStatus } from "../../../../lib/google-sheets";

export const dynamic = "force-dynamic";

type ResendWebhookEvent = {
	type: string;
	data?: {
		email_id?: string;
		reason?: string;
		to?: string[];
	};
};

function webhookSecret(): string {
	const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();

	if (!secret) {
		throw new Error("RESEND_WEBHOOK_SECRET is not configured.");
	}

	return secret;
}

function providerStatus(
	eventType: string,
): "accepted" | "delivered" | "bounced" | "failed" | null {
	switch (eventType) {
		case "email.sent":
			return "accepted";
		case "email.delivered":
			return "delivered";
		case "email.bounced":
			return "bounced";
		case "email.failed":
			return "failed";
		default:
			return null;
	}
}

export async function POST(request: Request): Promise<Response> {
	try {
		const payload = await request.text();
		const event = new Webhook(webhookSecret()).verify(
			payload,
			Object.fromEntries(request.headers.entries()),
		) as unknown as ResendWebhookEvent;
		const nextProviderStatus = providerStatus(event.type);
		const emailId = event.data?.email_id;

		if (!nextProviderStatus || !emailId) {
			return Response.json({ ok: true, ignored: true });
		}

		await ensureDatabaseConnection();
		const reminder = await db.orm.public.Reminder.where({
			providerMessageId: emailId,
		})
			.include("flight")
			.first();

		if (!reminder) {
			return Response.json({ ok: true, ignored: true });
		}

		const eventAt = Temporal.Instant.fromEpochMilliseconds(Date.now());
		const deliveryFailure =
			nextProviderStatus === "bounced" || nextProviderStatus === "failed";
		await db.orm.public.Reminder.where({ id: reminder.id }).update({
			status: deliveryFailure ? "FAILED" : "SENT",
			providerStatus: nextProviderStatus,
			providerEventAt: eventAt,
			...(deliveryFailure
				? {
						nextAttemptAt: null,
						errorMessage:
							event.data?.reason ?? `Resend reported ${nextProviderStatus}.`,
					}
				: {}),
			updatedAt: eventAt,
		});

		try {
			const sheetStatus =
				nextProviderStatus === "delivered"
					? "DELIVERED"
					: deliveryFailure
						? "FAILED"
						: "SENT";
			await updateSheetReminderStatus(
				reminder.flight.sheetRow,
				reminder.type,
				sheetStatus,
			);
		} catch (error) {
			console.error("Could not write Resend status to Google Sheets:", error);
			return Response.json(
				{ ok: false, error: "Could not update Google Sheets." },
				{ status: 500 },
			);
		}

		return Response.json({ ok: true });
	} catch (error) {
		console.error("Resend webhook failed:", error);
		return Response.json({ ok: false }, { status: 400 });
	}
}
