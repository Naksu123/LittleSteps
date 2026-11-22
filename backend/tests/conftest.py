import os

os.environ["APP_ENV"] = "test"
os.environ["JWT_SECRET_KEY"] = "test-secret-key-at-least-32-characters-long"
os.environ["SEED_ADMIN_PASSWORD"] = "LittleSteps2026!"
os.environ["SEED_TEACHER_PASSWORD"] = "LittleSteps2026!"
os.environ["SEED_PARENT_PASSWORD"] = "LittleSteps2026!"
os.environ["STAFF_ACCESS_CODE"] = "LS-Staff-Private-2026!"

from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker

import app.models  # noqa: F401
from app.core.config import settings
from app.core.database import Base, get_db
from app.db.seed import seed_database
from app.main import app


@pytest.fixture()
def db_session(tmp_path: Path) -> Generator[Session, None, None]:
    """Provide an isolated SQLite test database seeded with demo data."""
    db_file = tmp_path / "test_littlesteps.db"
    test_engine = create_engine(
        f"sqlite:///{db_file}",
        connect_args={"check_same_thread": False},
        future=True,
    )

    @event.listens_for(test_engine, "connect")
    def _fk_pragma(dbapi_conn, _record) -> None:
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(bind=test_engine)
    TestingSessionLocal = sessionmaker(bind=test_engine, autoflush=False, autocommit=False)

    with TestingSessionLocal() as session:
        seed_database(session)
        yield session

    test_engine.dispose()


@pytest.fixture()
def client(db_session: Session) -> Generator[TestClient, None, None]:
    """Provide a FastAPI TestClient wired to the isolated test DB session."""

    def _override_get_db() -> Generator[Session, None, None]:
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def login_headers(client: TestClient, email: str, password: str = "LittleSteps2026!") -> dict[str, str]:
    """Authenticate via parent or staff gate and return Authorization header for test requests."""
    resp = client.post("/api/auth/login", json={"email": email, "password": password})
    if resp.status_code == 401:
        resp = client.post(
            "/api/auth/staff-login",
            json={
                "email": email,
                "password": password,
                "access_code": settings.STAFF_ACCESS_CODE,
            },
        )
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
