import { describe, expect, it } from "vitest";
import { buildScopeBody } from "../scope";

describe("buildScopeBody", () => {
	it("returns the selected year for year-mode scope", () => {
		expect(buildScopeBody("year", 4, "")).toEqual({
			section_ids: null,
			year: 4,
		});
	});

	it("returns a null year when no year button is selected", () => {
		expect(buildScopeBody("year", null, "")).toEqual({
			section_ids: null,
			year: null,
		});
	});

	it("returns parsed section ids for sections-mode scope, ignoring the year", () => {
		expect(buildScopeBody("sections", null, "1, 2, 3")).toEqual({
			section_ids: [1, 2, 3],
			year: null,
		});
	});
});
