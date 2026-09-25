import "temporal-polyfill/full/global";
import { Temporal } from "temporal-polyfill";
import type { Timestamptz } from "@prisma/orm-postgres/target/codec-types";

import { db } from "../db";
import type { ValidationIssue } from "./types";

const now = (): Timestamptz =>
	Temporal.Instant.fromEpochMilliseconds(Date.now()) as unknown as Timestamptz;

export async function persistValidationIssues(
	issues: ValidationIssue[],
): Promise<void> {
	const seenAt = now();
	const fingerprints = new Set(issues.map((issue) => issue.fingerprint));

	for (const issue of issues) {
		const existing = await db.orm.public.ValidationIssue.where({
			fingerprint: issue.fingerprint,
		}).first();

		if (existing) {
			await db.orm.public.ValidationIssue.where({
				fingerprint: issue.fingerprint,
			}).update({
				lastSeenAt: seenAt,
				resolvedAt: null,
				value: issue.value ?? null,
				message: issue.message,
				severity: issue.severity,
			});
			continue;
		}

		try {
			await db.orm.public.ValidationIssue.create({
				fingerprint: issue.fingerprint,
				sheetRow: issue.sheetRow,
				field: issue.field ?? null,
				code: issue.code,
				severity: issue.severity,
				value: issue.value ?? null,
				message: issue.message,
				firstSeenAt: seenAt,
				lastSeenAt: seenAt,
				resolvedAt: null,
			});
		} catch {
			await db.orm.public.ValidationIssue.where({
				fingerprint: issue.fingerprint,
			}).update({
				lastSeenAt: seenAt,
				resolvedAt: null,
				value: issue.value ?? null,
				message: issue.message,
				severity: issue.severity,
			});
		}
	}

	const openIssues = await db.orm.public.ValidationIssue.where(
		(validationIssue) => validationIssue.resolvedAt.isNull(),
	)
		.select("fingerprint")
		.all();

	for (const issue of openIssues) {
		if (fingerprints.has(issue.fingerprint)) {
			continue;
		}

		await db.orm.public.ValidationIssue.where({
			fingerprint: issue.fingerprint,
		}).update({ resolvedAt: seenAt });
	}
}
