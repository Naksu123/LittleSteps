from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.seed import seed_database
from tests.conftest import login_headers


def test_seed_is_idempotent(db_session: Session) -> None:
    first = seed_database(db_session)
    second = seed_database(db_session)
    assert first == second
    assert first["subjects"] == 6
    assert first["themes"] == 12
    assert first["games"] == 16
    assert first["lessons"] == 6


def test_learning_content_and_parent_dashboard(client: TestClient) -> None:
    headers = login_headers(client, "parent@littlesteps.edu")

    subjects = client.get("/api/subjects", headers=headers)
    assert subjects.status_code == 200
    assert len(subjects.json()) == 6

    themes = client.get("/api/themes", headers=headers)
    assert themes.status_code == 200
    assert len(themes.json()) == 12
    week1_id = themes.json()[0]["id"]

    theme_detail = client.get(f"/api/themes/{week1_id}", headers=headers)
    assert theme_detail.status_code == 200
    assert theme_detail.json()["parent_guide"] is not None
    assert len(theme_detail.json()["home_activities"]) >= 1

    games = client.get("/api/games", headers=headers)
    assert games.status_code == 200
    assert len(games.json()) == 16

    dashboard = client.get("/api/parent/dashboard", headers=headers)
    assert dashboard.status_code == 200
    dash = dashboard.json()
    assert len(dash["children"]) == 2
    assert dash["current_theme"]["title"] == "Colors Around Us"
    assert len(dash["children"][0]["weekly_activity"]) == 7
