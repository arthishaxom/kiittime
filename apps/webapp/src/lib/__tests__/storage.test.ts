import { beforeEach, describe, expect, it } from "vitest";
import {
	getLastSeenAnnouncementId,
	getSavedSectionIds,
	saveSectionIds,
	setLastSeenAnnouncementId,
} from "@kiittime/api/storage";

beforeEach(() => {
	localStorage.clear();
});

describe("getSavedSectionIds / saveSectionIds", () => {
	it("round-trips saved section ids", () => {
		saveSectionIds([1, 2, 3]);
		expect(getSavedSectionIds()).toEqual([1, 2, 3]);
	});

	it("returns null when nothing is saved", () => {
		expect(getSavedSectionIds()).toBeNull();
	});

	it("returns null for malformed data", () => {
		localStorage.setItem("kiit-time:selected-sections", "not json");
		expect(getSavedSectionIds()).toBeNull();

		localStorage.setItem(
			"kiit-time:selected-sections",
			JSON.stringify(["a", "b"]),
		);
		expect(getSavedSectionIds()).toBeNull();
	});
});

describe("getLastSeenAnnouncementId / setLastSeenAnnouncementId", () => {
	it("round-trips the last seen announcement id", () => {
		setLastSeenAnnouncementId(42);
		expect(getLastSeenAnnouncementId()).toBe(42);
	});

	it("returns null when nothing has been seen", () => {
		expect(getLastSeenAnnouncementId()).toBeNull();
	});

	it("returns null for malformed data", () => {
		localStorage.setItem("kiit-time:last-seen-announcement", "not json");
		expect(getLastSeenAnnouncementId()).toBeNull();
	});
});
