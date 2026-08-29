"""
Pydantic schemas for the aggregated dashboard snapshot.

Field names are deliberately camelCase (literal names, not aliases) —
same precedent as schemas/device.py's PaginationMeta: this is a
hand-written envelope consumed directly by the dashboard's existing
frontend types (frontend/src/lib/mock-data.ts), not something that will
ever pass through openapi-typescript codegen, so matching the frontend's
shape 1:1 avoids an alias/mapping layer in the TanStack Query hook.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

HealthStatus = Literal["healthy", "warning", "critical"]
AuditActivityType = Literal["update", "create", "delete", "alert", "report"]


class DashboardStats(BaseModel):
    totalAssets: int  # noqa: N815
    totalAssetsChange: int  # noqa: N815
    online: int
    onlinePercentage: float  # noqa: N815
    offline: int
    offlineChange: int  # noqa: N815
    healthAlerts: int  # noqa: N815
    criticalAlerts: int  # noqa: N815


class HealthTrendPoint(BaseModel):
    date: str
    score: float
    status: HealthStatus


class OSDistributionItem(BaseModel):
    name: str
    count: int
    percentage: float
    color: str


class OnboardingVolumePoint(BaseModel):
    week: str
    completed: int
    in_progress: int = Field(alias="inProgress")
    failed: int


class AuditActivityItem(BaseModel):
    id: str
    type: AuditActivityType
    actor: str
    target: str
    target_label: str = Field(alias="targetLabel")
    description: str
    timestamp: datetime


class DashboardSnapshot(BaseModel):
    stats: DashboardStats
    healthTrend: list[HealthTrendPoint]  # noqa: N815
    osDistribution: list[OSDistributionItem]  # noqa: N815
    onboardingVolume: list[OnboardingVolumePoint]  # noqa: N815
    auditActivity: list[AuditActivityItem]  # noqa: N815
    generatedAt: datetime  # noqa: N815