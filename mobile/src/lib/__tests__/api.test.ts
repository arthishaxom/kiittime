import { fetchSections, fetchTimetable, formatTime } from '@/lib/api';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  jest.restoreAllMocks();
});

describe('fetchSections', () => {
  it('requests /sections/ with a year query param and returns parsed JSON', async () => {
    const sections = [{ id: 1, section_name: 'CSE-1', year: 1 }];
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(sections),
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const result = await fetchSections(1);

    expect(result).toEqual(sections);
    const requestedUrl = new URL(mockFetch.mock.calls[0][0] as string);
    expect(requestedUrl.pathname).toBe('/sections/');
    expect(requestedUrl.searchParams.get('year')).toBe('1');
  });

  it('omits the year query param when year is undefined', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    await fetchSections();

    const requestedUrl = new URL(mockFetch.mock.calls[0][0] as string);
    expect(requestedUrl.searchParams.has('year')).toBe(false);
  });

  it('throws when the response is not ok', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;

    await expect(fetchSections(1)).rejects.toThrow('Failed to fetch sections: 500');
  });
});

describe('fetchTimetable', () => {
  it('appends one section_id param per id and returns parsed JSON', async () => {
    const timetable = { sections_requested: ['CSE-1'], sessions: [] };
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(timetable),
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const result = await fetchTimetable([1, 2]);

    expect(result).toEqual(timetable);
    const requestedUrl = new URL(mockFetch.mock.calls[0][0] as string);
    expect(requestedUrl.pathname).toBe('/timetable/');
    expect(requestedUrl.searchParams.getAll('section_id')).toEqual(['1', '2']);
  });

  it('throws when the response is not ok', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 }) as unknown as typeof fetch;

    await expect(fetchTimetable([1])).rejects.toThrow('Failed to fetch timetable: 404');
  });
});

describe('formatTime', () => {
  it.each([
    ['09:00:00', /9:00\s*AM/i],
    ['13:30:00', /1:30\s*PM/i],
    ['00:05:00', /12:05\s*AM/i],
  ])('formats %s as a locale time string matching %s', (input, expected) => {
    expect(formatTime(input)).toMatch(expected);
  });
});
