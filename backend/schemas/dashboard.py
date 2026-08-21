from datetime import datetime
from pydantic import BaseModel

class DashboardStats(BaseModel):
    total_assets: int
    total_assets_change: int
    online: int
    online_percentage: float
    offline: int
    offline_change: int
    health_alerts: int
    critical_alerts: int

class HealthTrendPoint(BaseModel):
    date: str
    score: float
    status: str

class OSDistributionItem(BaseModel):
    name: str
    count: int
    percentage: float

class OnboardingVolumePoint(BaseModel):
    week: str
    completed: int
    inProgress: int
    failed: int

class AuditActivityItem(BaseModel):
    id: str
    type: str
    actor: str
    target: str
    target_label: str
    description: str
    timestamp: datetime

class DashboardSnapshot(BaseModel):
    stats: DashboardStats
    health_trend: list[HealthTrendPoint]
    os_distribution: list[OSDistributionItem]
    onboarding_volume: list[OnboardingVolumePoint]
    audit_activity: list[AuditActivityItem]
    generated_at: datetime