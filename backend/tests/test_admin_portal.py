import base64
from pathlib import Path

from fastapi.testclient import TestClient

from app.core.config import settings
from tests.conftest import login_headers

SAMPLE_PNG_B64 = base64.b64encode(
    b"\x89PNG\r\n\x1a\n"
    b"\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde"
    b"\x00\x00\x00\x0cIDATx\x9cc`\x00\x00\x00\x02\x00\x01H\xaf\xa4q\x00\x00\x00\x00IEND\xaeB`\x82"
).decode("ascii")


def test_admin_user_lifecycle_and_self_protection(client: TestClient) -> None:
    admin_headers = login_headers(client, "admin@littlesteps.edu")
    me = client.get("/api/auth/me", headers=admin_headers).json()
    admin_id = me["user"]["id"]

    # Create a new teacher account
    create_resp = client.post(
        "/api/admin/users",
        headers=admin_headers,
        json={
            "email": "Coach.Ben@littlesteps.edu",
            "full_name": "Teacher Ben Flores",
            "password": "Kindergarten2026!",
            "role": "teacher",
            "is_active": True,
        },
    )
    assert create_resp.status_code == 201, create_resp.text
    created_user = create_resp.json()
    assert created_user["email"] == "coach.ben@littlesteps.edu"
    assert created_user["roles"] == ["teacher"]

    # Duplicate email returns 409
    dup_resp = client.post(
        "/api/admin/users",
        headers=admin_headers,
        json={
            "email": "coach.ben@littlesteps.edu",
            "full_name": "Duplicate Ben",
            "password": "Kindergarten2026!",
            "role": "teacher",
        },
    )
    assert dup_resp.status_code == 409

    # Duplicate full name returns 409 (case-insensitive)
    dup_name_resp = client.post(
        "/api/admin/users",
        headers=admin_headers,
        json={
            "email": "different.email@littlesteps.edu",
            "full_name": "teacher ben flores",
            "password": "Kindergarten2026!",
            "role": "teacher",
        },
    )
    assert dup_name_resp.status_code == 409

    # Filter users by role and active status
    teachers_resp = client.get("/api/admin/users?role=teacher&is_active=true", headers=admin_headers)
    assert teachers_resp.status_code == 200
    assert any(u["id"] == created_user["id"] for u in teachers_resp.json())

    # Update user name and roles
    patch_resp = client.patch(
        f"/api/admin/users/{created_user['id']}",
        headers=admin_headers,
        json={"full_name": "Coach Ben Flores", "roles": ["teacher", "parent"]},
    )
    assert patch_resp.status_code == 200, patch_resp.text
    assert patch_resp.json()["full_name"] == "Coach Ben Flores"
    assert patch_resp.json()["roles"] == ["parent", "teacher"]

    # Self-deactivation and self-admin-demotion are blocked
    assert (
        client.patch(
            f"/api/admin/users/{admin_id}",
            headers=admin_headers,
            json={"is_active": False},
        ).status_code
        == 400
    )
    assert (
        client.patch(
            f"/api/admin/users/{admin_id}",
            headers=admin_headers,
            json={"roles": ["teacher"]},
        ).status_code
        == 400
    )


