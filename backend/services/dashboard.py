import asyncio
from datetime import datetime, timedelta, timezone

from sqlalchemy import case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.audit_log import AuditLog
from models.device import Device, DeviceStatus
from models.device_health_history import DeviceHealthHistory
from models.onboarded_user import OnboardedUser, OnboardJobStatus
from schemas.dashboard import (
    AuditActivityItem,
    AuditActivityType,
    DashboardSnapshot,
    DashboardStats,
    HealthStatus,
    HealthTrendPoint,
    OnboardingVolumePoint,
    OSDistributionItem,
)

# ---------------------------------------------------------------------------
# In-memory cache (module-level). Replace with Redis before running more
# than one worker process — each worker would otherwise keep its own
# independent cache/TTL, defeating the point.
# ---------------------------------------------------------------------------
_dashboard_cache: DashboardSnapshot | None = None
_cache_ttl: datetime | None = None
_cache_lock = asyncio.Lock()

# ---------------------------------------------------------------------------
# OS bucketing — Device.os_info is nmap's free-text OS-match string (e.g.
# "Linux 5.X (88% confidence)"), not a normalized enum column, so buckets
# are derived with a SQL CASE rather than grouped on the raw value.
# ---------------------------------------------------------------------------
_OS_COLORS: dict[str, str] = {
    "Windows 11": "hsl(221 83% 53%)",
    "Windows 10": "hsl(199 89% 48%)",
    "Windows (Other)": "hsl(199 60% 60%)",
    "macOS": "hsl(142 76% 36%)",
    "Linux": "hsl(38 92% 50%)",
    "Unknown": "hsl(215 16% 47%)",
    "Other": "hsl(280 65% 60%)",
}
_FALLBACK_OS_COLOR = "hsl(280 65% 60%)"

# ---------------------------------------------------------------------------
# Audit action -> display type. Only device.create/update/delete and
# user.onboard are actually written anywhere in the codebase today
# (see device_service.py, onboarding_pipeline.py); anything else falls
# back to "update" rather than guessing.
# ---------------------------------------------------------------------------
_ACTION_TYPE_MAP: dict[str, AuditActivityType] = {
    "device.create": "create",
    "device.update": "update",
    "device.delete": "delete",
    "user.onboard": "create",
}
_DEFAULT_ACTIVITY_TYPE: AuditActivityType = "update"

_IN_PROGRESS_JOB_STATUSES = (
    OnboardJobStatus.PENDING,
    OnboardJobStatus.AD_CREATING,
    OnboardJobStatus.EMAIL_SENDING,
    OnboardJobStatus.JIRA_CREATING,
)


def _activity_type_for(action: str) -> AuditActivityType:
    return _ACTION_TYPE_MAP.get(action, _DEFAULT_ACTIVITY_TYPE)


def _target_for(log: AuditLog) -> tuple[str, str]:
    """
    Best-effort human-readable target derived from what's actually in the
    payload — target_id itself is just a UUID string, never a hostname.
    device.update payloads only contain the CHANGED fields (see
    device_service.update_device), so hostname/ip won't always be present;
    falls back to a truncated id rather than joining back to devices,
    which would also break for since-deleted rows.
    """
    payload = log.payload or {}
    if log.target_type == "device":
        name = payload.get("hostname") or payload.get("ip_address") or (
            log.target_id[:8] if log.target_id else "unknown"
        )
        return name, f"Asset {name}"
    if log.target_type == "onboarded_user":
        name = payload.get("email") or (log.target_id[:8] if log.target_id else "unknown")
        return name, name
    fallback = log.target_id or "unknown"
    return fallback, fallback


def _description_for(log: AuditLog) -> str:
    payload = log.payload or {}
    if log.action == "device.create":
        return f"New device registered • {payload.get('ip_address', 'unknown IP')}"
    if log.action == "device.update":
        changed = ", ".join(payload.keys()) or "device details"
        return f"Updated {changed}"
    if log.action == "device.delete":
        return f"Removed from inventory • {payload.get('ip_address', 'unknown IP')}"
    if log.action == "user.onboard":
        dept = payload.get("department")
        return f"Onboarding started • {dept} department" if dept else "Onboarding started"
    return log.action.replace(".", " ").replace("_", " ").capitalize()


