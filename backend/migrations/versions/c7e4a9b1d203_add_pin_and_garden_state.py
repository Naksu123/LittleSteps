"""add parent pin hash and child garden state

Revision ID: c7e4a9b1d203
Revises: a4b8c2d9e1f0
Create Date: 2026-11-24 21:45:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "c7e4a9b1d203"
down_revision: Union[str, Sequence[str], None] = "a4b8c2d9e1f0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add optional parent PIN hash and Bahay Kubo child garden state JSON safely."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    parent_cols = {c["name"] for c in inspector.get_columns("parent_profiles")}
    if "parent_pin_hash" not in parent_cols:
        op.add_column(
            "parent_profiles",
            sa.Column("parent_pin_hash", sa.String(length=255), nullable=True),
        )

    child_cols = {c["name"] for c in inspector.get_columns("children")}
    if "garden_state_json" not in child_cols:
        op.add_column(
            "children",
            sa.Column(
                "garden_state_json",
                sa.JSON(),
                nullable=False,
                server_default="{}",
            ),
        )


def downgrade() -> None:
    """Remove parent PIN hash and child garden state JSON."""
    op.drop_column("children", "garden_state_json")
    op.drop_column("parent_profiles", "parent_pin_hash")
