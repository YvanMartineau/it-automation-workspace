"""SQLAlchemy Device model — discovered/managed network hosts."""
import enum
import uuid

from sqlalchemy import DateTime, Enum, Float, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from db.engine import Base


class DeviceStatus(str, enum.Enum):
    online = "online"
    offline = "offline"
    unknown = "unknown"


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    hostname: Mapped[str | None] = mapped_column(String(255), nullable=True)
    ip_address: Mapped[str] = mapped_column(String(45), unique=True, nullable=False, index=True)
    mac_address: Mapped[str | None] = mapped_column(String(17), nullable=True)
    status: Mapped[DeviceStatus] = mapped_column(
        Enum(DeviceStatus, name="device_status"), default=DeviceStatus.unknown, nullable=False
    )
    cpu_percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    memory_percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    os_info: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Approximate round-trip time from the most recent scan's `-sn` pass,
    # in milliseconds. Wall-clock timing of the nmap subprocess call, not
    # nmap's internal probe RTT — see services/scanner.py's module
    # docstring for why. Good enough for a relative "is this host slow to
    # respond" signal, not a precision network-diagnostics figure.
    latency_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    # list[{"port": int, "service": str}] from the most recent scan's
    # `-O -F` pass (top-100 TCP ports). Only populated for hosts that
    # answered the ping sweep — see scanner.py's two-phase design.
    open_ports: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    last_seen: Mapped["DateTime | None"] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped["DateTime"] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped["DateTime | None"] = mapped_column(
        DateTime(timezone=True), onupdate=func.now(), nullable=True
    )