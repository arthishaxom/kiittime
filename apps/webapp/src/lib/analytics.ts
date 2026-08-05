import posthog from "posthog-js";

let initialized = false;

export const isAnalyticsEnabled = (): boolean => {
	const env = import.meta.env.VITE_ENV ?? (import.meta.env.PROD ? "production" : "development");
	const apiKey = import.meta.env.VITE_POSTHOG_API_KEY;
	return env === "production" && typeof apiKey === "string" && apiKey.length > 0;
};

export const initPostHog = (): void => {
	if (!isAnalyticsEnabled() || initialized) return;
	const apiKey = import.meta.env.VITE_POSTHOG_API_KEY!;
	const host = import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com";
	posthog.init(apiKey, {
		api_host: host,
		autocapture: false,
		capture_pageview: false,
		disable_session_recording: true,
	});
	initialized = true;
};

export const resetPostHogClient = (): void => {
	initialized = false;
};

export const trackAppOpened = (): void => {
	if (!isAnalyticsEnabled()) return;
	initPostHog();
	posthog.capture("app_opened", { platform: "web" });
};

export const trackTimetableViewed = (sectionCount: number, year: number): void => {
	if (!isAnalyticsEnabled()) return;
	initPostHog();
	posthog.capture("timetable_viewed", {
		section_count: sectionCount,
		year,
	});
};

export const trackOtpRequested = (): void => {
	if (!isAnalyticsEnabled()) return;
	initPostHog();
	posthog.capture("otp_requested");
};

export const trackSectionSearched = (queryLength: number): void => {
	if (!isAnalyticsEnabled()) return;
	initPostHog();
	posthog.capture("section_searched", {
		query_length: queryLength,
	});
};
