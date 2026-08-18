"""
Non-blocking n8n webhook client. ADR-007: n8n is fire-and-continue, never
in the critical path — missing config, a timeout, or a bad response must
never fail onboarding itself.
"""

import logging

import httpx

from settings import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()
_warned_unconfigured = False


async def trigger_onboarding_workflow(payload: dict) -> bool:
    global _warned_unconfigured

    if not settings.N8N_ONBOARDING_WEBHOOK_URL:
        if not _warned_unconfigured:
            logger.warning("N8N_ONBOARDING_WEBHOOK_URL not configured — skipping n8n call.")
            _warned_unconfigured = True
        return False

    try:
        async with httpx.AsyncClient(timeout=settings.N8N_WEBHOOK_TIMEOUT_SECONDS) as client:
            response = await client.post(settings.N8N_ONBOARDING_WEBHOOK_URL, json=payload)
            if response.status_code != 200:
                logger.error("n8n webhook returned %s for keys=%s", response.status_code, list(payload.keys()))
                return False
            return True
    except httpx.TimeoutException:
        logger.error("n8n webhook timed out after %ss", settings.N8N_WEBHOOK_TIMEOUT_SECONDS)
        return False
    except httpx.HTTPError as err:
        logger.error("n8n webhook call failed: %s", err)
        return False