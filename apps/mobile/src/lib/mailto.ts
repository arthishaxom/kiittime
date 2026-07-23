const CONTACT_EMAIL = 'pothal.builds@gmail.com';

interface MailtoOptions {
  subject?: string;
  body?: string;
}

export function buildMailto({ subject, body }: MailtoOptions = {}): string {
  const params: string[] = [];
  if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
  if (body) params.push(`body=${encodeURIComponent(body)}`);
  const query = params.join('&');
  return `mailto:${CONTACT_EMAIL}${query ? `?${query}` : ''}`;
}
