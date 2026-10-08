import "dotenv/config";

import { db } from "../lib/db";
import {
	getReminderWindowReport,
	nextDaysWindow,
} from "../lib/reminder-reports";

async function main() {
	const [windowStart, windowEnd] = nextDaysWindow(new Date(), 7, 14);
	const report = await getReminderWindowReport(windowStart, windowEnd);

	console.log(
		`Reminders due in days 8-14 (${report.windowStart} to ${report.windowEnd})`,
	);
	console.log(`Total: ${report.total}`);
	console.log(
		`By type: ADMIN ${report.byType.ADMIN}, CLIENT ${report.byType.CLIENT}`,
	);
	console.log("By status:", report.byStatus);
	console.table(report.reminders);
}

main()
	.catch((error) => {
		console.error("Could not report two-week reminders:", error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await db.close();
	});
