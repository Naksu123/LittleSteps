from fastapi.testclient import TestClient

from tests.conftest import login_headers


def test_home_learning_completion_toggle_and_isolation(client: TestClient) -> None:
    p1_headers = login_headers(client, "parent@littlesteps.edu")
    p2_headers = login_headers(client, "parent2@littlesteps.edu")
    teacher_headers = login_headers(client, "teacher@littlesteps.edu")

    mia_id = next(
        c["id"]
        for c in client.get("/api/children", headers=p1_headers).json()
        if c["display_name"] == "Mia"
    )

    themes = client.get(
        f"/api/parent/home-learning?child_id={mia_id}", headers=p1_headers
    )
    assert themes.status_code == 200
    assert len(themes.json()) == 12
    week1 = themes.json()[0]
    assert week1["parent_guide"] is not None
    assert len(week1["objectives"]) >= 1

    # Pick an uncompleted home activity (Activity 2: Rainbow Snack Sorting)
    uncompleted = next(
        a for a in week1["home_activities"] if not a["completed"]
    )
    ha_id = uncompleted["id"]

    # First completion awards 2 stars
    first = client.post(
        f"/api/parent/home-activities/{ha_id}/progress",
        headers=p1_headers,
        json={"child_id": mia_id, "completed": True},
    )
    assert first.status_code == 200, first.text
    assert first.json()["completed"] is True
    assert first.json()["stars_awarded"] == 2

    # Toggling off then back on awards 0 extra stars (no farming)
    toggle_off = client.post(
        f"/api/parent/home-activities/{ha_id}/progress",
        headers=p1_headers,
        json={"child_id": mia_id, "completed": False},
    )
    assert toggle_off.status_code == 200
    assert toggle_off.json()["completed"] is False

    toggle_on = client.post(
        f"/api/parent/home-activities/{ha_id}/progress",
        headers=p1_headers,
        json={"child_id": mia_id, "completed": True},
    )
    assert toggle_on.status_code == 200
    assert toggle_on.json()["stars_awarded"] == 0

    # Parent 2 cannot toggle Mia's home activity
    forbidden = client.post(
        f"/api/parent/home-activities/{ha_id}/progress",
        headers=p2_headers,
        json={"child_id": mia_id, "completed": True},
    )
    assert forbidden.status_code == 403
    # Teacher cannot access parent home-learning endpoint
    assert (
        client.get("/api/parent/home-learning", headers=teacher_headers).status_code
        == 403
    )


def test_parent_reflections_create_list_and_isolation(client: TestClient) -> None:
    p1_headers = login_headers(client, "parent@littlesteps.edu")
    p2_headers = login_headers(client, "parent2@littlesteps.edu")
    admin_headers = login_headers(client, "admin@littlesteps.edu")

    mia_id = next(
        c["id"]
        for c in client.get("/api/children", headers=p1_headers).json()
        if c["display_name"] == "Mia"
    )
    week2_id = client.get("/api/themes", headers=p1_headers).json()[1]["id"]

    created = client.post(
        "/api/parent/reflections",
        headers=p1_headers,
        json={
            "child_id": mia_id,
            "theme_id": week2_id,
            "enjoyed": True,
            "easy_concepts": "Finding B toys in her basket",
            "challenging_concepts": "Tracing curved b smoothly",
            "discovery_notes": "Mia spotted 'Banana' at breakfast!",
        },
    )
    assert created.status_code == 201, created.text
    assert created.json()["week_number"] == 2

    listed = client.get(
        f"/api/parent/reflections?child_id={mia_id}", headers=p1_headers
    )
    assert listed.status_code == 200
    assert any(
        "Banana" in (item["discovery_notes"] or "") for item in listed.json()
    )

    # Audit log recorded reflection creation
    logs = client.get("/api/admin/audit-logs", headers=admin_headers).json()
    assert "parent.reflection_created" in [l["action"] for l in logs]

    # Parent 2 cannot post a reflection for Mia
    assert (
        client.post(
            "/api/parent/reflections",
            headers=p2_headers,
            json={"child_id": mia_id, "theme_id": week2_id, "enjoyed": True},
        ).status_code
        == 403
    )


