"""seed.py — populates a demo-ready environment from a clean database.

Run manually: python seed.py
Idempotent — safe to re-run; skips records that already exist.
"""

import asyncio
import os
import sys

from sqlalchemy import select

from db.engine import AsyncSessionLocal
from models.user import User, UserRole
from security.password_hashing import hash_password


async def seed_admin_user() -> None:
    admin_email = os.getenv("SEED_ADMIN_EMAIL")
    admin_password = os.getenv("SEED_ADMIN_PASSWORD")

    if not admin_email or not admin_password:
        # Avoid printing mock password examples or actual values to stderr
        print(
            "ERROR: SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD environment "
            "variables are required to run seed.py.",
            file=sys.stderr,
        )
        sys.exit(1)

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == admin_email))
        existing = result.scalar_one_or_none()

        if existing is not None:
            print(f"Admin user '{admin_email}' already exists — skipping.")
            return

        admin = User(
            email=admin_email,
            hashed_password=hash_password(admin_password),
            role=UserRole.admin,
            is_active=True,
        )
        db.add(admin)
        await db.commit()
        print(f"✓ Created admin user: {admin_email}")

# Example idempotent check inside seed.py
async def seed_data(db_session):
    existing_user = await db_session.execute(
        select(User).where(User.email == "admin@example.com")
    )
    if not existing_user.scalar_one_or_none():
        db_session.add(User(email="admin@example.com", name="Admin"))
        await db_session.commit()
        print("Seed completed.")
    else:
        print("Data already seeded. Skipping.")

        
async def main() -> None:
    await seed_admin_user()


if __name__ == "__main__":
    asyncio.run(main())