import "temporal-polyfill/full/global";
import postgres from "@prisma/orm-postgres/runtime";
import type { Contract } from "../prisma/contract";
import contractJson from "../prisma/contract.json" with { type: "json" };

export const db = postgres<Contract>({
	contractJson,
	url: process.env.DATABASE_URL,
});