def test_learning_goals_crud_and_settings(client: TestClient) -> None:
    p1_headers = login_headers(client, "parent@littlesteps.edu")
    p2_headers = login_headers(client, "parent2@littlesteps.edu")

    mia_id = next(
        c["id"]
        for c in client.get("/api/children", headers=p1_headers).json()
        if c["display_name"] == "Mia"
    )

    created = client.post(
        "/api/parent/goals",
        headers=p1_headers,
        json={
            "child_id": mia_id,
            "title": "Practice phonics 25 minutes on weekdays",
            "target_minutes_per_day": 25,
            "target_lessons_per_week": 4,
            "is_active": True,
        },
    )
    assert created.status_code == 201, created.text
    goal_id = created.json()["id"]

    # Syncs daily_goal_minutes onto child
    mia_profile = client.get(f"/api/children/{mia_id}", headers=p1_headers).json()
    assert mia_profile["daily_goal_minutes"] == 25

    goals = client.get(f"/api/parent/goals?child_id={mia_id}", headers=p1_headers)
    assert goals.status_code == 200
    assert any(g["id"] == goal_id for g in goals.json())

    updated = client.patch(
        f"/api/parent/goals/{goal_id}",
        headers=p1_headers,
        json={"is_active": False},
    )
    assert updated.status_code == 200
    assert updated.json()["is_active"] is False

    # Parent 2 cannot edit or delete Mia's goal
    assert (
        client.patch(
            f"/api/parent/goals/{goal_id}",
            headers=p2_headers,
            json={"is_active": True},
        ).status_code
        == 403
    )
    assert (
        client.delete(f"/api/parent/goals/{goal_id}", headers=p2_headers).status_code
        == 403
    )

    # Parent 1 deletes goal
    assert (
        client.delete(f"/api/parent/goals/{goal_id}", headers=p1_headers).status_code
        == 204
    )

    # Settings get & patch
    s_get = client.get("/api/parent/settings", headers=p1_headers)
    assert s_get.status_code == 200
    s_patch = client.patch(
        "/api/parent/settings",
        headers=p1_headers,
        json={
            "preferred_language": "fil",
            "daily_screen_limit_mins": 45,
            "notifications_enabled": True,
        },
    )
    assert s_patch.status_code == 200
    assert s_patch.json()["preferred_language"] == "fil"
    assert s_patch.json()["daily_screen_limit_mins"] == 45


def test_notifications_read_and_isolation(client: TestClient) -> None:
    p1_headers = login_headers(client, "parent@littlesteps.edu")
    p2_headers = login_headers(client, "parent2@littlesteps.edu")

    notifs = client.get("/api/parent/notifications", headers=p1_headers)
    assert notifs.status_code == 200
    body = notifs.json()
    assert body["unread_count"] >= 1
    first_id = body["items"][0]["id"]

    # Parent 2 cannot mark Parent 1's notification read
    assert (
        client.patch(
            f"/api/parent/notifications/{first_id}/read", headers=p2_headers
        ).status_code
        == 404
    )

    marked = client.patch(
        f"/api/parent/notifications/{first_id}/read", headers=p1_headers
    )
    assert marked.status_code == 200
    assert marked.json()["is_read"] is True

    read_all = client.post("/api/parent/notifications/read-all", headers=p1_headers)
    assert read_all.status_code == 200
    after = client.get("/api/parent/notifications", headers=p1_headers).json()
    assert after["unread_count"] == 0


def test_weekly_report_endpoint_and_isolation(client: TestClient) -> None:
    p1_headers = login_headers(client, "parent@littlesteps.edu")
    p2_headers = login_headers(client, "parent2@littlesteps.edu")

    mia_id = next(
        c["id"]
        for c in client.get("/api/children", headers=p1_headers).json()
        if c["display_name"] == "Mia"
    )

    report = client.get(f"/api/parent/reports?child_id={mia_id}", headers=p1_headers)
    assert report.status_code == 200, report.text
    r = report.json()
    assert "Mia" in r["encouraging_summary"]
    assert len(r["strengths"]) >= 1
    assert len(r["activity_history"]) >= 1
    assert len(r["teacher_observations"]) >= 1
    assert len(r["teacher_feedback"]) >= 1
    assert len(r["assigned_activities"]) >= 1
    assert len(r["recommended_home_activities"]) >= 1
    assert len(r["reflections"]) >= 1

    # Parent 2 cannot access Mia's report
    assert (
        client.get(
            f"/api/parent/reports?child_id={mia_id}", headers=p2_headers
        ).status_code
        == 403
    )


