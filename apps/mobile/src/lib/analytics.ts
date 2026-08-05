import PostHog from 'posthog-react-native';

let postHogInstance: PostHog | null = null;

export const isAnalyticsEnabled = (): boolean => {
  const env = process.env.EXPO_PUBLIC_ENV;
  const apiKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
  return env === 'production' && typeof apiKey === 'string' && apiKey.length > 0;
};

export const getPostHogClient = (): PostHog | null => {
  if (!isAnalyticsEnabled()) {
    return null;
  }
  if (!postHogInstance) {
    const apiKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY!;
    const host = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';
    postHogInstance = new PostHog(apiKey, {
      host,
      captureAppLifecycleEvents: false,
    });
  }
  return postHogInstance;
};

export const resetPostHogClient = (): void => {
  postHogInstance = null;
};

export const trackAppOpened = (platform: string): void => {
  if (!isAnalyticsEnabled()) return;
  getPostHogClient()?.capture('app_opened', { platform });
};

export const trackTimetableViewed = (sectionCount: number, year: number): void => {
  if (!isAnalyticsEnabled()) return;
  getPostHogClient()?.capture('timetable_viewed', {
    section_count: sectionCount,
    year,
  });
};

export const trackOtpRequested = (): void => {
  if (!isAnalyticsEnabled()) return;
  getPostHogClient()?.capture('otp_requested');
};

export const trackSectionSearched = (queryLength: number): void => {
  if (!isAnalyticsEnabled()) return;
  getPostHogClient()?.capture('section_searched', {
    query_length: queryLength,
  });
};
