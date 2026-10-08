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
	status: "PENDING" | "SENT" | "FAILED" | "SKIPPED",
): Promise<void> {
	await updateSheetReminderStatuses([{ sheetRow, reminderType, status }]);
}

export async function updateSheetReminderStatuses(
	updates: Array<{
		sheetRow: number;
		reminderType: "ADMIN" | "CLIENT";
		status: "PENDING" | "SENT" | "FAILED" | "SKIPPED";
	}>,
): Promise<void> {
	if (updates.length === 0) {
		return;
	}

	const values = await getSheetValues();
	const [headers = [], ...allRows] = values;
	const nilBoundary = allRows.findIndex(isNilOnlySheetRow);
	const rows = nilBoundary === -1 ? allRows : allRows.slice(0, nilBoundary);
	const reminderColumn = headers.indexOf("Reminder Status");

	if (reminderColumn === -1) {
		throw new Error('Google Sheet is missing the "Reminder Status" header.');
	}

	const entriesByRow = new Map<number, string>();
	for (const update of updates) {
		if (update.sheetRow < 2 || update.sheetRow > rows.length + 1) {
			throw new Error(
				`Google Sheet row ${update.sheetRow} is outside the data range.`,
			);
		}

		const currentValue = rows[update.sheetRow - 2]?.[reminderColumn] ?? "";
		const entries = (entriesByRow.get(update.sheetRow) ?? currentValue)
			.split(";")
			.map((entry: string) => entry.trim())
			.filter(
				(entry: string) =>
					entry && !entry.toUpperCase().startsWith(`${update.reminderType} `),
			);
		entries.push(`${update.reminderType} ${update.status}`);
		entriesByRow.set(update.sheetRow, entries.join("; "));
	}

	const spreadsheet = await sheets.spreadsheets.get({
		spreadsheetId,
		fields: "sheets.properties",
	});
	const sheet = spreadsheet.data.sheets?.find(
		(item) => item.properties?.title === sheetName,
	);
	const sheetId = sheet?.properties?.sheetId;

	if (sheetId === undefined) {
		throw new Error(`Google Sheet tab "${sheetName}" could not be found.`);
	}

	const backgroundColors = {
		PENDING: { red: 1, green: 0.95, blue: 0.65 },
		SENT: { red: 0.72, green: 0.9, blue: 0.72 },
		FAILED: { red: 1, green: 0.75, blue: 0.75 },
		SKIPPED: { red: 0.85, green: 0.85, blue: 0.85 },
	};

	await sheets.spreadsheets.batchUpdate({
		spreadsheetId,
		requestBody: {
			requests: updates.map((update) => ({
				updateCells: {
					range: {
						sheetId,
						startRowIndex: update.sheetRow - 1,
						endRowIndex: update.sheetRow,
						startColumnIndex: reminderColumn,
						endColumnIndex: reminderColumn + 1,
					},
					rows: [
						{
							values: [
								{
									userEnteredValue: {
										stringValue: entriesByRow.get(update.sheetRow) ?? "",
									},
									userEnteredFormat: {
										backgroundColor: backgroundColors[update.status],
									},
								},
							],
						},
					],
					fields: "userEnteredValue,userEnteredFormat.backgroundColor",
				},
			})),
		},
	});
}

function sheetValue(
	record: SheetRow,
	primaryHeader: string,
	legacyHeader?: string,
): string {
	return (
		record[primaryHeader] ??
		(legacyHeader ? record[legacyHeader] : "") ??
		""
	).trim();
}