def test_parent_register_add_child_logout_and_relogin_persistence(
    client: TestClient, monkeypatch
) -> None:
    # 1. Parent registers a new account and creates two child learner profiles
    reg = client.post(
        "/api/auth/register",
        json={
            "email": "arthur.parent@example.com",
            "password": "ParentPassword2026!",
            "full_name": "Arthur Parent",
            "privacy_consent_accepted": True,
        },
    )
    assert reg.status_code == 201, reg.text
    tokens = reg.json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    child1 = client.post(
        "/api/children",
        headers=headers,
        json={
            "display_name": "arthur ni",
            "birth_year": 2021,
            "age_group": "4-5",
            "avatar_key": "bunny",
            "favorite_color": "#78C8F5",
            "daily_goal_minutes": 20,
        },
    )
    assert child1.status_code == 201, child1.text
    c1_body = child1.json()
    assert c1_body["display_name"] == "arthur ni"
    assert c1_body["birth_year"] == 2021
    assert c1_body["age_group"] == "4-5"
    assert c1_body["avatar_key"] == "bunny"
    assert c1_body["daily_goal_minutes"] == 20

    # Duplicate child name rejected with 409
    dup_child = client.post(
        "/api/children",
        headers=headers,
        json={
            "display_name": "Arthur Ni",
            "birth_year": 2021,
            "age_group": "4-5",
            "avatar_key": "bunny",
            "favorite_color": "#78C8F5",
            "daily_goal_minutes": 20,
        },
    )
    assert dup_child.status_code == 409

    # Create a second child profile under the same parent
    child2 = client.post(
        "/api/children",
        headers=headers,
        json={
            "display_name": "Lily",
            "birth_year": 2020,
            "age_group": "5-6",
            "avatar_key": "owl",
            "favorite_color": "#9BE7C4",
            "daily_goal_minutes": 25,
        },
    )
    assert child2.status_code == 201, child2.text

    # Create a Pre-School child omitting age_group so backend derives it dynamically from birth_year
    from datetime import date

    dyn_year = date.today().year - 4
    child_dyn = client.post(
        "/api/children",
        headers=headers,
        json={
            "display_name": "Niko",
            "birth_year": dyn_year,
            "avatar_key": "fox",
            "favorite_color": "#FFE58A",
            "daily_goal_minutes": 15,
        },
    )
    assert child_dyn.status_code == 201, child_dyn.text
    assert child_dyn.json()["age_group"] == "4-5"

    dash = client.get("/api/parent/dashboard", headers=headers)
    assert dash.status_code == 200
    child_names = {item["child"]["display_name"] for item in dash.json()["children"]}
    assert child_names == {"arthur ni", "Lily", "Niko"}

    # Another parent cannot access 'arthur ni'
    p2_headers = login_headers(client, "parent2@littlesteps.edu")
    assert client.get(f"/api/children/{c1_body['id']}", headers=p2_headers).status_code == 403

    # 2. Log out cleanly, then sign back in with case-variant email and verify account & children persist
    logout = client.post(
        "/api/auth/logout",
        headers=headers,
        json={"refresh_token": tokens["refresh_token"]},
    )
    assert logout.status_code == 204

    relogin = client.post(
        "/api/auth/login",
        json={"email": "ARTHUR.PARENT@example.com", "password": "ParentPassword2026!"},
    )
    assert relogin.status_code == 200, relogin.text
    relogin_headers = {"Authorization": f"Bearer {relogin.json()['access_token']}"}

    me = client.get("/api/auth/me", headers=relogin_headers)
    assert me.status_code == 200
    assert {c["display_name"] for c in me.json()["children"]} == {"arthur ni", "Lily", "Niko"}

    relogin_dash = client.get("/api/parent/dashboard", headers=relogin_headers)
    assert relogin_dash.status_code == 200
    assert {item["child"]["display_name"] for item in relogin_dash.json()["children"]} == {
        "arthur ni",
        "Lily",
        "Niko",
    }

    # 3. Never fake registration on ephemeral Vercel SQLite without PostgreSQL
    monkeypatch.setenv("VERCEL", "1")
    monkeypatch.setattr(
        "app.core.database.resolve_database_url",
        lambda for_migrations=False: "sqlite:////tmp/littlesteps_dev.db",
    )
    blocked_reg = client.post(
        "/api/auth/register",
        json={
            "email": "ephemeral.blocked@example.com",
            "password": "ParentPassword2026!",
            "full_name": "Blocked Guardian",
            "privacy_consent_accepted": True,
        },
    )
    assert blocked_reg.status_code == 503
