import "dotenv/config";

import { db } from "../lib/db";
import {
	createResendReminderSender,
	notifyDevelopers,
} from "../lib/email/resend";
import { processDueReminders } from "../lib/reminder-processing";
import { syncGoogleSheet } from "../lib/sync-google-sheet";

async function main() {
	const sync = await syncGoogleSheet();
	console.log("Google Sheet synchronization complete.");
	console.log(`Rows read: ${sync.rowsRead}`);
	console.log(`Rows synced: ${sync.rowsSynced}`);
	console.log(`Rows skipped: ${sync.rowsSkipped}`);
	console.log(`Reminders created: ${sync.remindersCreated}`);

	const result = await processDueReminders(createResendReminderSender());

	console.log("Reminder processing complete.");
	console.log(`Claimed: ${result.claimed}`);
	console.log(`Sent: ${result.sent}`);
	console.log(`Failed: ${result.failed}`);
	console.log(`Skipped: ${result.skipped}`);
	console.log(`Sheet status failures: ${result.sheetStatusFailures}`);

	if (result.failed > 0 || result.sheetStatusFailures > 0) {
		await notifyDevelopers(
			"Flight reminder processing failures",
			`${result.failed} reminder(s) failed and ${result.sheetStatusFailures} Sheet status update(s) failed during the latest processing run. Review the database audit log and reminder error fields.`,
		);
	}
}

main()
	.catch(async (error) => {
		console.error("Reminder processing failed:");
		console.error(error);

		try {
			await notifyDevelopers(
				"Flight reminder worker failed",
				error instanceof Error ? (error.stack ?? error.message) : String(error),
			);
		} catch (notificationError) {
			console.error("Could not notify developers:", notificationError);
		}

		process.exitCode = 1;
	})
	.finally(async () => {
		await db.close();
	});
