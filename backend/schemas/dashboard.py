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

from pydantic import BaseModel

HealthStatus = Literal["healthy", "warning", "critical"]
AuditActivityType = Literal["update", "create", "delete", "alert", "report"]


class DashboardStats(BaseModel):
    totalAssets: int
    totalAssetsChange: int
    online: int
    onlinePercentage: float
    offline: int
    offlineChange: int
    healthAlerts: int
    criticalAlerts: int


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
    inProgress: int
    failed: int


class AuditActivityItem(BaseModel):
    id: str
    type: AuditActivityType
    actor: str
    target: str
    targetLabel: str
    description: str
    timestamp: datetime


class DashboardSnapshot(BaseModel):
    stats: DashboardStats
    healthTrend: list[HealthTrendPoint]
    osDistribution: list[OSDistributionItem]
    onboardingVolume: list[OnboardingVolumePoint]
    auditActivity: list[AuditActivityItem]
    generatedAt: datetime