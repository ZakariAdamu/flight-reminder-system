import "dotenv/config";
import { getSheetValues } from "../lib/google-sheets";

async function main() {
	const values = await getSheetValues();

	console.log(`Rows received: ${values.length}`);

	if (values.length > 0) {
		console.log("Headers:");
		console.log(values[0]);

		console.log("\nFirst data row:");
		console.log(values[1] ?? "No data rows found.");
	}
}

main().catch((error) => {
	console.error("Google Sheets test failed:");
	console.error(error);
	process.exit(1);
});
