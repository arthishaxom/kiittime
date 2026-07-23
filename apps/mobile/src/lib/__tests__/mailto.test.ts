import { buildMailto } from '@/lib/mailto';

describe('buildMailto', () => {
  it('builds a bare mailto link when no subject/body is given', () => {
    expect(buildMailto()).toBe('mailto:pothal.builds@gmail.com');
  });

  it('includes an encoded subject param', () => {
    expect(buildMailto({ subject: 'KIIT Time - Contact' })).toBe(
      'mailto:pothal.builds@gmail.com?subject=KIIT%20Time%20-%20Contact',
    );
  });

  it('includes both encoded subject and body params', () => {
    expect(buildMailto({ subject: 'Hi there', body: 'Please help' })).toBe(
      'mailto:pothal.builds@gmail.com?subject=Hi%20there&body=Please%20help',
    );
  });

  it('omits an empty body from the query string', () => {
    expect(buildMailto({ subject: 'Hi', body: '' })).toBe(
      'mailto:pothal.builds@gmail.com?subject=Hi',
    );
  });
});
