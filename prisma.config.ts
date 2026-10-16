import "dotenv/config";
import { definePrismaConfig } from "prisma/config";
import { defineConfig as definePostgresConfig } from "@prisma/orm-postgres/config";

function resolveDatabaseUrl(): string {
	const databaseUrl =
		process.env["DATABASE_URL"] ??
		process.env["POSTGRES_URL"] ??
		process.env["PRISMA_DATABASE_URL"];

	if (!databaseUrl || !databaseUrl.trim()) {
		throw new Error(
			"DATABASE_URL is not configured. Set DATABASE_URL, POSTGRES_URL, or PRISMA_DATABASE_URL to a valid PostgreSQL connection string.",
		);
	}

	return databaseUrl.trim();
}

export default definePrismaConfig({
	orm: definePostgresConfig({
		contract: "./prisma/contract.prisma",
		db: {
			connection: resolveDatabaseUrl(),
		},
	}),

	skills: {
		agents: ["claude", "cursor", "agents", "devin"],
	},
});
