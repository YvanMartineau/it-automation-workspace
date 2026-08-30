"""add partially complete to onboarded_user table

Revision ID: 56d0cfe77117
Revises: 2e05da2c7743
Create Date: 2026-08-29 23:17:08.267416

Adds PARTIALLY_COMPLETE to onboard_job_status (directory account exists,
downstream notifications unconfirmed) and backfills updated_at with a
server_default — the sweeper measures staleness from this column and
needs it populated from row creation, not just from the first update.
"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "56d0cfe77117"
down_revision: str | None = "2e05da2c7743"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE onboard_job_status ADD VALUE IF NOT EXISTS 'PARTIALLY_COMPLETE'")
    op.execute("ALTER TABLE onboarded_user ALTER COLUMN updated_at SET DEFAULT now()")
    op.execute("UPDATE onboarded_user SET updated_at = created_at WHERE updated_at IS NULL")


def downgrade() -> None:
    op.execute("ALTER TABLE onboarded_user ALTER COLUMN updated_at DROP DEFAULT")
