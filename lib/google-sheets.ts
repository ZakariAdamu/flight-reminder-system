import { google } from "googleapis";

const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
const sheetName = process.env.GOOGLE_SHEETS_SHEET_NAME;

if (!spreadsheetId) {
	throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID is not configured.");
}

if (!sheetName) {
	throw new Error("GOOGLE_SHEETS_SHEET_NAME is not configured.");
}

const auth = new google.auth.GoogleAuth({
	scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
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
