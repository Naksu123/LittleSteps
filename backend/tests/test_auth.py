from fastapi.testclient import TestClient

from app.core.config import settings


def test_parent_registration_requires_privacy_consent(client: TestClient) -> None:
    resp = client.post(
        "/api/auth/register",
        json={
            "email": "newparent@example.com",
            "password": "StrongPassword123!",
            "full_name": "Ana Villanueva",
            "privacy_consent_accepted": False,
        },
    )
    assert resp.status_code == 400


def test_parent_registration_login_refresh_and_logout(client: TestClient) -> None:
    reg = client.post(
        "/api/auth/register",
        json={
            "email": "newparent@example.com",
            "password": "StrongPassword123!",
            "full_name": "Ana Villanueva",
            "privacy_consent_accepted": True,
        },
    )
    assert reg.status_code == 201
    reg_body = reg.json()
    assert reg_body["user"]["roles"] == ["parent"]
    assert reg_body["access_token"]
    assert reg_body["refresh_token"]

    # Duplicate email rejected
    dup = client.post(
        "/api/auth/register",
        json={
            "email": "newparent@example.com",
            "password": "StrongPassword123!",
            "full_name": "Another Name",
            "privacy_consent_accepted": True,
        },
    )
    assert dup.status_code == 409

    # Duplicate full name rejected (case-insensitive)
    dup_name = client.post(
        "/api/auth/register",
        json={
            "email": "unique-email@example.com",
            "password": "StrongPassword123!",
            "full_name": "ana villanueva",
            "privacy_consent_accepted": True,
        },
    )
    assert dup_name.status_code == 409

    # Login
    login = client.post(
        "/api/auth/login",
        json={"email": "newparent@example.com", "password": "StrongPassword123!"},
    )
    assert login.status_code == 200
    tokens = login.json()

    # Me endpoint
    me = client.get(
        "/api/auth/me", headers={"Authorization": f"Bearer {tokens['access_token']}"}
    )
    assert me.status_code == 200
    assert me.json()["user"]["email"] == "newparent@example.com"

    # Refresh token rotation
    refreshed = client.post(
        "/api/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert refreshed.status_code == 200
    new_tokens = refreshed.json()
    assert new_tokens["refresh_token"] != tokens["refresh_token"]

    # Old refresh token cannot be reused
    reused = client.post(
        "/api/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert reused.status_code == 401

    # Logout revokes new refresh token
    logout = client.post(
        "/api/auth/logout",
        headers={"Authorization": f"Bearer {new_tokens['access_token']}"},
        json={"refresh_token": new_tokens["refresh_token"]},
    )
    assert logout.status_code == 204

    after_logout = client.post(
        "/api/auth/refresh", json={"refresh_token": new_tokens["refresh_token"]}
    )
    assert after_logout.status_code == 401


def test_wrong_password_returns_401(client: TestClient) -> None:
    resp = client.post(
        "/api/auth/login",
        json={"email": "parent@littlesteps.edu", "password": "WrongPassword999!"},
    )
    assert resp.status_code == 401


def test_public_login_blocks_teacher_and_admin_accounts(client: TestClient) -> None:
    for staff_email in ("teacher@littlesteps.edu", "admin@littlesteps.edu"):
        resp = client.post(
            "/api/auth/login",
            json={"email": staff_email, "password": "LittleSteps2026!"},
        )
        assert resp.status_code == 401
        assert resp.json()["detail"] == "Invalid email or password."


def test_staff_login_requires_access_code_and_staff_role(client: TestClient) -> None:
    # Wrong access code rejected for admin and teacher
    for staff_email in ("admin@littlesteps.edu", "teacher@littlesteps.edu"):
        bad_code = client.post(
            "/api/auth/staff-login",
            json={
                "email": staff_email,
                "password": "LittleSteps2026!",
                "access_code": "WRONG-CODE-000",
            },
        )
        assert bad_code.status_code == 401

    # Parent cannot log in via staff gate even with valid access code
    parent_staff_attempt = client.post(
        "/api/auth/staff-login",
        json={
            "email": "parent@littlesteps.edu",
            "password": "LittleSteps2026!",
            "access_code": settings.STAFF_ACCESS_CODE,
        },
    )
    assert parent_staff_attempt.status_code == 401

    # Valid teacher & admin login with private access code
    teacher_resp = client.post(
        "/api/auth/staff-login",
        json={
            "email": "teacher@littlesteps.edu",
            "password": "LittleSteps2026!",
            "access_code": settings.STAFF_ACCESS_CODE,
        },
    )
    assert teacher_resp.status_code == 200
    assert teacher_resp.json()["user"]["roles"] == ["teacher"]

    admin_resp = client.post(
        "/api/auth/staff-login",
        json={
            "email": "admin@littlesteps.edu",
            "password": "LittleSteps2026!",
            "access_code": settings.STAFF_ACCESS_CODE,
        },
    )
    assert admin_resp.status_code == 200
    admin_body = admin_resp.json()
    assert admin_body["user"]["roles"] == ["admin"]

    logs = client.get(
        "/api/admin/audit-logs?action=auth.staff_login",
        headers={"Authorization": f"Bearer {admin_body['access_token']}"},
    )
    assert logs.status_code == 200
    assert len(logs.json()) >= 2
