"""
schemas/scan.py

Pydantic schemas for the network scan feature.

"""

import ipaddress
from uuid import UUID

from pydantic import BaseModel, ConfigDict, field_validator

# The three RFC 1918 private-address supernets. A submitted subnet must be
# fully contained within one of these — not merely "look private".
_ALLOWED_PRIVATE_SUPERNETS = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
]

# A /22 is 1024 addresses. Semaphore(50) bounds *concurrent* scans, not the
# size of the initial task list — asyncio.gather() still builds one task per
# host up front. Without a cap, a client-submitted 10.0.0.0/8 would try to
# create ~16.7M coroutines before the semaphore ever gets a chance to help.
_MAX_SCAN_ADDRESSES = 1024


class ScanRequest(BaseModel):
    subnet: str

    @field_validator("subnet")
    @classmethod
    def validate_private_subnet(cls, value: str) -> str:
        """
        Reject anything that isn't a valid IPv4 CIDR block fully contained
        within one of the three RFC 1918 ranges.

        Spec called for a regex against RFC 1918 ranges. Using
        ipaddress.ip_network().subnet_of() instead of a hand-rolled regex:
        it's stdlib (already used in services/scanner.py for host
        enumeration), and it can't misparse a boundary the way a regex over
        CIDR strings can — e.g. 172.32.0.0/16 "looks" like it could be in
        172.16.0.0/12 to a loosely written regex, but subnet_of() gets the
        bit-math right without needing special-casing. Same allow-list,
        more reliable enforcement of it.
        """
        try:
            network = ipaddress.ip_network(value, strict=False)
        except ValueError as err:
            raise ValueError(f"'{value}' is not a valid IPv4 CIDR block") from err

        if not isinstance(network, ipaddress.IPv4Network):
            raise ValueError("Only IPv4 subnets are supported")

        if not any(network.subnet_of(allowed) for allowed in _ALLOWED_PRIVATE_SUPERNETS):
            raise ValueError(
                "Subnet must be within a private RFC 1918 range "
                "(10.0.0.0/8, 172.16.0.0/12, or 192.168.0.0/16)"
            )

        if network.num_addresses > _MAX_SCAN_ADDRESSES:
            raise ValueError(
                f"Subnet too large ({network.num_addresses} addresses). "
                f"Maximum allowed is a /22 ({_MAX_SCAN_ADDRESSES} addresses)."
            )

        # Normalize to the network's base address so downstream code (the
        # scanner, job_store, audit payload) all see the same canonical
        # string regardless of what host bits the client sent.
        return str(network)


class ScanStartResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    job_id: UUID
    status: str = "started"


class ScanProgressData(BaseModel):
    """
    Shape of the SSE 'progress' event payload.

    Documented for OpenAPI; not used to validate the wire event directly,
    since sse-starlette streams are outside FastAPI's response_model
    validation path.
    """

    model_config = ConfigDict(from_attributes=True)

    hosts_found: int
    hosts_scanned: int
    current_host: str | None = None


class ScanCompleteData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    total_hosts: int
    online: int
    offline: int


class ScanErrorData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    message: str
