import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("posthog-js", () => ({
	default: {
		init: vi.fn(),
		capture: vi.fn(),
	},
}));

import posthog from "posthog-js";
import {
	isAnalyticsEnabled,
	resetPostHogClient,
	trackAppOpened,
	trackOtpRequested,
	trackSectionSearched,
	trackTimetableViewed,
} from "../analytics";

describe("Webapp Analytics", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		resetPostHogClient();
		vi.stubEnv("VITE_POSTHOG_API_KEY", "");
		vi.stubEnv("VITE_ENV", "development");
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	describe("isAnalyticsEnabled", () => {
		it("returns false in development environment", () => {
			vi.stubEnv("VITE_POSTHOG_API_KEY", "phc_test_key");
			vi.stubEnv("VITE_ENV", "development");
			expect(isAnalyticsEnabled()).toBe(false);
		});

		it("returns false when API key is missing", () => {
			vi.stubEnv("VITE_ENV", "production");
			vi.stubEnv("VITE_POSTHOG_API_KEY", "");
			expect(isAnalyticsEnabled()).toBe(false);
		});

		it("returns true when VITE_ENV is production and API key is present", () => {
			vi.stubEnv("VITE_ENV", "production");
			vi.stubEnv("VITE_POSTHOG_API_KEY", "phc_test_key");
			expect(isAnalyticsEnabled()).toBe(true);
		});
	});

	describe("no-op behavior in non-production", () => {
		it("does not call posthog in dev/test environment", () => {
			vi.stubEnv("VITE_ENV", "development");
			vi.stubEnv("VITE_POSTHOG_API_KEY", "phc_test_key");

			trackAppOpened();
			trackTimetableViewed(2, 1);
			trackOtpRequested();
			trackSectionSearched(5);

			expect(posthog.init).not.toHaveBeenCalled();
			expect(posthog.capture).not.toHaveBeenCalled();
		});
	});

	describe("event capture in production", () => {
		beforeEach(() => {
			vi.stubEnv("VITE_ENV", "production");
			vi.stubEnv("VITE_POSTHOG_API_KEY", "phc_test_key");
			resetPostHogClient();
		});

		it("tracks app_opened with platform='web'", () => {
			trackAppOpened();
			expect(posthog.init).toHaveBeenCalled();
			expect(posthog.capture).toHaveBeenCalledWith("app_opened", { platform: "web" });
		});

		it("tracks timetable_viewed with section_count and year", () => {
			trackTimetableViewed(4, 3);
			expect(posthog.capture).toHaveBeenCalledWith("timetable_viewed", {
				section_count: 4,
				year: 3,
			});
		});

		it("tracks otp_requested without properties", () => {
			trackOtpRequested();
			expect(posthog.capture).toHaveBeenCalledWith("otp_requested");
		});

		it("tracks section_searched with query_length", () => {
			trackSectionSearched(7);
			expect(posthog.capture).toHaveBeenCalledWith("section_searched", {
				query_length: 7,
			});
		});

		it("never contains PII keys in captured properties", () => {
			trackAppOpened();
			trackTimetableViewed(2, 1);
			trackSectionSearched(4);

			const forbiddenKeys = [
				"roll_no",
				"rollNo",
				"email",
				"section_name",
				"sectionName",
				"section",
			];

			const mockCapture = posthog.capture as ReturnType<typeof vi.fn>;
			mockCapture.mock.calls.forEach((call) => {
				const props = call[1];
				if (props) {
					forbiddenKeys.forEach((key) => {
						expect(props).not.toHaveProperty(key);
					});
				}
			});
		});
	});
});
