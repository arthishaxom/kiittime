import logging
from abc import ABC, abstractmethod

import resend

logger = logging.getLogger(__name__)


class EmailProvider(ABC):
    @abstractmethod
    def send_email(self, to: str, subject: str, html: str) -> bool:
        pass


class ConsoleEmailProvider(EmailProvider):
    """Fallback provider for development that prints to the console."""

    def send_email(self, to: str, subject: str, html: str) -> bool:
        logger.info("--- EMAIL SENT ---")
        logger.info(f"To: {to}")
        logger.info(f"Subject: {subject}")
        logger.info(f"Body: {html}")
        logger.info("------------------")
        return True


class ResendEmailProvider(EmailProvider):
    def __init__(self, api_key: str | None = None, from_email: str = "onboarding@resend.dev"):
        self.api_key = api_key
        self.from_email = from_email
        if api_key:
            resend.api_key = api_key

    def send_email(self, to: str, subject: str, html: str) -> bool:
        if not self.api_key:
            logger.warning("Resend API key is missing. Falling back to console.")
            console = ConsoleEmailProvider()
            return console.send_email(to, subject, html)

        try:
            params: resend.Emails.SendParams = {
                "from": self.from_email,
                "to": [to],
                "subject": subject,
                "html": html,
            }
            resend.Emails.send(params)
            logger.info(f"Email successfully sent to {to} via Resend SDK")
            return True
        except Exception as e:
            logger.error(f"Unexpected error when sending email via Resend SDK: {e}")
            return False