def test_admin_class_teacher_assignment_and_enrollment_flow(client: TestClient) -> None:
    admin_headers = login_headers(client, "admin@littlesteps.edu")
    parent1_headers = login_headers(client, "parent@littlesteps.edu")

    # Create a new teacher and new learner profile
    teacher_user = client.post(
        "/api/admin/users",
        headers=admin_headers,
        json={
            "email": "newteacher@littlesteps.edu",
            "full_name": "Teacher Lina Gomez",
            "password": "Kindergarten2026!",
            "role": "teacher",
        },
    ).json()

    new_child = client.post(
        "/api/children",
        headers=parent1_headers,
        json={
            "display_name": "Lucas",
            "birth_year": 2021,
            "age_group": "4-5",
            "avatar_key": "fox",
            "favorite_color": "#78C8F5",
            "daily_goal_minutes": 15,
        },
    ).json()

    # Create class, update it, assign teacher, enroll Lucas
    created_class_resp = client.post(
        "/api/admin/classes",
        headers=admin_headers,
        json={
            "name": "Starlight Kinders",
            "age_group": "4-5",
            "academic_year": "2026-2027",
            "room_label": "Room C-3",
        },
    )
    assert created_class_resp.status_code == 201, created_class_resp.text
    cls_id = created_class_resp.json()["id"]

    updated_cls = client.patch(
        f"/api/admin/classes/{cls_id}",
        headers=admin_headers,
        json={"room_label": "Room C-3B"},
    )
    assert updated_cls.status_code == 200
    assert updated_cls.json()["room_label"] == "Room C-3B"

    assign_resp = client.post(
        f"/api/admin/classes/{cls_id}/teachers",
        headers=admin_headers,
        json={"teacher_user_id": teacher_user["id"], "is_lead": True},
    )
    assert assign_resp.status_code == 201
    assert len(assign_resp.json()["teachers"]) == 1

    enroll_resp = client.post(
        f"/api/admin/classes/{cls_id}/enrollments",
        headers=admin_headers,
        json={"child_id": new_child["id"]},
    )
    assert enroll_resp.status_code == 201
    assert any(s["display_name"] == "Lucas" for s in enroll_resp.json()["students"])

    # Admin learner directory lists Lucas in Starlight Kinders
    children_dir = client.get("/api/admin/children", headers=admin_headers)
    assert children_dir.status_code == 200
    lucas_entry = next(c for c in children_dir.json() if c["id"] == new_child["id"])
    assert "Starlight Kinders" in lucas_entry["class_names"]

    # Newly assigned teacher can now see Lucas via teacher API
    new_teacher_headers = login_headers(client, "newteacher@littlesteps.edu", "Kindergarten2026!")
    teacher_students = client.get("/api/teacher/students", headers=new_teacher_headers)
    assert teacher_students.status_code == 200
    assert [s["display_name"] for s in teacher_students.json()] == ["Lucas"]

    # Unenroll child and remove teacher
    assert (
        client.delete(
            f"/api/admin/classes/{cls_id}/enrollments/{new_child['id']}",
            headers=admin_headers,
        ).status_code
        == 204
    )
    assert (
        client.delete(
            f"/api/admin/classes/{cls_id}/teachers/{teacher_user['id']}",
            headers=admin_headers,
        ).status_code
        == 204
    )


