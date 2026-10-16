import "temporal-polyfill/full/global";
import postgres from "@prisma/orm-postgres/runtime";
import type { Contract } from "../prisma/contract";
import contractJson from "../prisma/contract.json" with { type: "json" };

function resolveDatabaseUrl(): string {
	const databaseUrl =
		process.env.DATABASE_URL ??
		process.env.POSTGRES_URL ??
		process.env.PRISMA_DATABASE_URL;

	if (!databaseUrl || !databaseUrl.trim()) {
		throw new Error(
			"DATABASE_URL is not configured. Set DATABASE_URL, POSTGRES_URL, or PRISMA_DATABASE_URL to a valid PostgreSQL connection string.",
		);
	}

	return databaseUrl.trim();
}

const databaseUrl = resolveDatabaseUrl();

export const db = postgres<Contract>({
	contractJson,
	url: databaseUrl,
});

let connectionPromise: ReturnType<typeof db.connect> | undefined;

export async function ensureDatabaseConnection(): Promise<void> {
	if (!connectionPromise) {
		connectionPromise = db.connect().catch((error) => {
			connectionPromise = undefined;
			throw error;
		});
	}

	await connectionPromise;
}
