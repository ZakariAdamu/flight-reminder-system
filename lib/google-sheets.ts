import { google, type sheets_v4 } from "googleapis";

import {
	isNilOnlySheetRow,
	rowsToRecords,
	type SheetRow,
} from "./google-sheets/mapping";

const GOOGLE_SHEET_CACHE_TTL_MS = 30_000;
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 250;

type ReminderStatus = "PENDING" | "SENT" | "DELIVERED" | "FAILED" | "SKIPPED";

type GoogleSheetConfig = {
	spreadsheetId: string;
	sheetName: string;
	email: string;
	privateKey: string;
};

function getGoogleSheetConfig(): GoogleSheetConfig {
	const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
	const sheetName = process.env.GOOGLE_SHEETS_SHEET_NAME?.trim();
	const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
	const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(
		/\\n/g,
		"\n",
	).trim();

	if (!email || !privateKey) {
		throw new Error("Google service account credentials are missing.");
	}

	if (!spreadsheetId) {
		throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID is not configured.");
	}

	if (!sheetName) {
		throw new Error("GOOGLE_SHEETS_SHEET_NAME is not configured.");
	}

	return { spreadsheetId, sheetName, email, privateKey };
}

let sheetsClient: { sheets: sheets_v4.Sheets } | null = null;

function getSheetsClient(): { sheets: sheets_v4.Sheets } {
	if (sheetsClient) {
		return sheetsClient;
	}

	const { email, privateKey } = getGoogleSheetConfig();
	const auth = new google.auth.GoogleAuth({
		credentials: {
			client_email: email,
			private_key: privateKey,
		},
		scopes: ["https://www.googleapis.com/auth/spreadsheets"],
	});

	sheetsClient = {
		sheets: google.sheets({
			version: "v4",
			auth,
		}),
	};

	return sheetsClient;
}

let valuesCache: { expiresAt: number; values: string[][] } | null = null;
let sheetIdCache: { expiresAt: number; sheetId: number } | null = null;

async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
	let lastError: unknown;

	for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
		try {
			return await operation();
		} catch (error) {
			lastError = error;

			if (attempt >= MAX_RETRIES) {
				throw error;
			}

			await new Promise((resolve) =>
				setTimeout(resolve, INITIAL_RETRY_DELAY_MS * 2 ** attempt),
			);
		}
	}

	throw lastError instanceof Error
		? lastError
		: new Error("Google Sheets request failed.");
}

export async function getSheetValues(
	forceRefresh = false,
): Promise<string[][]> {
	const now = Date.now();

	if (!forceRefresh && valuesCache && valuesCache.expiresAt > now) {
		return valuesCache.values;
	}

	const { spreadsheetId, sheetName } = getGoogleSheetConfig();
	const { sheets } = getSheetsClient();

	const response = await withRetry(() =>
		sheets.spreadsheets.values.get({
			spreadsheetId,
			range: sheetName,
			majorDimension: "ROWS",
		}),
	);

	const values = response.data.values ?? [];
	valuesCache = {
		expiresAt: Date.now() + GOOGLE_SHEET_CACHE_TTL_MS,
		values,
	};

	return values;
}

async function getSheetId(forceRefresh = false): Promise<number> {
	const now = Date.now();

	if (!forceRefresh && sheetIdCache && sheetIdCache.expiresAt > now) {
		return sheetIdCache.sheetId;
	}

	const { spreadsheetId, sheetName } = getGoogleSheetConfig();
	const { sheets } = getSheetsClient();

	const spreadsheet = await withRetry(() =>
		sheets.spreadsheets.get({
			spreadsheetId,
			fields: "sheets.properties",
		}),
	);

	const sheet = spreadsheet.data.sheets?.find(
		(item) => item.properties?.title === sheetName,
	);
	const sheetId = sheet?.properties?.sheetId;

	if (sheetId == null) {
		throw new Error(`Google Sheet tab "${sheetName}" could not be found.`);
	}

	sheetIdCache = {
		expiresAt: Date.now() + GOOGLE_SHEET_CACHE_TTL_MS,
		sheetId,
	};

	return sheetId;
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
	status: ReminderStatus,
): Promise<void> {
	await updateSheetReminderStatuses([{ sheetRow, reminderType, status }]);
}

export async function updateSheetReminderStatuses(
	updates: Array<{
		sheetRow: number;
		reminderType: "ADMIN" | "CLIENT";
		status: ReminderStatus;
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

	const { spreadsheetId } = getGoogleSheetConfig();
	const sheetId = await getSheetId();
	const backgroundColors = {
		PENDING: { red: 1, green: 0.95, blue: 0.65 },
		SENT: { red: 0.72, green: 0.9, blue: 0.72 },
		DELIVERED: { red: 0.55, green: 0.82, blue: 0.95 },
		FAILED: { red: 1, green: 0.75, blue: 0.75 },
		SKIPPED: { red: 0.85, green: 0.85, blue: 0.85 },
	};
	const { sheets } = getSheetsClient();

	await withRetry(() =>
		sheets.spreadsheets.batchUpdate({
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
		}),
	);

	valuesCache = null;
	sheetIdCache = null;
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
