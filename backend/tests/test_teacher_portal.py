from pathlib import Path

from fastapi.testclient import TestClient

from app.core.config import settings
from tests.conftest import login_headers

TINY_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00"
    b"\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)


def test_teacher_analytics_and_student_progress_isolation(client: TestClient) -> None:
    teacher_headers = login_headers(client, "teacher@littlesteps.edu")
    parent_headers = login_headers(client, "parent@littlesteps.edu")

    analytics = client.get("/api/teacher/analytics", headers=teacher_headers)
    assert analytics.status_code == 200, analytics.text
    a = analytics.json()
    assert a["total_classes"] == 2
    assert a["total_students"] == 3
    assert len(a["class_summaries"]) == 2
    assert len(a["subject_averages"]) == 6
    assert len(a["weekly_completions"]) == 7

    # Parent cannot access teacher analytics
    assert (
        client.get("/api/teacher/analytics", headers=parent_headers).status_code == 403
    )

    # Teacher CAN inspect Mia's detailed progress
    mia_id = next(
        s["id"]
        for s in client.get("/api/teacher/students", headers=teacher_headers).json()
        if s["display_name"] == "Mia"
    )
    mia_detail = client.get(
        f"/api/teacher/students/{mia_id}/progress", headers=teacher_headers
    )
    assert mia_detail.status_code == 200
    assert mia_detail.json()["child"]["display_name"] == "Mia"
    assert len(mia_detail.json()["observations"]) >= 1

    # Parent creates an unenrolled child -> teacher gets 403
    unenrolled = client.post(
        "/api/children",
        headers=parent_headers,
        json={
            "display_name": "UnenrolledKid",
            "birth_year": 2021,
            "age_group": "4-5",
            "avatar_key": "bear",
            "favorite_color": "#78C8F5",
            "daily_goal_minutes": 15,
        },
    ).json()
    assert (
        client.get(
            f"/api/teacher/students/{unenrolled['id']}/progress",
            headers=teacher_headers,
        ).status_code
        == 403
    )


def test_teacher_lesson_activity_theme_and_resource_upload(
    client: TestClient, tmp_path: Path, monkeypatch
) -> None:
    monkeypatch.setattr(settings, "LOCAL_UPLOAD_DIR", str(tmp_path))
    teacher_headers = login_headers(client, "teacher@littlesteps.edu")

    subjects = client.get("/api/subjects", headers=teacher_headers).json()
    subj_id = subjects[0]["id"]

    # Create draft lesson
    created = client.post(
        "/api/teacher/lessons",
        headers=teacher_headers,
        json={
            "title": "Playful Letter C Discovery",
            "subject_id": subj_id,
            "summary": "Explore /c/ words like cat, cloud, and cookie!",
            "age_group": "4-5",
            "estimated_minutes": 8,
            "status": "draft",
            "skill": "Phonics C",
            "slides": [
                {
                    "title": "Hello Letter C",
                    "text": "C sounds like /k/ in cat!",
                    "emoji": "🐱",
                }
            ],
        },
    )
    assert created.status_code == 201, created.text
    lesson_id = created.json()["id"]
    assert created.json()["status"] == "draft"

    # Publish lesson
    published = client.patch(
        f"/api/teacher/lessons/{lesson_id}",
        headers=teacher_headers,
        json={"status": "published"},
    )
    assert published.status_code == 200
    assert published.json()["status"] == "published"

    # Attach choice activity
    act = client.post(
        "/api/teacher/activities",
        headers=teacher_headers,
        json={
            "lesson_id": lesson_id,
            "title": "Spot the C Word",
            "instructions": "Tap the word starting with C.",
            "prompt": "Which picture starts with C?",
            "choices": ["Cat", "Dog", "Sun"],
            "correct_index": 0,
        },
    )
    assert act.status_code == 201, act.text
    detail = client.get(f"/api/lessons/{lesson_id}", headers=teacher_headers).json()
    assert len(detail["activities"]) == 1
    assert detail["activities"][0]["payload_json"]["engine"] == "choice"

    # Upload valid PNG resource
    res_up = client.post(
        f"/api/teacher/lessons/{lesson_id}/resources",
        headers=teacher_headers,
        data={"title": "Cat Flashcard"},
        files={"file": ("cat.png", TINY_PNG, "image/png")},
    )
    assert res_up.status_code == 201, res_up.text

    # Disallowed MIME type -> 400
    bad_up = client.post(
        f"/api/teacher/lessons/{lesson_id}/resources",
        headers=teacher_headers,
        data={"title": "Bad Script"},
        files={"file": ("evil.html", b"<script>alert(1)</script>", "text/html")},
    )
    assert bad_up.status_code == 400

    # Create Week 13 theme & update status
    theme = client.post(
        "/api/teacher/themes",
        headers=teacher_headers,
        json={
            "week_number": 13,
            "title": "Music & Movement",
            "summary": "Clap rhythms, dance joyfully, and listen to melodies.",
            "color_hex": "#B8A5F5",
            "status": "draft",
            "what_child_learns": "Exploring steady beat and tempo.",
        },
    )
    assert theme.status_code == 201, theme.text
    theme_id = theme.json()["id"]
    upd_theme = client.patch(
        f"/api/teacher/themes/{theme_id}",
        headers=teacher_headers,
        json={"status": "published"},
    )
    assert upd_theme.status_code == 200
    assert upd_theme.json()["status"] == "published"


