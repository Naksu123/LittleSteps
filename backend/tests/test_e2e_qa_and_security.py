import base64
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.services.storage_service import StorageValidationError, storage_service
from tests.conftest import login_headers

VALID_PNG_B64 = base64.b64encode(
    b"\x89PNG\r\n\x1a\n"
    b"\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde"
    b"\x00\x00\x00\x0cIDATx\x9cc`\x00\x00\x00\x02\x00\x01H\xaf\xa4q\x00\x00\x00\x00IEND\xaeB`\x82"
).decode("ascii")


def test_full_cross_role_kindergarten_lifecycle_e2e(
    client: TestClient, tmp_path: Path, monkeypatch
) -> None:
    monkeypatch.setattr(settings, "LOCAL_UPLOAD_DIR", str(tmp_path / "uploads"))

    # 1. Parent registers with RA 10173 consent & creates learner profile
    reg_resp = client.post(
        "/api/auth/register",
        json={
            "email": "e2e.parent@littlesteps.edu",
            "password": "FamilyPassword2026!",
            "full_name": "Marco Villanueva",
            "privacy_consent_accepted": True,
        },
    )
    assert reg_resp.status_code == 201, reg_resp.text
    parent_headers = {"Authorization": f"Bearer {reg_resp.json()['access_token']}"}

    child_resp = client.post(
        "/api/children",
        headers=parent_headers,
        json={
            "display_name": "Tala",
            "birth_year": 2021,
            "age_group": "4-5",
            "avatar_key": "fox",
            "favorite_color": "#FFE58A",
            "daily_goal_minutes": 20,
        },
    )
    assert child_resp.status_code == 201, child_resp.text
    tala_id = child_resp.json()["id"]

    # 2. Admin provisions teacher, classroom, assignment, and enrollment
    admin_headers = login_headers(client, "admin@littlesteps.edu")
    teacher_resp = client.post(
        "/api/admin/users",
        headers=admin_headers,
        json={
            "email": "rico.teacher@littlesteps.edu",
            "full_name": "Teacher Rico Bautista",
            "password": "TeacherPassword2026!",
            "role": "teacher",
        },
    )
    assert teacher_resp.status_code == 201
    teacher_id = teacher_resp.json()["id"]

    cls_resp = client.post(
        "/api/admin/classes",
        headers=admin_headers,
        json={
            "name": "Morning Butterflies",
            "age_group": "4-5",
            "academic_year": "2026-2027",
            "room_label": "Room D-1",
        },
    )
    assert cls_resp.status_code == 201
    cls_id = cls_resp.json()["id"]

    assert (
        client.post(
            f"/api/admin/classes/{cls_id}/teachers",
            headers=admin_headers,
            json={"teacher_user_id": teacher_id, "is_lead": True},
        ).status_code
        == 201
    )
    assert (
        client.post(
            f"/api/admin/classes/{cls_id}/enrollments",
            headers=admin_headers,
            json={"child_id": tala_id},
        ).status_code
        == 201
    )

    # 3. Teacher authors a lesson, adds an activity, and assigns it
    teacher_headers = login_headers(client, "rico.teacher@littlesteps.edu", "TeacherPassword2026!")
    students = client.get("/api/teacher/students", headers=teacher_headers).json()
    assert [s["display_name"] for s in students] == ["Tala"]

    subjects = client.get("/api/subjects", headers=teacher_headers).json()
    themes = client.get("/api/themes", headers=teacher_headers).json()
    lesson_resp = client.post(
        "/api/teacher/lessons",
        headers=teacher_headers,
        json={
            "title": "Hello Sunshine",
            "subject_id": subjects[0]["id"],
            "theme_id": themes[0]["id"],
            "summary": "Celebrate morning routines and bright yellow sunbeams!",
            "age_group": "4-5",
            "estimated_minutes": 10,
            "status": "published",
            "slides": [
                {
                    "title": "Good Morning!",
                    "text": "The warm sun wakes up the garden.",
                    "emoji": "☀️",
                }
            ],
        },
    )
    assert lesson_resp.status_code == 201
    lesson_id = lesson_resp.json()["id"]

    act_resp = client.post(
        "/api/teacher/activities",
        headers=teacher_headers,
        json={
            "lesson_id": lesson_id,
            "title": "Spot the Morning Star",
            "instructions": "Tap the bright sun picture!",
            "prompt": "Which one shines in the daytime sky?",
            "choices": ["Sun", "Pillow", "Spoon"],
            "correct_index": 0,
        },
    )
    assert act_resp.status_code == 201

    assign_resp = client.post(
        "/api/teacher/assignments",
        headers=teacher_headers,
        json={
            "title": "Sunshine Exploration",
            "class_id": cls_id,
            "lesson_id": lesson_id,
        },
    )
    assert assign_resp.status_code == 201

    # 4. Kids Mode progress, game, artwork, and Parent Home Learning Hub
    assert (
        client.post(
            "/api/progress/lesson",
            headers=parent_headers,
            json={
                "child_id": tala_id,
                "lesson_id": lesson_id,
                "status": "completed",
                "completion_pct": 100,
                "time_spent_seconds": 240,
            },
        ).status_code
        == 200
    )

    games = client.get("/api/games", headers=parent_headers).json()
    assert (
        client.post(
            "/api/progress/activity",
            headers=parent_headers,
            json={
                "child_id": tala_id,
                "game_id": games[0]["id"],
                "score_pct": 100,
                "attempts_count": 1,
                "duration_seconds": 90,
                "completed": True,
            },
        ).status_code
        == 200
    )

    art_resp = client.post(
        f"/api/children/{tala_id}/artworks",
        headers=parent_headers,
        json={
            "title": "Yellow Sunbeam",
            "image_data": f"data:image/png;base64,{VALID_PNG_B64}",
            "palette_used": ["#FFE58A", "#78C8F5"],
        },
    )
    assert art_resp.status_code == 201
    artwork_id = art_resp.json()["id"]

    hub = client.get(f"/api/parent/home-learning?child_id={tala_id}", headers=parent_headers).json()
    first_ha_id = hub[0]["home_activities"][0]["id"]
    first_theme_id = hub[0]["theme"]["id"]

    assert (
        client.post(
            f"/api/parent/home-activities/{first_ha_id}/progress",
            headers=parent_headers,
            json={"child_id": tala_id, "completed": True},
        ).status_code
        == 200
    )
    assert (
        client.post(
            "/api/parent/reflections",
            headers=parent_headers,
            json={
                "child_id": tala_id,
                "theme_id": first_theme_id,
                "enjoyed": True,
                "easy_concepts": "Finding red and yellow items together.",
                "discovery_notes": "Tala counted 4 yellow blocks!",
            },
        ).status_code
        == 201
    )

    # 5. Teacher reviews student detail & reflections, sends observation & feedback
    detail = client.get(f"/api/teacher/students/{tala_id}/progress", headers=teacher_headers).json()
    assert detail["lessons_completed"] >= 1
    assert detail["games_played"] >= 1
    assert len(detail["reflections"]) >= 1

    assert (
        client.post(
            "/api/teacher/observations",
            headers=teacher_headers,
            json={
                "child_id": tala_id,
                "class_id": cls_id,
                "category": "creativity",
                "observation_text": "Tala enthusiastically shared her sunbeam drawing!",
            },
        ).status_code
        == 201
    )
    assert (
        client.post(
            "/api/teacher/feedback",
            headers=teacher_headers,
            json={
                "child_id": tala_id,
                "message": "Wonderful home Color Hunt reflection this week!",
            },
        ).status_code
        == 201
    )

    # 6. Parent Weekly Report & Admin Analytics / Privacy-Preserving Storage / Audit
    report = client.get(f"/api/parent/reports?child_id={tala_id}", headers=parent_headers).json()
    assert report["this_week_lessons"] >= 1
    assert report["home_activities_completed_this_week"] >= 1
    assert len(report["teacher_observations"]) >= 1
    assert len(report["teacher_feedback"]) >= 1
    assert len(report["reflections"]) >= 1

    storage = client.get("/api/admin/storage", headers=admin_headers).json()
    art_entry = next(i for i in storage["items"] if i["id"] == artwork_id)
    assert art_entry["parent_label"] == "Kids Art Studio"
    assert "Tala" not in art_entry["parent_label"]

    analytics = client.get("/api/admin/analytics", headers=admin_headers).json()
    assert analytics["total_lessons_completed"] >= 1
    assert analytics["total_home_activities_completed"] >= 1


