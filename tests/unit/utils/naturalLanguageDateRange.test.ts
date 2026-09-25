import { parse } from "chrono-node";
import { inferInclusiveDateRangeMinutes } from "../../../src/utils/naturalLanguageDateRange";

const chronoParse = parse as jest.Mock;

function chronoRange(start: Date, end: Date) {
	return {
		start: {
			date: () => start,
			isCertain: (component: string) => component === "day",
		},
		end: {
			date: () => end,
			isCertain: (component: string) => component === "day",
		},
	};
}

describe("inferInclusiveDateRangeMinutes", () => {
	beforeEach(() => {
		chronoParse.mockReset();
		chronoParse.mockReturnValue([]);
	});

	it("anchors day-only ranges to the scheduled month and includes both dates", () => {
		expect(
			inferInclusiveDateRangeMinutes(
				"Naomi away from 14th to the 27th",
				"2026-09-14"
			)
		).toBe(14 * 24 * 60);
	});

	it("parses ranges that include month and year", () => {
		chronoParse.mockReturnValue([
			chronoRange(new Date(2027, 8, 14, 12), new Date(2027, 8, 27, 12)),
		]);
		expect(
			inferInclusiveDateRangeMinutes(
				"Naomi away from September 14th to September 27th, 2027",
				"2026-09-14"
			)
		).toBe(14 * 24 * 60);
	});

	it("uses a shared trailing month and year for both range endpoints", () => {
		expect(
			inferInclusiveDateRangeMinutes(
				"Naomi away from 14th to the 27th October 2027",
				"2026-09-14"
			)
		).toBe(14 * 24 * 60);
	});

	it("handles ranges crossing a month and year boundary", () => {
		chronoParse.mockReturnValue([
			chronoRange(new Date(2026, 11, 28, 12), new Date(2027, 0, 5, 12)),
		]);
		expect(
			inferInclusiveDateRangeMinutes(
				"Naomi away from 28th December 2026 to 5th January 2027",
				"2026-12-28"
			)
		).toBe(9 * 24 * 60);
	});

	it("rolls an implicit end date into the following month", () => {
		expect(
			inferInclusiveDateRangeMinutes("Naomi away from 28th to the 5th", "2026-12-28")
		).toBe(9 * 24 * 60);
	});

	it("ignores titles without a date range", () => {
		expect(
			inferInclusiveDateRangeMinutes("Naomi away for the afternoon", "2026-09-14")
		).toBeUndefined();
	});
});
