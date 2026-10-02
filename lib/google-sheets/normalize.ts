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
	layoverBeginsDate: string;
	layoverEndsDate: string;
	layoverBegins: string;
	layoverEnds: string;
	layoverDuration: string;

	email: string;
	flightStatus: string;
	reminderStatus: string;
};

const value = (row: SheetRow, header: string): string =>
	(row[header] ?? "").trim();

export function normalizeSheetRow(
	row: SheetRow,
	sheetRow: number,
): NormalizedSheetRow {
	return {
		sheetRow,

		name: value(row, "Name of  Clients") || value(row, "NAMES OF CLIENTS"),
		location: value(row, "location"),
		origin: value(row, "Origin"),
		destination: value(row, "Destination"),

		departureDate: value(row, "Departure Date"),
		departureTime: value(row, "Departure Time"),

		arrivalDate: value(row, "Arrival Date"),
		arrivalTime: value(row, "Arrival Time"),

		layoverCity: value(row, "Layover City"),
		layoverBeginsDate: value(row, "Layover Start Date"),
		layoverEndsDate: value(row, "Layover End Date"),
		layoverBegins:
			value(row, "Layover Start Time") || value(row, "Layover Begins"),
		layoverEnds: value(row, "Layover End Time") || value(row, "Layover Ends"),
		layoverDuration: value(row, "Layover Duration"),

		email: value(row, "Client Email") || value(row, "Email Address"),
		flightStatus: value(row, "Flight Status") || value(row, "Status"),
		reminderStatus: value(row, "Reminder Status"),
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
