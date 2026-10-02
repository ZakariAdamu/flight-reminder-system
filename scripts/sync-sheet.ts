import "dotenv/config";

import { db } from "../lib/db";
import { syncGoogleSheet } from "../lib/sync-google-sheet";

async function main() {
	const summary = await syncGoogleSheet();

	console.log("Google Sheet synchronization complete.");
	console.log(`Rows read: ${summary.rowsRead}`);
	console.log(`Rows synced: ${summary.rowsSynced}`);
	console.log(`Rows skipped: ${summary.rowsSkipped}`);
	console.log(`Empty rows: ${summary.emptyRows}`);
	console.log(`Cancelled rows: ${summary.cancelledRows}`);
	console.log(`Reminders created: ${summary.remindersCreated}`);

	await db.close();
}

main().catch(async (error) => {
	console.error("Google Sheet synchronization failed:");
	console.error(error);
	process.exitCode = 1;
});
