import "temporal-polyfill/full/global";
import postgres from "@prisma/orm-postgres/runtime";
import type { Contract } from "../prisma/contract";
import contractJson from "../prisma/contract.json" with { type: "json" };

const databaseUrl = process.env.DATABASE_URL?.trim();

export const db = postgres<Contract>({
	contractJson,
	url: databaseUrl,
});

let connectionPromise: ReturnType<typeof db.connect> | undefined;

export async function ensureDatabaseConnection(): Promise<void> {
	if (!databaseUrl) {
		throw new Error(
			"DATABASE_URL is not configured. Add it to the Vercel environment for this deployment.",
		);
	}

	if (!connectionPromise) {
		connectionPromise = db.connect().catch((error) => {
			connectionPromise = undefined;
			throw error;
		});
	}

	await connectionPromise;
}
