import { buildShareMessage, buildShareUrl } from '@/lib/share';

describe('buildShareUrl', () => {
  it('builds a webapp timetable URL with one section_id param per id', () => {
    const url = buildShareUrl([1, 2, 3]);
    const parsed = new URL(url);

    expect(parsed.origin).toBe('https://kiittime.vercel.app');
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
