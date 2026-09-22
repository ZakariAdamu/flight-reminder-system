import "dotenv/config";
import { definePrismaConfig } from "prisma/config";
import { defineConfig as definePostgresConfig } from "@prisma/orm-postgres/config";

export default definePrismaConfig({
	orm: definePostgresConfig({
		contract: "./prisma/contract.prisma",
		db: {
			connection: process.env["DATABASE_URL"]!,
		},
	}),

	skills: {
		agents: ["claude", "cursor", "agents", "devin"],
	},
});
