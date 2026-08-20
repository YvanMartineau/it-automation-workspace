# backend/seed.py
"""
Populates a complete demo environment from a clean database.
Target: < 90 seconds. This is the demo's only dependency.

Usage:
    python -m backend.seed                # local/dev DB only
    python -m backend.seed --confirm-prod  # required if DATABASE_URL is not localhost
"""

import logging
import os
import asyncio
import sys
import time
import uuid
from datetime import datetime, timedelta, timezone

from ldap3 import SUBTREE, Connection, Server
from passlib.context import CryptContext
from sqlalchemy import select

from db.engine import AsyncSessionLocal, engine
from models.user import User
from settings import get_settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
settings = get_settings()

ENTRY_ALREADY_EXISTS = 68


# -----------------------------
# LDAP STRUCTURE SEEDING
# -----------------------------
def seed_ldap_structure() -> None:
    ldap_password = os.getenv("LDAP_BIND_PASSWORD")
    if not ldap_password:
        raise RuntimeError("Missing LDAP_BIND_PASSWORD environment variable")

    server = Server(settings.LDAP_SERVER_URL)
    conn = Connection(
        server,
        user=settings.LDAP_BIND_DN,
        password=ldap_password,
        auto_bind=True,
    )

    for ou_dn in (settings.LDAP_USERS_OU, settings.LDAP_GROUPS_OU):
        ou_name = ou_dn.split(",")[0].split("=")[1]
        added = conn.add(
            ou_dn,
            object_class=["organizationalUnit"],
            attributes={"ou": ou_name},
        )
        if added:
            logger.info("Created LDAP container: %s", ou_dn)
        elif conn.result.get("result") == ENTRY_ALREADY_EXISTS:
            logger.info("Already exists, skipping: %s", ou_dn)
        else:
            raise RuntimeError(f"Failed to create '{ou_dn}': {conn.result}")

    conn.unbind()


# -----------------------------
# USER SEEDING
# -----------------------------
async def _seed_users(db) -> dict[str, User]:
    seed_data = [
        {
            "email": os.getenv("SEED_ADMIN_EMAIL", "admin@dev.de"),
            "password": os.getenv("SEED_ADMIN_PASSWORD"),
            "role": "admin",
        },
        {
            "email": os.getenv("SEED_VIEWER_EMAIL", "viewer@dev.de"),
            "password": os.getenv("SEED_VIEWER_PASSWORD"),
            "role": "viewer",
        },
    ]

    users: dict[str, User] = {}

    for entry in seed_data:
        if not entry["password"]:
            raise RuntimeError(
                f"Missing password for seeded user: {entry['email']}. "
                "Set SEED_ADMIN_PASSWORD / SEED_VIEWER_PASSWORD."
            )

        result = await db.execute(select(User).where(User.email == entry["email"]))
        existing = result.scalar_one_or_none()

        if existing:
            logger.info("User already exists, skipping: %s", entry["email"])
            users[entry["role"]] = existing
            continue

        user = User(
            id=uuid.uuid4(),
            email=entry["email"],
            hashed_password=pwd_context.hash(entry["password"]),
            role=entry["role"],
            is_active=True,
        )
        db.add(user)
        users[entry["role"]] = user

    await db.commit()
    return users


# -----------------------------
# MAIN
# -----------------------------
async def main():
    start = time.perf_counter()

    async with AsyncSessionLocal() as db:
        print("Seeding users...")
        users = await _seed_users(db)

    elapsed = time.perf_counter() - start
    print(f"\nSeed complete in {elapsed:.2f}s.")
    print("  admin@dev.de (password from SEED_ADMIN_PASSWORD)")
    print("  viewer@dev.de (password from SEED_VIEWER_PASSWORD)")

    if elapsed > 90:
        print("WARNING: seed exceeded the 90s target.")

    await engine.dispose()


if __name__ == "__main__":
    seed_ldap_structure()
    asyncio.run(main())