def test_admin_subjects_content_analytics_storage_settings_and_audit(
    client: TestClient, tmp_path: Path, monkeypatch
) -> None:
    monkeypatch.setattr(settings, "LOCAL_UPLOAD_DIR", str(tmp_path / "uploads"))
    admin_headers = login_headers(client, "admin@littlesteps.edu")
    parent1_headers = login_headers(client, "parent@littlesteps.edu")

    # 1. Subject CRUD
    subj_create = client.post(
        "/api/admin/subjects",
        headers=admin_headers,
        json={
            "name": "Music & Rhythm",
            "description": "Clapping patterns, cheerful songs, and gentle instruments.",
            "icon_key": "music",
            "color_hex": "#B8A5F5",
            "sort_order": 7,
        },
    )
    assert subj_create.status_code == 201, subj_create.text
    subj_id = subj_create.json()["id"]

    subj_patch = client.patch(
        f"/api/admin/subjects/{subj_id}",
        headers=admin_headers,
        json={"is_active": False},
    )
    assert subj_patch.status_code == 200
    assert subj_patch.json()["is_active"] is False

    # 2. Content Governance
    content_resp = client.get("/api/admin/content", headers=admin_headers)
    assert content_resp.status_code == 200
    content = content_resp.json()
    assert len(content["lessons"]) >= 6
    assert len(content["themes"]) == 12

    lesson_id = content["lessons"][0]["id"]
    theme_id = content["themes"][0]["id"]
    assert (
        client.patch(
            f"/api/admin/lessons/{lesson_id}/status",
            headers=admin_headers,
            json={"status": "draft"},
        ).json()["status"]
        == "draft"
    )
    assert (
        client.patch(
            f"/api/admin/themes/{theme_id}/status",
            headers=admin_headers,
            json={"status": "published"},
        ).json()["status"]
        == "published"
    )

    # 3. Create artwork asset and inspect/delete via Admin Storage
    mia_id = client.get("/api/children", headers=parent1_headers).json()[0]["id"]
    art_resp = client.post(
        f"/api/children/{mia_id}/artworks",
        headers=parent1_headers,
        json={
            "title": "Rainbow Butterfly",
            "image_data": f"data:image/png;base64,{SAMPLE_PNG_B64}",
            "palette_used": ["#FF9C8C", "#78C8F5"],
        },
    )
    assert art_resp.status_code == 201
    artwork_id = art_resp.json()["id"]

    storage_resp = client.get("/api/admin/storage", headers=admin_headers)
    assert storage_resp.status_code == 200
    storage_data = storage_resp.json()
    assert storage_data["total_items"] >= 1
    art_item = next(i for i in storage_data["items"] if i["id"] == artwork_id)
    assert art_item["item_type"] == "child_artwork"
    assert art_item["parent_label"] == "Kids Art Studio"
    assert "Mia" not in art_item["parent_label"]
    assert art_item["file_size_bytes"] > 0

    # 4. Analytics
    analytics_resp = client.get("/api/admin/analytics", headers=admin_headers)
    assert analytics_resp.status_code == 200
    analytics = analytics_resp.json()
    assert analytics["users_by_role"]["admin"] >= 1
    assert analytics["users_by_role"]["teacher"] >= 1
    assert analytics["users_by_role"]["parent"] >= 2
    assert len(analytics["daily_activity"]) == 7
    assert len(analytics["subject_distribution"]) >= 6
    assert analytics["total_storage_items"] >= 1

    # Delete storage item
    del_storage = client.delete(
        f"/api/admin/storage/child_artwork/{artwork_id}",
        headers=admin_headers,
    )
    assert del_storage.status_code == 204
    after_storage = client.get("/api/admin/storage", headers=admin_headers).json()
    assert not any(i["id"] == artwork_id for i in after_storage["items"])

    # 5. Platform Settings & Filtered Audit Logs
    settings_resp = client.get("/api/admin/settings", headers=admin_headers)
    assert settings_resp.status_code == 200
    assert len(settings_resp.json()) >= 2

    put_setting = client.put(
        "/api/admin/settings/max_upload_mb",
        headers=admin_headers,
        json={"value_json": {"limit": 15}, "description": "Updated upload limit"},
    )
    assert put_setting.status_code == 200
    assert put_setting.json()["value_json"]["limit"] == 15

    filtered_logs = client.get(
        "/api/admin/audit-logs?action=admin.setting_updated&resource_type=platform_setting",
        headers=admin_headers,
    )
    assert filtered_logs.status_code == 200
    assert len(filtered_logs.json()) >= 1
    assert filtered_logs.json()[0]["resource_id"] == "max_upload_mb"


def test_non_admin_users_blocked_from_new_admin_endpoints(client: TestClient) -> None:
    parent_headers = login_headers(client, "parent@littlesteps.edu")
    teacher_headers = login_headers(client, "teacher@littlesteps.edu")

    endpoints = [
        ("GET", "/api/admin/children"),
        ("GET", "/api/admin/classes"),
        ("GET", "/api/admin/subjects"),
        ("GET", "/api/admin/content"),
        ("GET", "/api/admin/analytics"),
        ("GET", "/api/admin/storage"),
        ("GET", "/api/admin/settings"),
    ]
    for headers in (parent_headers, teacher_headers):
        for method, path in endpoints:
            resp = client.request(method, path, headers=headers)
            assert resp.status_code == 403, f"Expected 403 for {method} {path}, got {resp.status_code}"

        assert (
            client.post(
                "/api/admin/users",
                headers=headers,
                json={
                    "email": "blocked@littlesteps.edu",
                    "full_name": "Blocked User",
                    "password": "Password123!",
                    "role": "parent",
                },
            ).status_code
            == 403
        )
        assert (
            client.put(
                "/api/admin/settings/max_upload_mb",
                headers=headers,
                json={"value_json": {"limit": 99}},
            ).status_code
            == 403
        )
