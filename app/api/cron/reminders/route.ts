import {
	createResendReminderSender,
	notifyDevelopers,
} from "../../../../lib/email/resend";
import { processDueReminders } from "../../../../lib/reminder-processing";
import { syncGoogleSheet } from "../../../../lib/sync-google-sheet";

export const dynamic = "force-dynamic";

function cronSecretConfigured(): boolean {
	return Boolean(process.env.CRON_SECRET?.trim());
}

function isAuthorized(request: Request): boolean {
	return (
		request.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`
	);
}

export async function GET(request: Request): Promise<Response> {
	if (!cronSecretConfigured()) {
		return Response.json(
			{ error: "CRON_SECRET is not configured." },
			{ status: 500 },
		);
	}

	if (!isAuthorized(request)) {
		return Response.json({ error: "Unauthorized." }, { status: 401 });
	}

	try {
		const sync = await syncGoogleSheet();
		const result = await processDueReminders(createResendReminderSender());

		if (result.failed > 0 || result.sheetStatusFailures > 0) {
			await notifyDevelopers(
				"Flight reminder cron processing failures",
				`${result.failed} reminder(s) failed and ${result.sheetStatusFailures} Sheet status update(s) failed during the latest cron run.`,
			);
		}

		return Response.json({
			ok: true,
			processedAt: new Date().toISOString(),
			sync,
			...result,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);

		try {
			await notifyDevelopers("Flight reminder cron failed", message);
		} catch (notificationError) {
			console.error("Could not notify developers:", notificationError);
		}

		return Response.json({ ok: false, error: message }, { status: 500 });
	}
}
