import "dotenv/config";

import { getSheetValues } from "../lib/google-sheets";
import {
	rowsToRecords,
	validateSheetHeaders,
} from "../lib/google-sheets/mapping";
import { normalizeSheetRows } from "../lib/google-sheets/normalize";
import {
	flattenValidationIssues,
	validateEntireSheet,
} from "../lib/validation/validate-sheet-data";
import { ValidationSeverity } from "../lib/validation/types";
import { persistValidationIssues } from "../lib/validation/persist-validation-issues";

async function main() {
	const values = await getSheetValues();

	if (values.length === 0) {
		console.log("Google Sheet is empty.");
		return;
	}

	const [headers, ...rows] = values;

	validateSheetHeaders(headers);

	const records = rowsToRecords(headers, rows);
	const normalizedRows = normalizeSheetRows(records);

	const results = validateEntireSheet(normalizedRows);
	const issues = flattenValidationIssues(results);
	const clientNameBySheetRow = new Map(
		normalizedRows.map((row) => [row.sheetRow, row.name]),
	);

	await persistValidationIssues(issues);

	const errors = issues.filter(
		(issue) => issue.severity === ValidationSeverity.ERROR,
	);

	const warnings = issues.filter(
		(issue) => issue.severity === ValidationSeverity.WARNING,
	);

	const infos = issues.filter(
		(issue) => issue.severity === ValidationSeverity.INFO,
	);

	console.log("\n========================================");
	console.log("GOOGLE SHEETS VALIDATION");
	console.log("========================================");

	console.log(`Rows checked: ${normalizedRows.length}`);
	console.log(`Total issues: ${issues.length}`);
	console.log(`Errors: ${errors.length}`);
	console.log(`Warnings: ${warnings.length}`);
	console.log(`Info: ${infos.length}`);

	console.log("\n----------------------------------------");
	console.log("ISSUES");
	console.log("----------------------------------------");

	for (const issue of issues) {
		console.log(`\nRow ${issue.sheetRow} | ${issue.severity} | ${issue.code}`);
		console.log(
			`Client: ${clientNameBySheetRow.get(issue.sheetRow) || "(unnamed client)"}`,
		);

		if (issue.field) {
			console.log(`Field: ${issue.field}`);
		}

		if (issue.value !== undefined) {
			console.log(`Value: ${issue.value}`);
		}

		console.log(`Message: ${issue.message}`);
	}

	console.log("\n----------------------------------------");
	console.log("SYNC ELIGIBILITY");
	console.log("----------------------------------------");

	for (const result of results) {
		console.log(
			`Row ${result.row.sheetRow}: ${
				result.isValidForSync ? "VALID" : "BLOCKED"
			}`,
		);
	}
}

main().catch((error) => {
	console.error("Validation test failed:");
	console.error(error);
	process.exit(1);
});
