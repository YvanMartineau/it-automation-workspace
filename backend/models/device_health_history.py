from datetime import datetime
from sqlalchemy import Column, Integer, ForeignKey, DateTime, Float, Index
from sqlalchemy.orm import Mapped, mapped_column
from db.engine import Base

class DeviceHealthHistory(Base):
    __tablename__ = "device_health_history"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    device_id: Mapped[int] = mapped_column(ForeignKey("devices.id", ondelete="CASCADE"))
    health_score: Mapped[float] = mapped_column(Float)
    recorded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        Index("ix_health_history_device_date", "device_id", "recorded_at"),
    )