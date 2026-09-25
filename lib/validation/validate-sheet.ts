import type { NormalizedSheetRow } from "../google-sheets/normalize";
import { createValidationFingerprint } from "./fingerprint";
import {
	combineSheetDateAndTime,
	parse12HourTime,
	parseSheetDate,
} from "./date-time";
import {
	ValidationIssueCode,
	ValidationResult,
	ValidationSeverity,
	type ValidationIssue,
} from "./types";

function createIssue(
	row: NormalizedSheetRow,
	input: Omit<ValidationIssue, "sheetRow" | "fingerprint">,
): ValidationIssue {
	return {
		...input,
		sheetRow: row.sheetRow,
		fingerprint: createValidationFingerprint({
			sheetRow: row.sheetRow,
			field: input.field,
			code: input.code,
			value: input.value,
			message: input.message,
		}),
	};
}

function validateRequiredFields(row: NormalizedSheetRow): ValidationIssue[] {
	const requiredFields = [
		["name", row.name, "NAMES OF CLIENTS"],
		["origin", row.origin, "Origin"],
		["destination", row.destination, "Destination"],
		["departureDate", row.departureDate, "Departure Date"],
		["departureTime", row.departureTime, "Departure Time"],
		["email", row.email, "Email Address"],
	] as const;

	const issues: ValidationIssue[] = [];

	for (const [property, value, field] of requiredFields) {
		if (!value) {
			issues.push(
				createIssue(row, {
					field,
					code: ValidationIssueCode.REQUIRED_FIELD_MISSING,
					severity: ValidationSeverity.ERROR,
					message: `${field} is required.`,
					value,
				}),
			);
		}
	}

	return issues;
}

