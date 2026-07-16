import { parseSectionIds, timetableHref } from '@/lib/search-params';

describe('parseSectionIds', () => {
  it('returns an empty array when the param is undefined', () => {
    expect(parseSectionIds(undefined)).toEqual([]);
  });

  it('wraps a single numeric string into a one-element array', () => {
    expect(parseSectionIds('3')).toEqual([3]);
  });

  it('maps an array of numeric strings to numbers', () => {
    expect(parseSectionIds(['1', '2', '3'])).toEqual([1, 2, 3]);
  });

  it('falls back to an empty array for a non-numeric string', () => {
    expect(parseSectionIds('abc')).toEqual([]);
  });

  it('falls back to an empty array when any entry in the array is non-numeric', () => {
    expect(parseSectionIds(['1', 'abc', '3'])).toEqual([]);
  });

  it('falls back to an empty array for an empty string', () => {
    expect(parseSectionIds('')).toEqual([]);
  });
});

describe('timetableHref', () => {
  it('builds a single repeated section_id query param per id', () => {
    expect(timetableHref([12, 34])).toBe('/timetable?section_id=12&section_id=34');
  });

  it('round-trips through parseSectionIds via the array shape useLocalSearchParams produces for repeated keys', () => {
    const href = timetableHref([12, 34]);
    const query = href.split('?')[1];
    const parsed = new URLSearchParams(query).getAll('section_id');
    expect(parseSectionIds(parsed)).toEqual([12, 34]);
  });

  it('produces a single-key href for one section', () => {
    expect(timetableHref([7])).toBe('/timetable?section_id=7');
  });
});
