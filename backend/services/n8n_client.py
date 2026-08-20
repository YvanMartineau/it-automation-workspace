import logging
import httpx
from settings import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()
_warned_unconfigured: set[str] = set()


async def _trigger_webhook(webhook_url: str, payload: dict, label: str) -> bool:
    if not webhook_url:
        if label not in _warned_unconfigured:
            logger.warning("%s webhook URL not configured — skipping n8n call.", label)
            _warned_unconfigured.add(label)
        return False
    try:
        async with httpx.AsyncClient(timeout=settings.N8N_WEBHOOK_TIMEOUT_SECONDS) as client:
            response = await client.post(webhook_url, json=payload)
            if response.status_code != 200:
                logger.error("%s webhook returned %s for keys=%s", label, response.status_code, list(payload.keys()))
                return False
            return True
    except httpx.TimeoutException:
        logger.error("%s webhook timed out after %ss", label, settings.N8N_WEBHOOK_TIMEOUT_SECONDS)
        return False
    except httpx.HTTPError as err:
        logger.error("%s webhook call failed: %s", label, err)
        return False


async def trigger_onboarding_workflow(payload: dict) -> bool:
    return await _trigger_webhook(settings.N8N_ONBOARDING_WEBHOOK_URL, payload, "onboarding")


async def trigger_offboarding_workflow(payload: dict) -> bool:
    return await _trigger_webhook(settings.N8N_OFFBOARDING_WEBHOOK_URL, payload, "offboarding")