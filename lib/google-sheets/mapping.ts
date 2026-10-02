export const REQUIRED_SHEET_HEADERS = [
	"Name of  Clients",
	"Origin",
	"Destination",
	"Departure Date",
	"Departure Time",
	"Arrival Date",
	"Arrival Time",
	"Layover City",
	"Layover Start Date",
	"Layover End Date",
	"Layover Start Time",
	"Layover End Time",
	"Layover Duration",
	"Client Email",
	"Flight Status",
	"Reminder Status",
] as const;

export type SheetHeader = (typeof REQUIRED_SHEET_HEADERS)[number];

export type SheetRow = Record<string, string>;

const EMPTY_CELL_VALUES = new Set(["-", "—", "n/a", "na", "nil"]);

export function isEmptySheetRow(row: string[]): boolean {
	return row.every((cell) => {
		const value = cell?.trim().toLowerCase() ?? "";
		return !value || EMPTY_CELL_VALUES.has(value);
	});
}

export function isNilOnlySheetRow(row: string[]): boolean {
	const values = row
		.map((cell) => cell?.trim().toLowerCase() ?? "")
		.filter(Boolean);

	return values.length > 0 && values.every((value) => value === "nil");
}

export function isCancelledSheetRow(row: SheetRow): boolean {
	const flightStatus = row["Flight Status"] ?? row["Status"] ?? "";

	return flightStatus.trim().toLowerCase() === "cancelled";
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
