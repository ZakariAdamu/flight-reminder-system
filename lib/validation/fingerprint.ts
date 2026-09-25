import { createHash } from "node:crypto";

type FingerprintInput = {
	sheetRow: number;
	field?: string;
	code: string;
	value?: string;
	message: string;
};

export function createValidationFingerprint(input: FingerprintInput): string {
	const source = [
		input.sheetRow,
		input.field ?? "",
		input.code,
		input.value ?? "",
		input.message,
	].join("|");

	return createHash("sha256").update(source).digest("hex");
}
