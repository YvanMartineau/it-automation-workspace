import asyncio
import logging
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import aiosmtplib
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from settings import get_settings

# Public Google OAuth2 endpoint (not a secret)
GMAIL_OAUTH_TOKEN_URI = "https://oauth2.googleapis.com/token"

logger = logging.getLogger(__name__)


def _get_gmail_oauth2_access_token() -> str:
    """
    Refreshes and returns an active OAuth2 access token for Gmail SMTP authentication.
    """
    creds = Credentials(
        token=None,
        refresh_token=get_settings.GMAIL_OAUTH_REFRESH_TOKEN,
        token_uri=GMAIL_OAUTH_TOKEN_URI, # nosec S106
        client_id=get_settings.GMAIL_OAUTH_CLIENT_ID,
        client_secret=get_settings.GMAIL_OAUTH_CLIENT_SECRET,
    )

    # Synchronously refresh the OAuth2 token
    creds.refresh(Request())
    if not creds.token:
        raise ValueError("Failed to refresh Gmail OAuth2 access token.")
    return creds.token


async def send_email_with_attachment(
    to_email: str,
    subject: str,
    body: str,
    attachment_bytes: bytes,
    filename: str = "report.pdf",
) -> None:
    """
    Sends an email with a PDF attachment via Gmail SMTP using OAuth2 authentication.
    Runs OAuth2 token retrieval in an executor to maintain async non-blocking execution.
    """
    # 1. Retrieve fresh OAuth2 access token asynchronously
    loop = asyncio.get_running_loop()
    access_token = await loop.run_in_executor(None, _get_gmail_oauth2_access_token)

    # 2. Build MIME Message
    message = MIMEMultipart()
    message["From"] = get_settings.GMAIL_SENDER_EMAIL
    message["To"] = to_email
    message["Subject"] = subject

    # Attach Plain Text Body
    message.attach(MIMEText(body, "plain", "utf-8"))

    # Attach PDF Document
    pdf_attachment = MIMEApplication(attachment_bytes, _subtype="pdf")
    pdf_attachment.add_header("Content-Disposition", "attachment", filename=filename)
    message.attach(pdf_attachment)

    # 3. Send Email via Async SMTP
    smtp_client = aiosmtplib.SMTP(
        hostname="smtp.gmail.com",
        port=587,
        start_tls=True,
        timeout=15.0,
    )

    await smtp_client.connect()
    try:
        # XOAUTH2 Authentication
        await smtp_client.auth_xoauth2(
            username=get_settings.GMAIL_SENDER_EMAIL,
            access_token=access_token,
        )
        await smtp_client.send_message(message)
        logger.info(f"Report successfully emailed to {to_email}")
    finally:
        await smtp_client.quit()
