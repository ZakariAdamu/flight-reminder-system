import "dotenv/config";

import { db } from "../lib/db";
import {
	createResendReminderSender,
	notifyDevelopers,
} from "../lib/email/resend";
import { processDueReminders } from "../lib/reminder-processing";

async function main() {
	const result = await processDueReminders(createResendReminderSender());

	console.log("Reminder processing complete.");
	console.log(`Claimed: ${result.claimed}`);
	console.log(`Sent: ${result.sent}`);
	console.log(`Failed: ${result.failed}`);

	if (result.failed > 0) {
		await notifyDevelopers(
			"Flight reminder processing failures",
			`${result.failed} reminder(s) failed during the latest processing run. Review the database audit log and reminder error fields.`,
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