def test_teacher_assignments_observations_feedback_announcements_and_isolation(
    client: TestClient,
) -> None:
    teacher_headers = login_headers(client, "teacher@littlesteps.edu")
    parent_headers = login_headers(client, "parent@littlesteps.edu")

    classes = client.get("/api/teacher/classes", headers=teacher_headers).json()
    sunshine_id = next(c["id"] for c in classes if "Sunshine" in c["name"])
    mia_id = next(
        s["id"]
        for s in client.get("/api/teacher/students", headers=teacher_headers).json()
        if s["display_name"] == "Mia"
    )
    lesson_id = client.get("/api/lessons", headers=teacher_headers).json()[0]["id"]

    # Create assignment for Sunshine Kinders
    assign = client.post(
        "/api/teacher/assignments",
        headers=teacher_headers,
        json={
            "title": "Morning Practice: Color Adventure",
            "class_id": sunshine_id,
            "lesson_id": lesson_id,
        },
    )
    assert assign.status_code == 201, assign.text
    assign_id = assign.json()["id"]
    assert assign.json()["target_count"] >= 1

    listed = client.get("/api/teacher/assignments", headers=teacher_headers).json()
    assert any(a["id"] == assign_id for a in listed)

    # Delete assignment
    assert (
        client.delete(
            f"/api/teacher/assignments/{assign_id}", headers=teacher_headers
        ).status_code
        == 204
    )

    # Observation + Feedback
    obs = client.post(
        "/api/teacher/observations",
        headers=teacher_headers,
        json={
            "child_id": mia_id,
            "class_id": sunshine_id,
            "category": "curiosity",
            "observation_text": "Mia asked thoughtful questions about rainbows!",
        },
    )
    assert obs.status_code == 201

    fb = client.post(
        "/api/teacher/feedback",
        headers=teacher_headers,
        json={
            "child_id": mia_id,
            "message": "Wonderful curiosity in art circle today!",
        },
    )
    assert fb.status_code == 201

    # Announcement
    ann = client.post(
        "/api/teacher/announcements",
        headers=teacher_headers,
        json={
            "title": "Friday Pajama Story Day",
            "body": "Bring your favorite cozy storybook this Friday!",
            "class_id": sunshine_id,
        },
    )
    assert ann.status_code == 201
    assert any(
        a["title"] == "Friday Pajama Story Day"
        for a in client.get("/api/teacher/announcements", headers=teacher_headers).json()
    )

    # Parent reflections visible to teacher
    refls = client.get("/api/teacher/reflections", headers=teacher_headers)
    assert refls.status_code == 200
    assert len(refls.json()) >= 1

    # Notifications arrived for Parent 1
    notifs = client.get("/api/parent/notifications", headers=parent_headers).json()
    assert any("Pajama Story Day" in n["title"] for n in notifs["items"])

    # Unenrolled child blocked for observations/feedback
    unenrolled = client.post(
        "/api/children",
        headers=parent_headers,
        json={
            "display_name": "SoloKid",
            "birth_year": 2021,
            "age_group": "4-5",
            "avatar_key": "fox",
            "favorite_color": "#B8A5F5",
            "daily_goal_minutes": 15,
        },
    ).json()
    assert (
        client.post(
            "/api/teacher/observations",
            headers=teacher_headers,
            json={"child_id": unenrolled["id"], "observation_text": "Test"},
        ).status_code
        == 403
    )
    assert (
        client.post(
            "/api/teacher/feedback",
            headers=teacher_headers,
            json={"child_id": unenrolled["id"], "message": "Test"},
        ).status_code
        == 403
    )
