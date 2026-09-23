import type { SheetRow } from "./mapping";

export type NormalizedSheetRow = {
	sheetRow: number;

	name: string;
	location: string;
	origin: string;
	destination: string;

	departureDate: string;
	departureTime: string;

	arrivalDate: string;
	arrivalTime: string;

	layoverCity: string;
	layoverBegins: string;
	layoverEnds: string;
	layoverDuration: string;

	email: string;

	/**
	 * Original values from the Google Sheet.
	 * These are preserved so validation issues can report
	 * exactly what the user entered.
	 */
	raw: SheetRow;
};

const value = (row: SheetRow, header: string): string =>
	(row[header] ?? "").trim();

export function normalizeSheetRow(
	row: SheetRow,
	sheetRow: number,
): NormalizedSheetRow {
	return {
		sheetRow,

		name: value(row, "NAMES OF CLIENTS"),
		location: value(row, "location"),
		origin: value(row, "Origin"),
		destination: value(row, "Destination"),

		departureDate: value(row, "Departure Date"),
		departureTime: value(row, "Departure Time"),

		arrivalDate: value(row, "Arrival Date"),
		arrivalTime: value(row, "Arrival Time"),

		layoverCity: value(row, "Layover City"),
		layoverBegins: value(row, "Layover Begins"),
		layoverEnds: value(row, "Layover Ends"),
		layoverDuration: value(row, "Layover Duration"),

		email: value(row, "Email Address"),

		raw: row,
	};
}

export function normalizeSheetRows(
	rows: SheetRow[],
	startSheetRow = 2,
): NormalizedSheetRow[] {
	return rows.map((row, index) =>
		normalizeSheetRow(row, startSheetRow + index),
	);
}
