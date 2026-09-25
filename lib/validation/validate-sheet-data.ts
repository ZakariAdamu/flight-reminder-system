import type { NormalizedSheetRow } from "../google-sheets/normalize";
import { validateSheetRow } from "./validate-sheet";
import {
	ValidationIssueCode,
	ValidationSeverity,
	type ValidationIssue,
	type ValidationResult,
} from "./types";

function duplicateFlightKey(row: NormalizedSheetRow): string {
	return [
		row.name.toLowerCase(),
		row.email.toLowerCase(),
		row.origin.toLowerCase(),
		row.destination.toLowerCase(),
		row.departureDate.toLowerCase(),
		row.departureTime,
	].join("|");
}

export function validateEntireSheet(
	rows: NormalizedSheetRow[],
): ValidationResult[] {
	const results = rows.map(validateSheetRow);

	const flightGroups = new Map<string, NormalizedSheetRow[]>();

	for (const row of rows) {
		const key = duplicateFlightKey(row);

		if (!key.replace(/\|/g, "")) {
			continue;
		}

		const existing = flightGroups.get(key) ?? [];
		existing.push(row);
		flightGroups.set(key, existing);
	}

	for (const group of flightGroups.values()) {
		if (group.length < 2) {
			continue;
		}

		for (const row of group) {
			const result = results.find((item) => item.row.sheetRow === row.sheetRow);

			if (!result) {
				continue;
			}

			result.issues.push({
				sheetRow: row.sheetRow,
				field: "Flight",
				code: ValidationIssueCode.DUPLICATE_FLIGHT,
				severity: ValidationSeverity.WARNING,
				message: "Another Sheet row appears to contain the same flight.",
				value: `${row.origin} → ${row.destination} ${row.departureDate} ${row.departureTime}`,
				fingerprint: `${row.sheetRow}|DUPLICATE_FLIGHT|${duplicateFlightKey(row)}`,
			});
		}
	}

	return results;
}

export function flattenValidationIssues(
	results: ValidationResult[],
): ValidationIssue[] {
	return results.flatMap((result) => result.issues);
}
