import { google } from "googleapis";

import {
	isNilOnlySheetRow,
	rowsToRecords,
	type SheetRow,
} from "./google-sheets/mapping";

const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
const sheetName = process.env.GOOGLE_SHEETS_SHEET_NAME;

if (!spreadsheetId) {
	throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID is not configured.");
}

if (!sheetName) {
	throw new Error("GOOGLE_SHEETS_SHEET_NAME is not configured.");
}

const auth = new google.auth.GoogleAuth({
	scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({
	version: "v4",
	auth,
});

export async function getSheetValues() {
	const response = await sheets.spreadsheets.values.get({
		spreadsheetId,
		range: sheetName,
	});

	return response.data.values ?? [];
}

export type SheetReminderState = {
	sheetRow: number;
	flightStatus: string;
	reminderStatus: string;
};

export async function getSheetReminderStates(): Promise<
	Map<number, SheetReminderState>
> {
	const values = await getSheetValues();
	const [headers = [], ...allRows] = values;
	const nilBoundary = allRows.findIndex(isNilOnlySheetRow);
	const rows = nilBoundary === -1 ? allRows : allRows.slice(0, nilBoundary);
	const records = rowsToRecords(headers, rows);
	const states = new Map<number, SheetReminderState>();

	for (const [index, record] of records.entries()) {
		const sheetRow = index + 2;
		states.set(sheetRow, {
			sheetRow,
			flightStatus: sheetValue(record, "Flight Status", "Status"),
			reminderStatus: sheetValue(record, "Reminder Status"),
		});
	}

	return states;
}

export async function updateSheetReminderStatus(
	sheetRow: number,
	reminderType: "ADMIN" | "CLIENT",
	status: "SENT" | "FAILED" | "SKIPPED",
): Promise<void> {
	const values = await getSheetValues();
	const [headers = [], ...allRows] = values;
	const nilBoundary = allRows.findIndex(isNilOnlySheetRow);
	const rows = nilBoundary === -1 ? allRows : allRows.slice(0, nilBoundary);
	const reminderColumn = headers.indexOf("Reminder Status");

	if (reminderColumn === -1) {
		throw new Error('Google Sheet is missing the "Reminder Status" header.');
	}

	if (sheetRow < 2 || sheetRow > rows.length + 1) {
		throw new Error(`Google Sheet row ${sheetRow} is outside the data range.`);
	}

	const currentValue = rows[sheetRow - 2]?.[reminderColumn] ?? "";
	const statusEntry = `${reminderType} ${status}`;
	const entries = currentValue
		.split(";")
		.map((entry: string) => entry.trim())
		.filter(
			(entry: string) =>
				entry && !entry.toUpperCase().startsWith(`${reminderType} `),
		);
	entries.push(statusEntry);

	await sheets.spreadsheets.values.update({
		spreadsheetId,
		range: `${sheetName}!${columnName(reminderColumn + 1)}${sheetRow}`,
		valueInputOption: "RAW",
		requestBody: { values: [[entries.join("; ")]] },
	});
}

function sheetValue(
	record: SheetRow,
	primaryHeader: string,
	legacyHeader?: string,
): string {
	return (record[primaryHeader] ?? (legacyHeader ? record[legacyHeader] : "") ?? "").trim();
}

function columnName(columnNumber: number): string {
	let name = "";
	let number = columnNumber;

	while (number > 0) {
		const remainder = (number - 1) % 26;
		name = String.fromCharCode(65 + remainder) + name;
		number = Math.floor((number - 1) / 26);
	}

	return name;
}
