export function parse12HourTime(
	value: string,
): { hours: number; minutes: number } | null {
	const trimmed = value.trim();

	if (!trimmed) {
		return null;
	}

	const twentyFourHourMatch = /^(\d{1,2}):(\d{2})$/.exec(trimmed);

	if (twentyFourHourMatch) {
		const hours = Number(twentyFourHourMatch[1]);
		const minutes = Number(twentyFourHourMatch[2]);

		if (hours > 23 || minutes > 59) {
			return null;
		}

		return { hours, minutes };
	}

	const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(trimmed);

	if (!match) {
		return null;
	}

	const twelveHour = Number(match[1]);
	const minutes = Number(match[2]);

	if (twelveHour < 1 || twelveHour > 12 || minutes > 59) {
		return null;
	}

	const isPostMeridiem = match[3].toLowerCase() === "pm";
	const hours = (twelveHour % 12) + (isPostMeridiem ? 12 : 0);

	return { hours, minutes };
}

export function parseSheetDate(value: string): Date | null {
	const trimmed = value.trim();

	if (!trimmed) {
		return null;
	}

	const numericMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);

	if (numericMatch) {
		const day = Number(numericMatch[1]);
		const month = Number(numericMatch[2]) - 1;
		const year = Number(numericMatch[3]);
		const date = new Date(Date.UTC(year, month, day));

		if (
			date.getUTCFullYear() !== year ||
			date.getUTCMonth() !== month ||
			date.getUTCDate() !== day
		) {
			return null;
		}

		return date;
	}

	const match = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/.exec(trimmed);

	if (!match) {
		return null;
	}

	const day = Number(match[1]);
	const year = Number(match[3]);
	const monthNames = [
		"january",
		"february",
		"march",
		"april",
		"may",
		"june",
		"july",
		"august",
		"september",
		"october",
		"november",
		"december",
	];
	const month = monthNames.indexOf(match[2].toLowerCase());

	if (month === -1) {
		return null;
	}

	const date = new Date(Date.UTC(year, month, day));

	if (
		date.getUTCFullYear() !== year ||
		date.getUTCMonth() !== month ||
		date.getUTCDate() !== day
	) {
		return null;
	}

	return date;
}

export function combineSheetDateAndTime(
	dateValue: string,
	timeValue: string,
): Date | null {
	const date = parseSheetDate(dateValue);
	const time = parse12HourTime(timeValue);

	if (!date || !time) {
		return null;
	}

	date.setUTCHours(time.hours, time.minutes, 0, 0);

	return date;
}
