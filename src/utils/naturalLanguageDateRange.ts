import * as chrono from "chrono-node";
import { parseDateToLocal } from "./dateUtils";

const MINUTES_PER_DAY = 24 * 60;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const MONTH_NAMES =
	"jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
const MONTH_BY_PREFIX: Record<string, number> = {
	jan: 0,
	feb: 1,
	mar: 2,
	apr: 3,
	may: 4,
	jun: 5,
	jul: 6,
	aug: 7,
	sep: 8,
	oct: 9,
	nov: 10,
	dec: 11,
};

type DateRange = {
	start: Date;
	end: Date;
};

type ChronoRangeCandidate = {
	start: {
		date(): Date;
		isCertain(component: string): boolean;
	};
	end?: {
		date(): Date;
		isCertain(component: string): boolean;
	};
};

export function inferInclusiveDateRangeMinutes(
	title: string,
	referenceDateValue?: string
): number | undefined {
	const referenceDate = getReferenceDate(referenceDateValue);
	const range = parseChronoRange(title, referenceDate) ?? parseDayOnlyRange(title, referenceDate);
	if (!range) {
		return undefined;
	}

	const startDay = Date.UTC(
		range.start.getFullYear(),
		range.start.getMonth(),
		range.start.getDate()
	);
	const endDay = Date.UTC(
		range.end.getFullYear(),
		range.end.getMonth(),
		range.end.getDate()
	);
	if (endDay < startDay) {
		return undefined;
	}

	return (Math.round((endDay - startDay) / MILLISECONDS_PER_DAY) + 1) * MINUTES_PER_DAY;
}

function getReferenceDate(value?: string): Date {
	if (value) {
		const parsed = parseDateToLocal(value);
		if (!Number.isNaN(parsed.getTime())) {
			return parsed;
		}
	}
	return new Date();
}

function parseChronoRange(title: string, referenceDate: Date): DateRange | undefined {
	const results = chrono.parse(title, referenceDate, {
		forwardDate: false,
	}) as ChronoRangeCandidate[];
	const result = results.find(
		(candidate) =>
			candidate.end &&
			candidate.start.isCertain("day") &&
			candidate.end.isCertain("day")
	);
	if (!result?.end) {
		return undefined;
	}

	return {
		start: result.start.date(),
		end: result.end.date(),
	};
}

function parseDayOnlyRange(title: string, referenceDate: Date): DateRange | undefined {
	const rangePattern = new RegExp(
		`\\b(?:from\\s+|between\\s+)?(?:the\\s+)?(\\d{1,2})(?:st|nd|rd|th)` +
			`(?:\\s+(${MONTH_NAMES})(?:\\s*,?\\s*(\\d{4}))?)?` +
			`\\s*(?:to|through|until|and|[-–—])\\s*(?:the\\s+)?` +
			`(\\d{1,2})(?:st|nd|rd|th)` +
			`(?:\\s+(${MONTH_NAMES})(?:\\s*,?\\s*(\\d{4}))?)?\\b`,
		"iu"
	);
	const match = title.match(rangePattern);
	if (!match) {
		return undefined;
	}

	const startDay = Number(match[1]);
	const startMonth = parseMonth(match[2]) ?? parseMonth(match[5]) ?? referenceDate.getMonth();
	const startYear = Number(match[3] || match[6]) || referenceDate.getFullYear();
	const endDay = Number(match[4]);
	let endMonth = parseMonth(match[5]) ?? startMonth;
	let endYear = Number(match[6]) || startYear;
	const start = createValidatedDate(startYear, startMonth, startDay);
	if (!start) {
		return undefined;
	}

	if (!match[5] && endDay < startDay) {
		endMonth = startMonth + 1;
	} else if (!match[6] && endMonth < startMonth) {
		endYear += 1;
	}
	const end = createValidatedDate(endYear, endMonth, endDay);
	return end ? { start, end } : undefined;
}

function parseMonth(value?: string): number | undefined {
	return value ? MONTH_BY_PREFIX[value.slice(0, 3).toLowerCase()] : undefined;
}

function createValidatedDate(year: number, month: number, day: number): Date | undefined {
	const date = new Date(year, month, day, 12);
	const expectedYear = year + Math.floor(month / 12);
	const expectedMonth = ((month % 12) + 12) % 12;
	if (
		date.getFullYear() !== expectedYear ||
		date.getMonth() !== expectedMonth ||
		date.getDate() !== day
	) {
		return undefined;
	}
	return date;
}