function validateName(row: NormalizedSheetRow): ValidationIssue[] {
	if (!row.name) {
		return [];
	}

	// Allow letters, spaces, apostrophes, hyphens and periods.
	if (!/^[\p{L}][\p{L}\s.'-]*$/u.test(row.name)) {
		return [
			createIssue(row, {
				field: "NAMES OF CLIENTS",
				code: ValidationIssueCode.INVALID_NAME,
				severity: ValidationSeverity.WARNING,
				message: "Client name contains unexpected characters.",
				value: row.name,
			}),
		];
	}

	return [];
}

function validateEmail(row: NormalizedSheetRow): ValidationIssue[] {
	if (!row.email) {
		return [];
	}

	const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

	if (!emailPattern.test(row.email)) {
		return [
			createIssue(row, {
				field: "Email Address",
				code: ValidationIssueCode.INVALID_EMAIL,
				severity: ValidationSeverity.ERROR,
				message: "Email address does not have a valid basic email structure.",
				value: row.email,
			}),
		];
	}

	return [];
}

function validateDate(
	row: NormalizedSheetRow,
	field: "Departure Date" | "Arrival Date",
	value: string,
): ValidationIssue[] {
	if (!value) {
		return [];
	}

	if (!parseSheetDate(value)) {
		return [
			createIssue(row, {
				field,
				code: ValidationIssueCode.INVALID_DATE,
				severity: ValidationSeverity.ERROR,
				message: `${field} is not a valid calendar date in the expected format.`,
				value,
			}),
		];
	}

	return [];
}

function validateTime(
	row: NormalizedSheetRow,
	field: "Departure Time" | "Arrival Time" | "Layover Begins" | "Layover Ends",
	value: string,
): ValidationIssue[] {
	if (!value) {
		return [];
	}

	if (!parse12HourTime(value)) {
		return [
			createIssue(row, {
				field,
				code: ValidationIssueCode.INVALID_TIME,
				severity: ValidationSeverity.ERROR,
				message: "Time must use valid 12-hour h:mm AM/PM format.",
				value,
			}),
		];
	}

	return [];
}

function validateRoute(row: NormalizedSheetRow): ValidationIssue[] {
	if (
		!row.origin ||
		!row.destination ||
		row.origin.toLowerCase() !== row.destination.toLowerCase()
	) {
		return [];
	}

	return [
		createIssue(row, {
			field: "Destination",
			code: ValidationIssueCode.ORIGIN_EQUALS_DESTINATION,
			severity: ValidationSeverity.ERROR,
			message: "Origin and destination cannot be the same.",
			value: row.destination,
		}),
	];
}

function validateDepartureAndArrival(
	row: NormalizedSheetRow,
): ValidationIssue[] {
	if (
		!row.departureDate ||
		!row.departureTime ||
		!row.arrivalDate ||
		!row.arrivalTime
	) {
		return [];
	}

	const departure = combineSheetDateAndTime(
		row.departureDate,
		row.departureTime,
	);

	const arrival = combineSheetDateAndTime(row.arrivalDate, row.arrivalTime);

	if (!departure || !arrival) {
		return [];
	}

	if (arrival < departure) {
		return [
			createIssue(row, {
				field: "Arrival Date / Arrival Time",
				code: ValidationIssueCode.ARRIVAL_BEFORE_DEPARTURE,
				severity: ValidationSeverity.ERROR,
				message: "Arrival date/time occurs before departure date/time.",
				value: `${row.arrivalDate} ${row.arrivalTime}`,
			}),
		];
	}

	return [];
}

function validateLayover(row: NormalizedSheetRow): ValidationIssue[] {
	const hasStart = Boolean(row.layoverBegins);
	const hasEnd = Boolean(row.layoverEnds);
	const hasDuration = Boolean(row.layoverDuration);
	const hasCity = Boolean(row.layoverCity);

	const issues: ValidationIssue[] = [];

	if (hasStart !== hasEnd) {
		issues.push(
			createIssue(row, {
				field: "Layover Begins / Layover Ends",
				code: ValidationIssueCode.LAYOVER_TIME_INCONSISTENT,
				severity: ValidationSeverity.WARNING,
				message:
					"Layover start and end times should either both be provided or both be blank.",
				value: `${row.layoverBegins} / ${row.layoverEnds}`,
			}),
		);
	}

	if (hasDuration && (!hasStart || !hasEnd)) {
		issues.push(
			createIssue(row, {
				field: "Layover Duration",
				code: ValidationIssueCode.LAYOVER_TIME_INCONSISTENT,
				severity: ValidationSeverity.WARNING,
				message:
					"Layover duration is provided without both layover start and end times.",
				value: row.layoverDuration,
			}),
		);
	}

	if (hasCity && !hasStart && !hasEnd) {
		issues.push(
			createIssue(row, {
				field: "Layover City",
				code: ValidationIssueCode.LAYOVER_TIME_INCONSISTENT,
				severity: ValidationSeverity.INFO,
				message:
					"Layover city is provided but layover start/end times are blank.",
				value: row.layoverCity,
			}),
		);
	}

	/*
	 * A layover has no date columns in the Sheet.
	 * Therefore we must not assume whether an end time belongs
	 * to the same day or the following day.
	 *
	 * If both times are valid but end < start, flag it rather
	 * than guessing an overnight layover.
	 */
	if (hasStart && hasEnd) {
		const start = parse12HourTime(row.layoverBegins);
		const end = parse12HourTime(row.layoverEnds);

		if (start && end) {
			const startMinutes = start.hours * 60 + start.minutes;
			const endMinutes = end.hours * 60 + end.minutes;

			if (endMinutes < startMinutes) {
				issues.push(
					createIssue(row, {
						field: "Layover Ends",
						code: ValidationIssueCode.LAYOVER_TIME_INCONSISTENT,
						severity: ValidationSeverity.WARNING,
						message:
							"Layover end time is earlier than its start time. No layover date is available, so the application will not assume an overnight layover.",
						value: row.layoverEnds,
					}),
				);
			}
		}
	}

	return issues;
}

function validateIncompleteRow(
	row: NormalizedSheetRow,
	issues: ValidationIssue[],
): ValidationIssue[] {
	const hasAnyData = Object.values(row.raw).some(
		(value) => value.trim() !== "",
	);

	if (!hasAnyData) {
		return [
			createIssue(row, {
				code: ValidationIssueCode.INCOMPLETE_ROW,
				severity: ValidationSeverity.INFO,
				message: "Sheet row is completely empty.",
			}),
		];
	}

	/*
	 * Missing required fields are already reported individually by
	 * REQUIRED_FIELD_MISSING. Do not create a redundant
	 * INCOMPLETE_ROW warning for the same condition.
	 *
	 * INCOMPLETE_ROW is reserved for a genuinely partial row where
	 * there is some flight information but the row is not sufficiently
	 * populated to represent a usable flight record.
	 */
	const hasFlightInformation =
		Boolean(row.origin) ||
		Boolean(row.destination) ||
		Boolean(row.departureDate) ||
		Boolean(row.departureTime) ||
		Boolean(row.arrivalDate) ||
		Boolean(row.arrivalTime);

	const hasNoUsableCoreData =
		!row.name &&
		!row.origin &&
		!row.destination &&
		!row.departureDate &&
		!row.departureTime &&
		!row.arrivalDate &&
		!row.arrivalTime &&
		!row.email;

	if (hasFlightInformation && !row.name) {
		return [
			createIssue(row, {
				code: ValidationIssueCode.INCOMPLETE_ROW,
				severity: ValidationSeverity.WARNING,
				message: "Row contains flight information but has no client name.",
			}),
		];
	}

	if (hasNoUsableCoreData) {
		return [
			createIssue(row, {
				code: ValidationIssueCode.INCOMPLETE_ROW,
				severity: ValidationSeverity.INFO,
				message: "Row contains no usable client or flight information.",
			}),
		];
	}

	return [];
}

export function validateSheetRow(row: NormalizedSheetRow): ValidationResult {
	const issues: ValidationIssue[] = [];

	issues.push(...validateRequiredFields(row));
	issues.push(...validateName(row));
	issues.push(...validateEmail(row));

	issues.push(...validateDate(row, "Departure Date", row.departureDate));

	issues.push(...validateDate(row, "Arrival Date", row.arrivalDate));

	issues.push(...validateTime(row, "Departure Time", row.departureTime));

	issues.push(...validateTime(row, "Arrival Time", row.arrivalTime));

	issues.push(...validateTime(row, "Layover Begins", row.layoverBegins));

	issues.push(...validateTime(row, "Layover Ends", row.layoverEnds));

	issues.push(...validateRoute(row));
	issues.push(...validateDepartureAndArrival(row));
	issues.push(...validateLayover(row));

	issues.push(...validateIncompleteRow(row, issues));

	const isValidForSync = !issues.some(
		(issue) => issue.severity === ValidationSeverity.ERROR,
	);

	return {
		row,
		issues,
		isValidForSync,
	};
}
