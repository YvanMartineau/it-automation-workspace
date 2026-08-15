"""merge duplicate audit log heads

Revision ID: 44c36952d57e
Revises: c3c87eceaaba, deeb3b1a8463
Create Date: 2026-08-15 16:33:19.916201

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '44c36952d57e'
down_revision: Union[str, None] = ('c3c87eceaaba', 'deeb3b1a8463')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
