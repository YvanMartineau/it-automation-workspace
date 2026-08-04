# backend/seed.py
"""
Populates a complete demo environment from a clean database.
Target: < 90 seconds. This is the demo's only dependency.

Usage:
    python -m backend.seed                # local/dev DB only
    python -m backend.seed --confirm-prod  # required if DATABASE_URL is not localhost
"""

import asyncio
import sys
import time
import uuid
from datetime import datetime, timedelta, timezone

from passlib.context import CryptContext
from sqlalchemy import delete

from db.engine import AsyncSessionLocal, engine
from models.user import User
from models.device import Device
#from .models.audit_log import AuditLog
#from .models.report_log import ReportLog
from settings import Settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Guard against accidental seeding of a production database
#def _guard_against_prod():
#    """
#    Refuse to run against Aiven unless explicitly confirmed.
#    This is the check that saves you from truncating your live demo DB
#    by running `python -m backend.seed` on the wrong terminal tab.
#    """
#    is_local = "localhost" in settings.DEV_DATABASE_URL or "127.0.0.1" in settings.DEV_DATABASE_URL
#    if not is_local and "--confirm-prod" not in sys.argv:
#        print(
#            "REFUSING TO RUN: DATABASE_URL does not look local "
#            f"({settings.DEV_DATABASE_URL.split('@')[-1].split('/')[0]}).\n"
#            "If you really mean to seed a remote DB, re-run with --confirm-prod."
#        )
#        sys.exit(1)

# Clear the mutable tables in the database. This is done before seeding to ensure a clean state.
#async def _clear_existing(db):
    # Order matters: no FK constraints run backwards, but audit_log is
    # append-only at the DB-trigger level for UPDATE/DELETE too — so even
    # the seed script's own cleanup pass has to be aware of that trigger.
    # DELETE is blocked by design (see audit_trigger_sql in the schema).
    # So instead of deleting audit_log rows, seed always starts from a
    # freshly migrated (empty) DB in the demo runbook. Here we only clear
    # the mutable tables.
#    await db.execute(delete(ReportLog))
#    await db.execute(delete(Device))
#    await db.execute(delete(User))
#    await db.commit()


async def _seed_users(db) -> dict[str, User]:
    admin = User(
        id=uuid.uuid4(),
        email="admin@dev.de",
        hashed_password=pwd_context.hash("DemoAdmin!2026"), #("DemoViewer!2026"[:72]) 72 bit
        role="admin",
        is_active=True,
    )
    viewer = User(
        id=uuid.uuid4(),
        email="viewer@dev.de",
        hashed_password=pwd_context.hash("DemoViewer!2026"),
        role="viewer",
        is_active=True,
    )
    db.add_all([admin, viewer])
    await db.commit()
    return {"admin": admin, "viewer": viewer}


async def _seed_devices(db) -> list[Device]:
    now = datetime.now(timezone.utc)
    devices = []
    statuses = ["online", "online", "online", "offline", "unknown"]
    for i in range(1, 11):
        status = statuses[i % len(statuses)]
        devices.append(
            Device(
                id=uuid.uuid4(),
                hostname=f"ws-{i:03d}.demo.local",
                ip_address=f"192.168.1.{i + 10}",
                mac_address=f"02:00:00:00:{i:02x}:{(i*3)%256:02x}",
                status=status,
                cpu_percent=None if status == "offline" else round(10 + (i * 7) % 90, 1),
                memory_percent=None if status == "offline" else round(20 + (i * 11) % 70, 1),
                os_info="Windows 11 Pro" if i % 3 else "Ubuntu 24.04 LTS",
                last_seen=None if status == "offline" else now - timedelta(minutes=i),
            )
        )
    db.add_all(devices)
    await db.commit()
    return devices

#TODO When Audit Log is implemented.
#async def _seed_audit_logs(db, admin: User):
#    # Direct INSERT is fine — the trigger only blocks UPDATE/DELETE.
#    now = datetime.now(timezone.utc)
#    entries = [
#        AuditLog(
#            id=uuid.uuid4(),
#            actor=admin.email,
#            action="auth.login",
#            target_type=None,
#            target_id=None,
#            payload={"ip": "203.0.113.10"},
#            timestamp=now - timedelta(days=2),
#        ),
#        AuditLog(
#            id=uuid.uuid4(),
#            actor=admin.email,
#            action="device.scan.start",
#            target_type="subnet",
#            target_id="192.168.1.0/24",
#            payload={"triggered_via": "seed"},
#            timestamp=now - timedelta(days=2, minutes=-5),
#        ),
#        AuditLog(
#            id=uuid.uuid4(),
#            actor=admin.email,
#            action="user.onboard",
#            target_type="user",
#            target_id="demo-graph-user-id-0001",
#            payload={"department": "IT", "role": "Support Technician"},
#            timestamp=now - timedelta(days=1),
#        ),
#    ]
#    db.add_all(entries)
#    await db.commit()

#TODO When Report Log is implemented.
#async def _seed_report_logs(db):
#    now = datetime.now(timezone.utc)
#    logs = [
#        ReportLog(
#            id=uuid.uuid4(),
#            report_type="scheduled_weekly",
#            triggered_by="scheduler",
#            recipient_email="admin@demo.local",
#            status="sent",
#            sent_at=now - timedelta(days=7),
#            error_message=None,
#        ),
#        ReportLog(
#            id=uuid.uuid4(),
#            report_type="manual",
#            triggered_by="admin@demo.local",
#            recipient_email="admin@demo.local",
#            status="sent",
#            sent_at=now - timedelta(days=1),
#            error_message=None,
#        ),
#    ]
#    db.add_all(logs)
#    await db.commit()


async def main():
#    _guard_against_prod()
    start = time.perf_counter()

    async with AsyncSessionLocal() as db:
#        print("Clearing mutable tables...")
#        await _clear_existing(db)

        print("Seeding users...")
        users = await _seed_users(db)

        print("Seeding devices...")
        await _seed_devices(db)

#        print("Seeding audit log history...")
#        await _seed_audit_logs(db, users["admin"])

#        print("Seeding report history...")
#        await _seed_report_logs(db)

    elapsed = time.perf_counter() - start
    print(f"\nSeed complete in {elapsed:.2f}s.")
    print("  admin@demo.local / DemoAdmin!2026")
    print("  viewer@demo.local / DemoViewer!2026")

    if elapsed > 90:
        print("WARNING: seed exceeded the 90s target.")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())