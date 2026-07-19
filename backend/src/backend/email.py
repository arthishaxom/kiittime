import json
import logging
import urllib.request
import urllib.error
from abc import ABC, abstractmethod
from typing import Optional

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
    def __init__(self, api_key: Optional[str] = None, from_email: str = "onboarding@resend.dev"):
        self.api_key = api_key
        self.from_email = from_email

    def send_email(self, to: str, subject: str, html: str) -> bool:
        if not self.api_key:
            logger.warning("Resend API key is missing. Falling back to console.")
            console = ConsoleEmailProvider()
            return console.send_email(to, subject, html)

        url = "https://api.resend.com/emails"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "from": self.from_email,
            "to": [to],
            "subject": subject,
            "html": html,
        }

        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )

        try:
            with urllib.request.urlopen(req) as response:
                status_code = response.getcode()
                if 200 <= status_code < 300:
                    logger.info(f"Email successfully sent to {to} via Resend")
                    return True
                else:
                    logger.error(f"Failed to send email via Resend, status: {status_code}")
                    return False
        except urllib.error.URLError as e:
            logger.error(f"URLError when sending email via Resend: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error when sending email via Resend: {e}")
            return False
