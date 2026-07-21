import { buildShareMessage, buildShareUrl } from '@/lib/share';

describe('buildShareUrl', () => {
  it('builds a webapp timetable URL with one section_id param per id', () => {
    const url = buildShareUrl([1, 2, 3]);
    const parsed = new URL(url);

    expect(parsed.origin).toBe('https://kiittime.apothal.dev');
    expect(parsed.pathname).toBe('/timetable');
    expect(parsed.searchParams.getAll('section_id')).toEqual(['1', '2', '3']);
  });

  it('builds a URL with no section_id params for an empty list', () => {
    const url = buildShareUrl([]);
    expect(new URL(url).searchParams.getAll('section_id')).toEqual([]);
  });
});

describe('buildShareMessage', () => {
  it('embeds the share URL in the message text so Android recipients get a usable link', () => {
    const message = buildShareMessage([1]);
    expect(message).toContain('Check out my class schedule');
    expect(message).toContain(buildShareUrl([1]));
  });
});

describe('buildShareUrl dynamic environment config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('uses EXPO_PUBLIC_WEBAPP_URL when provided', () => {
    process.env.EXPO_PUBLIC_WEBAPP_URL = 'https://custom.test.domain';
    const { buildShareUrl: dynamicBuild } = require('@/lib/share');
    
    const url = dynamicBuild([1, 2]);
    expect(url).toBe('https://custom.test.domain/timetable?section_id=1&section_id=2');
  });

  it('falls back to kiittime.apothal.dev if no env var is provided', () => {
    delete process.env.EXPO_PUBLIC_WEBAPP_URL;
    const { buildShareUrl: dynamicBuild } = require('@/lib/share');
    
    const url = dynamicBuild([3]);
    expect(url).toBe('https://kiittime.apothal.dev/timetable?section_id=3');
  });
});
