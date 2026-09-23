#!/usr/bin/env -S node
import type { Contract as Start } from "../../snapshots/5743c851c43874f6e24bb17311ca7e32f4842d6510949bd9045bfcca02ed0484/contract";
import startContract from "../../snapshots/5743c851c43874f6e24bb17311ca7e32f4842d6510949bd9045bfcca02ed0484/contract.json" with { type: "json" };
import type { Contract as End } from "../../snapshots/f32f24c63bfb30c97c6a30525daa8ff73c7f48d6f2890cd160684af7fdd88e2c/contract";
import endContract from "../../snapshots/f32f24c63bfb30c97c6a30525daa8ff73c7f48d6f2890cd160684af7fdd88e2c/contract.json" with { type: "json" };
import {
	Migration,
	MigrationCLI,
	col,
	placeholder,
} from "@prisma/orm-postgres/migration";
import postgres from "@prisma/orm-postgres/runtime";

const { sql: db, contract } = postgres<End>({ contractJson: endContract });

export default class M extends Migration<Start, End> {
	override readonly startContractJson = startContract;
	override readonly endContractJson = endContract;

	override get operations() {
		return [
			this.dropCheckConstraint({
				schema: "public",
				table: "auditLog",
				constraint: "auditLog_eventType_check_48274968",
			}),
			this.dropConstraint({
				schema: "public",
				table: "reminder",
				constraint: "reminder_flightId_key",
			}),
			this.addColumn({
				schema: "public",
				table: "reminder",
				column: col("type", "text", { codecRef: { codecId: "pg/text@1" } }),
			}),
			this.dataTransform(contract, "backfill-reminder-type", {
				check: () =>
					db.public.reminder
						.select("id")
						.where((fields, functions) => functions.eq(fields.type, null))
						.limit(1),
				run: () =>
					db.public.reminder
						.update({ type: "CLIENT" })
						.where((fields, functions) => functions.eq(fields.type, null)),
			}),

			this.setNotNull({ schema: "public", table: "reminder", column: "type" }),
			this.addCheckConstraint({
				schema: "public",
				table: "auditLog",
				constraint: "auditLog_eventType_check_26bd1712",
				expression:
					"\"eventType\" IN ('TRAVELLER_CREATED', 'TRAVELLER_UPDATED', 'FLIGHT_CREATED', 'FLIGHT_UPDATED', 'REMINDER_CREATED', 'ADMIN_REMINDER_DUE', 'ADMIN_REMINDER_SENT', 'CLIENT_REMINDER_DUE', 'CLIENT_REMINDER_SENT', 'ADMIN_CONFIRMATION_SENT', 'REMINDER_FAILED', 'REMINDER_RETRY_SCHEDULED', 'REMINDER_CANCELLED')",
			}),
			this.addCheckConstraint({
				schema: "public",
				table: "reminder",
				constraint: "reminder_type_check_2fe6c749",
				expression: "\"type\" IN ('ADMIN', 'CLIENT')",
			}),
			this.addUnique({
				schema: "public",
				table: "reminder",
				constraint: "reminder_flightId_type_key",
				columns: ["flightId", "type"],
			}),
			this.createIndex({
				schema: "public",
				table: "reminder",
				index: "reminder_flightId_idx_7ef5148f",
				columns: ["flightId"],
			}),
		];
	}
}

MigrationCLI.run(import.meta.url, M);
