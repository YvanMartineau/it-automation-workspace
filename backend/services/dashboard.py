from datetime import datetime, timedelta
from sqlalchemy import func, select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from models.device import Device
from models.device_health_history import DeviceHealthHistory
from models.audit_log import AuditLog
from models.onboarded_user import OnboardedUser
from schemas.dashboard import (
    DashboardSnapshot,
    DashboardStats,
    HealthTrendPoint,
    OSDistributionItem,
    OnboardingVolumePoint,
    AuditActivityItem,
)
from functools import lru_cache
import asyncio


# In-memory cache with TTL (replace with Redis in production)
_dashboard_cache: dict | None = None
_cache_lock = asyncio.Lock()
_cache_ttl: datetime | None = None

class DashboardService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_stats(self) -> DashboardStats:
        """Single round-trip for all four KPIs using SQL COUNT + FILTER."""
        stmt = select(
            func.count(Device.id).label("total"),
            func.count(Device.id).filter(Device.status == "online").label("online"),
            func.count(Device.id).filter(Device.status == "offline").label("offline"),
            func.count(Device.id).filter(Device.health_score < 70).label("alerts"),
        )
        row = (await self.db.execute(stmt)).one()
        
        total = row.total or 0
        online = row.online or 0
        offline = row.offline or 0
        
        return DashboardStats(
            total_assets=total,
            total_assets_change=0,  # Derive from weekly diff subquery if needed
            online=online,
            online_percentage=round((online / total * 100), 1) if total else 0.0,
            offline=offline,
            offline_change=0,
            health_alerts=row.alerts or 0,
            critical_alerts=0,  # Add threshold filter if you track critical separately
        )

    async def get_health_trend(self, days: int = 30) -> list[HealthTrendPoint]:
        """Daily average health score from history table."""
        since = datetime.utcnow() - timedelta(days=days)
        
        stmt = (
            select(
                func.date(DeviceHealthHistory.recorded_at).label("date"),
                func.avg(DeviceHealthHistory.health_score).label("avg_score"),
            )
            .where(DeviceHealthHistory.recorded_at >= since)
            .group_by(func.date(DeviceHealthHistory.recorded_at))
            .order_by(func.date(DeviceHealthHistory.recorded_at))
        )
        
        rows = await self.db.execute(stmt)
        return [
            HealthTrendPoint(
                date=row.date.strftime("%d %b"),
                score=round(row.avg_score, 1),
                status="healthy" if row.avg_score >= 85 else "warning" if row.avg_score >= 70 else "critical",
            )
            for row in rows
        ]

    async def get_os_distribution(self) -> list[OSDistributionItem]:
        """GROUP BY os_type at the database."""
        total_stmt = select(func.count(Device.id))
        total_result = await self.db.execute(total_stmt)
        total = total_result.scalar() or 1  # Avoid div/0
        
        stmt = (
            select(Device.os_type, func.count(Device.id).label("count"))
            .group_by(Device.os_type)
            .order_by(func.count(Device.id).desc())
        )
        
        rows = await self.db.execute(stmt)
        return [
            OSDistributionItem(
                name=row.os_type,
                count=row.count,
                percentage=round((row.count / total) * 100, 1),
            )
            for row in rows
        ]

    async def get_onboarding_volume(self) -> list[OnboardingVolumePoint]:
        """Weekly aggregation from onboarded_user table."""
        # Implementation depends on your onboarded_user schema
        pass

    async def get_recent_audit(self, limit: int = 5) -> list[AuditActivityItem]:
        """Append-only audit log — cheap ORDER BY id DESC."""
        stmt = (
            select(AuditLog)
            .order_by(AuditLog.timestamp.desc())
            .limit(limit)
        )
        rows = await self.db.execute(stmt)
        return [AuditActivityItem.model_validate(r) for r in rows.scalars()]

    async def get_snapshot(self) -> DashboardSnapshot:
        """Compose all aggregations. Frontend makes ONE request."""
        return DashboardSnapshot(
            stats=await self.get_stats(),
            health_trend=await self.get_health_trend(),
            os_distribution=await self.get_os_distribution(),
            onboarding_volume=await self.get_onboarding_volume(),
            audit_activity=await self.get_recent_audit(),
            generated_at=datetime.utcnow(),
        )

async def get_snapshot_cached(self) -> DashboardSnapshot:
    global _dashboard_cache, _cache_ttl
    async with _cache_lock:
        if _dashboard_cache and _cache_ttl and datetime.utcnow() < _cache_ttl:
            return _dashboard_cache
        snapshot = await self.get_snapshot()
        _dashboard_cache = snapshot
        _cache_ttl = datetime.utcnow() + timedelta(seconds=30)
        return snapshot