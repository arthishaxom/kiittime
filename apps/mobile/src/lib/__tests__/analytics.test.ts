const mockCapture = jest.fn();

jest.mock('posthog-react-native', () => {
  return jest.fn().mockImplementation(() => ({
    capture: mockCapture,
  }));
});

import {
  isAnalyticsEnabled,
  trackAppOpened,
  trackTimetableViewed,
  trackOtpRequested,
  trackSectionSearched,
  resetPostHogClient,
} from '../analytics';

describe('Mobile Analytics', () => {
  const originalExpoEnv = process.env.EXPO_PUBLIC_ENV;
  const originalApiKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;

  beforeEach(() => {
    mockCapture.mockClear();
    delete process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
    delete process.env.EXPO_PUBLIC_ENV;
    resetPostHogClient();
  });

  afterAll(() => {
    if (originalExpoEnv !== undefined) {
      process.env.EXPO_PUBLIC_ENV = originalExpoEnv;
    } else {
      delete process.env.EXPO_PUBLIC_ENV;
    }
    if (originalApiKey !== undefined) {
      process.env.EXPO_PUBLIC_POSTHOG_API_KEY = originalApiKey;
    } else {
      delete process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
    }
  });

  describe('isAnalyticsEnabled', () => {
    it('returns false in test/dev environment', () => {
      process.env.EXPO_PUBLIC_POSTHOG_API_KEY = 'phc_test_123';
      process.env.EXPO_PUBLIC_ENV = 'development';
      expect(isAnalyticsEnabled()).toBe(false);
    });

    it('returns false when API key is missing', () => {
      process.env.EXPO_PUBLIC_ENV = 'production';
      delete process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
      expect(isAnalyticsEnabled()).toBe(false);
    });

    it('returns true when environment is production and API key is set', () => {
      process.env.EXPO_PUBLIC_ENV = 'production';
      process.env.EXPO_PUBLIC_POSTHOG_API_KEY = 'phc_test_123';
      expect(isAnalyticsEnabled()).toBe(true);
    });
  });

  describe('no-op behavior in non-production', () => {
    it('does not capture events when disabled', () => {
      process.env.EXPO_PUBLIC_ENV = 'development';
      process.env.EXPO_PUBLIC_POSTHOG_API_KEY = 'phc_test_123';
      trackAppOpened('ios');
      trackTimetableViewed(2, 1);
      trackOtpRequested();
      trackSectionSearched(4);

      expect(mockCapture).not.toHaveBeenCalled();
    });
  });

  describe('event capture in production', () => {
    beforeEach(() => {
      process.env.EXPO_PUBLIC_ENV = 'production';
      process.env.EXPO_PUBLIC_POSTHOG_API_KEY = 'phc_test_123';
      resetPostHogClient();
    });

    it('tracks app_opened with platform property', () => {
      trackAppOpened('android');
      expect(mockCapture).toHaveBeenCalledWith('app_opened', { platform: 'android' });
    });

    it('tracks timetable_viewed with section_count and year', () => {
      trackTimetableViewed(3, 2);
      expect(mockCapture).toHaveBeenCalledWith('timetable_viewed', {
        section_count: 3,
        year: 2,
      });
    });

    it('tracks otp_requested without properties', () => {
      trackOtpRequested();
      expect(mockCapture).toHaveBeenCalledWith('otp_requested');
    });

    it('tracks section_searched with query_length', () => {
      trackSectionSearched(6);
      expect(mockCapture).toHaveBeenCalledWith('section_searched', {
        query_length: 6,
      });
    });

    it('never contains PII keys in captured properties', () => {
      trackAppOpened('ios');
      trackTimetableViewed(1, 1);
      trackSectionSearched(3);

      const forbiddenKeys = ['roll_no', 'rollNo', 'email', 'section_name', 'sectionName', 'section'];
      mockCapture.mock.calls.forEach((call: any[]) => {
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
