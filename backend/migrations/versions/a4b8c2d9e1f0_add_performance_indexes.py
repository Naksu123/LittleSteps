"""add performance indexes

Revision ID: a4b8c2d9e1f0
Revises: 15c6698f0056
Create Date: 2026-11-24 10:05:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "a4b8c2d9e1f0"
down_revision: Union[str, Sequence[str], None] = "15c6698f0056"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create composite and filter indexes for hot query paths."""
    op.create_index("ix_themes_status", "themes", ["status"], unique=False)
    op.create_index("ix_lessons_status", "lessons", ["status"], unique=False)
    op.create_index("ix_lessons_status_subject", "lessons", ["status", "subject_id"], unique=False)
    op.create_index("ix_games_status", "games", ["status"], unique=False)
    op.create_index("ix_games_status_subject", "games", ["status", "subject_id"], unique=False)
    op.create_index("ix_children_is_active", "children", ["is_active"], unique=False)
    op.create_index("ix_classes_is_active", "classes", ["is_active"], unique=False)
    op.create_index(
        "ix_lesson_progress_child_status",
        "lesson_progress",
        ["child_id", "status"],
        unique=False,
    )
    op.create_index(
        "ix_activity_attempts_child_completed",
        "activity_attempts",
        ["child_id", "completed"],
        unique=False,
    )
    op.create_index(
        "ix_activity_attempts_child_game_completed",
        "activity_attempts",
        ["child_id", "game_id", "completed"],
        unique=False,
    )
    op.create_index(
        "ix_activity_attempts_child_created",
        "activity_attempts",
        ["child_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_quiz_results_child_created",
        "quiz_results",
        ["child_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_child_rewards_child_badge",
        "child_rewards",
        ["child_id", "badge_key"],
        unique=False,
    )
    op.create_index(
        "ix_home_activity_progress_child_completed",
        "home_activity_progress",
        ["child_id", "completed"],
        unique=False,
    )
    op.create_index(
        "ix_notifications_user_read_created",
        "notifications",
        ["user_id", "is_read", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    """Drop performance indexes."""
    op.drop_index("ix_notifications_user_read_created", table_name="notifications")
    op.drop_index("ix_home_activity_progress_child_completed", table_name="home_activity_progress")
    op.drop_index("ix_child_rewards_child_badge", table_name="child_rewards")
    op.drop_index("ix_quiz_results_child_created", table_name="quiz_results")
    op.drop_index("ix_activity_attempts_child_created", table_name="activity_attempts")
    op.drop_index("ix_activity_attempts_child_game_completed", table_name="activity_attempts")
    op.drop_index("ix_activity_attempts_child_completed", table_name="activity_attempts")
    op.drop_index("ix_lesson_progress_child_status", table_name="lesson_progress")
    op.drop_index("ix_classes_is_active", table_name="classes")
    op.drop_index("ix_children_is_active", table_name="children")
    op.drop_index("ix_games_status_subject", table_name="games")
    op.drop_index("ix_games_status", table_name="games")
    op.drop_index("ix_lessons_status_subject", table_name="lessons")
    op.drop_index("ix_lessons_status", table_name="lessons")
    op.drop_index("ix_themes_status", table_name="themes")
