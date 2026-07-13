const CONTACT_EMAIL = "pothal.builds@gmail.com";

interface MailtoOptions {
  subject?: string;
  body?: string;
}

export function buildMailto({ subject, body }: MailtoOptions = {}): string {
  const params = new URLSearchParams();
  if (subject) params.set("subject", subject);
  if (body) params.set("body", body);
  const query = params.toString();
  return `mailto:${CONTACT_EMAIL}${query ? `?${query}` : ""}`;
}
