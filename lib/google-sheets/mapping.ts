export const REQUIRED_SHEET_HEADERS = [
	"NAMES OF CLIENTS",
	"location",
	"Origin",
	"Destination",
	"Departure Date",
	"Departure Time",
	"Arrival Date",
	"Arrival Time",
	"Layover City",
	"Layover Duration",
	"Email Address",
] as const;

export type SheetHeader = (typeof REQUIRED_SHEET_HEADERS)[number];

export type SheetRow = Record<string, string>;

export function validateSheetHeaders(headers: string[]) {
	const missingHeaders = REQUIRED_SHEET_HEADERS.filter(
		(header) => !headers.includes(header),
	);

	if (missingHeaders.length > 0) {
		throw new Error(
			`Google Sheet is missing required headers: ${missingHeaders.join(", ")}`,
		);
	}
}

export function rowsToRecords(headers: string[], rows: string[][]): SheetRow[] {
	return rows.map((row) => {
		const record: SheetRow = {};

		headers.forEach((header, index) => {
			record[header] = row[index] ?? "";
		});

		return record;
	});
}