def test_security_hardening_penetration_checks(
    client: TestClient, tmp_path: Path, monkeypatch
) -> None:
    monkeypatch.setattr(settings, "LOCAL_UPLOAD_DIR", str(tmp_path / "uploads"))

    login_resp = client.post(
        "/api/auth/login",
        json={"email": "parent2@littlesteps.edu", "password": "LittleSteps2026!"},
    )
    assert login_resp.status_code == 200
    tokens = login_resp.json()
    p2_access = tokens["access_token"]
    p2_refresh = tokens["refresh_token"]

    # 1. Refresh token cannot be used as Bearer access token
    assert (
        client.get("/api/auth/me", headers={"Authorization": f"Bearer {p2_refresh}"}).status_code
        == 401
    )

    # 2. Refresh token rotation invalidates previous refresh token
    rot_resp = client.post("/api/auth/refresh", json={"refresh_token": p2_refresh})
    assert rot_resp.status_code == 200
    rotated_refresh = rot_resp.json()["refresh_token"]
    assert client.post("/api/auth/refresh", json={"refresh_token": p2_refresh}).status_code == 401

    # 3. Deactivating a user revokes active refresh tokens (even after re-activation)
    admin_headers = login_headers(client, "admin@littlesteps.edu")
    p2_id = tokens["user"]["id"]
    assert (
        client.patch(
            f"/api/admin/users/{p2_id}",
            headers=admin_headers,
            json={"is_active": False},
        ).status_code
        == 200
    )
    assert (
        client.post("/api/auth/refresh", json={"refresh_token": rotated_refresh}).status_code
        == 401
    )
    assert (
        client.patch(
            f"/api/admin/users/{p2_id}",
            headers=admin_headers,
            json={"is_active": True},
        ).status_code
        == 200
    )
    assert (
        client.post("/api/auth/refresh", json={"refresh_token": rotated_refresh}).status_code
        == 401
    )

    # 4. Path traversal rejected in StorageService
    with pytest.raises(StorageValidationError):
        storage_service._resolve_local_path("../../etc/passwd")

    # 5. Spoofed non-PNG image rejected & valid PNG serves safe Content-Disposition
    p2_headers = {"Authorization": f"Bearer {p2_access}"}
    # Log in freshly because p2 was deactivated & reactivated
    p2_headers = login_headers(client, "parent2@littlesteps.edu")
    sofia_id = client.get("/api/children", headers=p2_headers).json()[0]["id"]

    spoof_b64 = base64.b64encode(b"NOT_A_REAL_PNG_FILE").decode("ascii")
    bad_art = client.post(
        f"/api/children/{sofia_id}/artworks",
        headers=p2_headers,
        json={
            "title": "Spoofed",
            "image_data": f"data:image/png;base64,{spoof_b64}",
            "palette_used": ["#78C8F5"],
        },
    )
    assert bad_art.status_code == 400

    good_art = client.post(
        f"/api/children/{sofia_id}/artworks",
        headers=p2_headers,
        json={
            "title": "Safe Art",
            "image_data": f"data:image/png;base64,{VALID_PNG_B64}",
            "palette_used": ["#78C8F5"],
        },
    )
    assert good_art.status_code == 201
    img_resp = client.get(
        f"/api/children/{sofia_id}/artworks/{good_art.json()['id']}/image",
        headers=p2_headers,
    )
    assert img_resp.status_code == 200
    assert img_resp.headers.get("Content-Disposition") == 'inline; filename="artwork.png"'
    assert img_resp.headers.get("X-Content-Type-Options") == "nosniff"

    # 6. SQL injection strings parameterized cleanly
    sqli_users = client.get(
        "/api/admin/users?search=' OR '1'='1", headers=admin_headers
    )
    assert sqli_users.status_code == 200
    sqli_logs = client.get(
        "/api/admin/audit-logs?action='; DROP TABLE users;--", headers=admin_headers
    )
    assert sqli_logs.status_code == 200
    assert len(client.get("/api/admin/users", headers=admin_headers).json()) >= 4

    # 7. Child profile updates emit non-PII learner.updated audit entries
    patch_child = client.patch(
        f"/api/children/{sofia_id}",
        headers=p2_headers,
        json={"daily_goal_minutes": 25},
    )
    assert patch_child.status_code == 200
    logs = client.get(
        "/api/admin/audit-logs?action=learner.updated", headers=admin_headers
    ).json()
    assert len(logs) >= 1
    assert logs[0]["details_json"]["fields"] == ["daily_goal_minutes"]
    assert "Sofia" not in str(logs[0]["details_json"])
