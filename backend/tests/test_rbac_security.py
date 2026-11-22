from fastapi.testclient import TestClient

from tests.conftest import login_headers


def test_unauthenticated_and_tampered_tokens_rejected(client: TestClient) -> None:
    assert client.get("/api/children").status_code == 401
    assert client.get("/api/parent/dashboard").status_code == 401
    assert client.get("/api/teacher/classes").status_code == 401
    assert client.get("/api/admin/users").status_code == 401

    bad = client.get("/api/auth/me", headers={"Authorization": "Bearer invalid.jwt.token"})
    assert bad.status_code == 401


def test_parent_cannot_access_unrelated_child_or_teacher_admin_routes(client: TestClient) -> None:
    parent1_headers = login_headers(client, "parent@littlesteps.edu")
    parent2_headers = login_headers(client, "parent2@littlesteps.edu")

    p1_children = client.get("/api/children", headers=parent1_headers).json()
    p2_children = client.get("/api/children", headers=parent2_headers).json()

    assert {c["display_name"] for c in p1_children} == {"Mia", "Leo"}
    assert {c["display_name"] for c in p2_children} == {"Sofia"}

    sofia_id = p2_children[0]["id"]
    # Parent 1 CAN view Mia
    mia_id = p1_children[0]["id"]
    assert client.get(f"/api/children/{mia_id}", headers=parent1_headers).status_code == 200
    assert client.get(f"/api/children/{mia_id}/progress", headers=parent1_headers).status_code == 200

    # Parent 1 CANNOT view or edit Sofia
    assert client.get(f"/api/children/{sofia_id}", headers=parent1_headers).status_code == 403
    assert client.get(f"/api/children/{sofia_id}/progress", headers=parent1_headers).status_code == 403
    assert (
        client.patch(
            f"/api/children/{sofia_id}", headers=parent1_headers, json={"display_name": "Hacked"}
        ).status_code
        == 403
    )

    # Parent CANNOT access Teacher or Admin routes
    assert client.get("/api/teacher/classes", headers=parent1_headers).status_code == 403
    assert client.get("/api/teacher/students", headers=parent1_headers).status_code == 403
    assert client.get("/api/admin/users", headers=parent1_headers).status_code == 403


def test_teacher_scoped_to_enrolled_students_and_blocked_from_admin(client: TestClient) -> None:
    teacher_headers = login_headers(client, "teacher@littlesteps.edu")
    parent1_headers = login_headers(client, "parent@littlesteps.edu")

    # Teacher sees assigned classes & enrolled students
    classes = client.get("/api/teacher/classes", headers=teacher_headers)
    assert classes.status_code == 200
    assert len(classes.json()) == 2

    students = client.get("/api/teacher/students", headers=teacher_headers)
    assert students.status_code == 200
    assert {s["display_name"] for s in students.json()} == {"Mia", "Leo", "Sofia"}

    # Parent creates a brand-new unenrolled child
    created = client.post(
        "/api/children",
        headers=parent1_headers,
        json={
            "display_name": "Mateo",
            "birth_year": 2021,
            "age_group": "4-5",
            "avatar_key": "bear",
            "favorite_color": "#9BE7C4",
            "daily_goal_minutes": 15,
        },
    )
    assert created.status_code == 201
    mateo_id = created.json()["id"]

    # Teacher CANNOT access unenrolled child
    assert client.get(f"/api/children/{mateo_id}", headers=teacher_headers).status_code == 403

    # Teacher CANNOT access Admin endpoints
    assert client.get("/api/admin/users", headers=teacher_headers).status_code == 403
    assert client.get("/api/admin/audit-logs", headers=teacher_headers).status_code == 403


def test_admin_can_manage_users_and_view_health_and_audit_logs(client: TestClient) -> None:
    admin_headers = login_headers(client, "admin@littlesteps.edu")

    health = client.get("/api/admin/system-health", headers=admin_headers)
    assert health.status_code == 200
    assert health.json()["status"] == "healthy"
    assert health.json()["counts"]["themes"] == 12

    users_resp = client.get("/api/admin/users", headers=admin_headers)
    assert users_resp.status_code == 200
    users = users_resp.json()
    parent2 = next(u for u in users if u["email"] == "parent2@littlesteps.edu")

    # Deactivate parent2
    patch_resp = client.patch(
        f"/api/admin/users/{parent2['id']}",
        headers=admin_headers,
        json={"is_active": False},
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["is_active"] is False

    # Deactivated user cannot log in
    blocked_login = client.post(
        "/api/auth/login",
        json={"email": "parent2@littlesteps.edu", "password": "LittleSteps2026!"},
    )
    assert blocked_login.status_code == 403

    # Audit log recorded the status update
    logs = client.get("/api/admin/audit-logs", headers=admin_headers)
    assert logs.status_code == 200
    actions = [entry["action"] for entry in logs.json()]
    assert "admin.user_status_updated" in actions