class DashboardService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_stats(self) -> DashboardStats:
        """Total/online/offline in one round-trip; health alerts in a second."""
        device_stmt = select(
            func.count(Device.id).label("total"),
            func.count(Device.id).filter(Device.status == DeviceStatus.online).label("online"),
            func.count(Device.id).filter(Device.status == DeviceStatus.offline).label("offline"),
        )
        device_row = (await self.db.execute(device_stmt)).one()

        total = device_row.total or 0
        online = device_row.online or 0
        offline = device_row.offline or 0

        health_alerts, critical_alerts = await self.get_stats()

        return DashboardStats(
            totalAssets=total,
            totalAssetsChange=0,  # no historical device-count snapshot exists to diff against
            online=online,
            onlinePercentage=round((online / total * 100), 1) if total else 0.0,
            offline=offline,
            offlineChange=0,  # same limitation as above
            healthAlerts=health_alerts,
            criticalAlerts=critical_alerts,
        )

    async def get_stats(self) -> DashboardStats:
        from services.device_service import get_device_counts  # or move import to top of file
        counts = await get_device_counts(self.db)
        return DashboardStats(
            totalAssets=counts.total,
            totalAssetsChange=0,
            online=counts.online,
            onlinePercentage=round((counts.online / counts.total * 100), 1) if counts.total else 0.0,
            offline=counts.offline,
            offlineChange=0,
            healthAlerts=counts.health_alerts,
            criticalAlerts=counts.critical_alerts,
        )
        """
        Counts devices whose MOST RECENT health-history reading falls
        below the same thresholds used by get_health_trend (>=85 healthy,
        70-84 warning, <70 critical). Deliberately queries
        device_health_history alone — never joins back to Device — since
        DeviceHealthHistory.device_id is typed Integer while Device.id is
        a UUID primary key; comparing the two would raise a type-mismatch
        error at the database level. That mismatch predates this file;
        flagging it rather than fixing it since models/device_health_history.py
        is out of scope here.
        """
        ranked = (
            select(
                DeviceHealthHistory.device_id,
                DeviceHealthHistory.health_score,
                func.row_number()
                .over(
                    partition_by=DeviceHealthHistory.device_id,
                    order_by=DeviceHealthHistory.recorded_at.desc(),
                )
                .label("rn"),
            )
        ).subquery()

        stmt = (
            select(
                func.count().filter(ranked.c.health_score < 85).label("alerts"),
                func.count().filter(ranked.c.health_score < 70).label("critical"),
            )
            .select_from(ranked)
            .where(ranked.c.rn == 1)
        )
        row = (await self.db.execute(stmt)).one()
        return row.alerts or 0, row.critical or 0

    async def get_health_trend(self, days: int = 30) -> list[HealthTrendPoint]:
        """Daily average health score from history table, last `days` days."""
        since = datetime.utcnow() - timedelta(days=days)
        day_bucket = func.date(DeviceHealthHistory.recorded_at).label("day")

        stmt = (
            select(day_bucket, func.avg(DeviceHealthHistory.health_score).label("avg_score"))
            .where(DeviceHealthHistory.recorded_at >= since)
            .group_by(day_bucket)
            .order_by(day_bucket)
        )
        rows = await self.db.execute(stmt)

        points: list[HealthTrendPoint] = []
        for row in rows:
            score = float(row.avg_score)
            status: HealthStatus = "healthy" if score >= 85 else "warning" if score >= 70 else "critical"
            points.append(HealthTrendPoint(date=row.day.strftime("%d %b"), score=round(score, 1), status=status))
        return points

    async def get_os_distribution(self) -> list[OSDistributionItem]:
        """Buckets Device.os_info into a small set of display categories via SQL CASE."""
        os_bucket = case(
            (Device.os_info.is_(None), "Unknown"),
            (Device.os_info.ilike("%windows 11%"), "Windows 11"),
            (Device.os_info.ilike("%windows 10%"), "Windows 10"),
            (Device.os_info.ilike("%windows%"), "Windows (Other)"),
            (
                or_(
                    Device.os_info.ilike("%mac os%"),
                    Device.os_info.ilike("%macos%"),
                    Device.os_info.ilike("%darwin%"),
                ),
                "macOS",
            ),
            (Device.os_info.ilike("%linux%"), "Linux"),
            else_="Other",
        ).label("os_bucket")

        stmt = (
            select(os_bucket, func.count(Device.id).label("count"))
            .group_by(os_bucket)
            .order_by(func.count(Device.id).desc())
        )
        rows = (await self.db.execute(stmt)).all()
        total = sum(row.count for row in rows) or 1

        return [
            OSDistributionItem(
                name=row.os_bucket,
                count=row.count,
                percentage=round((row.count / total) * 100, 1),
                color=_OS_COLORS.get(row.os_bucket, _FALLBACK_OS_COLOR),
            )
            for row in rows
        ]

    async def get_onboarding_volume(self, weeks: int = 4) -> list[OnboardingVolumePoint]:
        """Weekly completed/in-progress/failed counts from onboarded_user.job_status."""
        since = datetime.now(timezone.utc) - timedelta(weeks=weeks)
        week_bucket = func.date_trunc("week", OnboardedUser.created_at).label("week_start")

        stmt = (
            select(
                week_bucket,
                func.count(OnboardedUser.id)
                .filter(OnboardedUser.job_status == OnboardJobStatus.COMPLETED)
                .label("completed"),
                func.count(OnboardedUser.id)
                .filter(OnboardedUser.job_status == OnboardJobStatus.FAILED)
                .label("failed"),
                func.count(OnboardedUser.id)
                .filter(OnboardedUser.job_status.in_(_IN_PROGRESS_JOB_STATUSES))
                .label("in_progress"),
            )
            .where(OnboardedUser.created_at >= since)
            .group_by(week_bucket)
            .order_by(week_bucket)
        )
        rows = await self.db.execute(stmt)

        return [
            OnboardingVolumePoint(
                week=row.week_start.strftime("Week of %d %b"),
                completed=row.completed or 0,
                inProgress=row.in_progress or 0,
                failed=row.failed or 0,
            )
            for row in rows
        ]

    async def get_recent_audit(self, limit: int = 5) -> list[AuditActivityItem]:
        """Append-only audit log — cheap ORDER BY timestamp DESC LIMIT."""
        stmt = select(AuditLog).order_by(AuditLog.timestamp.desc()).limit(limit)
        rows = await self.db.execute(stmt)

        items: list[AuditActivityItem] = []
        for log in rows.scalars():
            target, target_label = _target_for(log)
            items.append(
                AuditActivityItem(
                    id=str(log.id),
                    type=_activity_type_for(log.action),
                    actor=log.actor,
                    target=target,
                    targetLabel=target_label,
                    description=_description_for(log),
                    timestamp=log.timestamp,
                )
            )
        return items

    async def get_snapshot(self) -> DashboardSnapshot:
        """Compose all aggregations. Frontend makes ONE request."""
        return DashboardSnapshot(
            stats=await self.get_stats(),
            healthTrend=await self.get_health_trend(),
            osDistribution=await self.get_os_distribution(),
            onboardingVolume=await self.get_onboarding_volume(),
            auditActivity=await self.get_recent_audit(),
            generatedAt=datetime.now(timezone.utc),
        )

    async def get_snapshot_cached(self) -> DashboardSnapshot:
        """
        Optional 30s in-memory cache in front of get_snapshot(), for the
        Aiven max_connections=20 budget mentioned in routers/dashboard.py's
        docstring, if the dashboard ends up polled/auto-refreshed. NOT
        wired into the router — that call site is untouched (out of
        scope). Swap `service.get_snapshot()` for
        `service.get_snapshot_cached()` there if you want this behavior.
        """
        global _dashboard_cache, _cache_ttl
        async with _cache_lock:
            if _dashboard_cache is not None and _cache_ttl is not None and datetime.now(timezone.utc) < _cache_ttl:
                return _dashboard_cache
            snapshot = await self.get_snapshot()
            _dashboard_cache = snapshot
            _cache_ttl = datetime.now(timezone.utc) + timedelta(seconds=30)
            return snapshot