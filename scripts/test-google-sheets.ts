import "dotenv/config";

import { getSheetValues } from "../lib/google-sheets";
import {
	rowsToRecords,
	validateSheetHeaders,
} from "../lib/google-sheets/mapping";
import { normalizeSheetRows } from "../lib/google-sheets/normalize";

async function main() {
	const values = await getSheetValues();

	console.log(`Rows received: ${values.length}`);

	if (values.length === 0) {
		console.log("Google Sheet is empty.");
		return;
	}

	const [headers, ...rows] = values;

	validateSheetHeaders(headers);

	const records = rowsToRecords(headers, rows);
	const normalizedRows = normalizeSheetRows(records);

	console.log(`Data rows: ${normalizedRows.length}`);

	for (const row of normalizedRows.slice(0, 5)) {
		console.log("\n--------------------------------");
		console.log(`Sheet row: ${row.sheetRow}`);
		console.log(`Name: ${row.name}`);
		console.log(`Email: ${row.email}`);
		console.log(`Origin: ${row.origin}`);
		console.log(`Destination: ${row.destination}`);
		console.log(`Departure: ${row.departureDate} ${row.departureTime}`);
		console.log(`Arrival: ${row.arrivalDate} ${row.arrivalTime}`);
		console.log(`Layover: ${row.layoverBegins} -> ${row.layoverEnds}`);
	}
}

main().catch((error) => {
	console.error("Google Sheets normalization test failed:");
	console.error(error);
	process.exit(1);
});
