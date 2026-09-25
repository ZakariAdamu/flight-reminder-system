import type { NormalizedSheetRow } from "../google-sheets/normalize";

export enum ValidationSeverity {
	INFO = "INFO",
	WARNING = "WARNING",
	ERROR = "ERROR",
}

export enum ValidationIssueCode {
	INCOMPLETE_ROW = "INCOMPLETE_ROW",
	REQUIRED_FIELD_MISSING = "REQUIRED_FIELD_MISSING",

	INVALID_NAME = "INVALID_NAME",
	INVALID_EMAIL = "INVALID_EMAIL",

	INVALID_DATE = "INVALID_DATE",
	INVALID_TIME = "INVALID_TIME",
	AMBIGUOUS_TIME_FORMAT = "AMBIGUOUS_TIME_FORMAT",

	ARRIVAL_BEFORE_DEPARTURE = "ARRIVAL_BEFORE_DEPARTURE",

	ORIGIN_EQUALS_DESTINATION = "ORIGIN_EQUALS_DESTINATION",

	LAYOVER_TIME_INCONSISTENT = "LAYOVER_TIME_INCONSISTENT",
	LAYOVER_DURATION_MISMATCH = "LAYOVER_DURATION_MISMATCH",

	DUPLICATE_FLIGHT = "DUPLICATE_FLIGHT",

	REMINDER_DATE_MISMATCH = "REMINDER_DATE_MISMATCH",
}

export type ValidationIssue = {
	sheetRow: number;
	field?: string;

	code: ValidationIssueCode;
	severity: ValidationSeverity;

	message: string;
	value?: string;

	/**
	 * Deterministic identifier for the same validation problem.
	 * This will later be persisted in PostgreSQL.
	 */
	fingerprint: string;
};

export type ValidationResult = {
	row: NormalizedSheetRow;
	issues: ValidationIssue[];
	isValidForSync: boolean;
};
