from fastapi.testclient import TestClient

from tests.conftest import login_headers


def _create_fresh_child(client: TestClient, headers: dict[str, str], name: str = "Toby") -> str:
    resp = client.post(
        "/api/children",
        headers=headers,
        json={
            "display_name": name,
            "birth_year": 2021,
            "age_group": "4-5",
            "avatar_key": "owl",
            "favorite_color": "#9BE7C4",
            "daily_goal_minutes": 15,
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def test_lesson_completion_stars_streak_and_repeat_idempotency(client: TestClient) -> None:
    headers = login_headers(client, "parent@littlesteps.edu")
    child_id = _create_fresh_child(client, headers)

    lessons = client.get("/api/lessons", headers=headers).json()
    lesson = next(item for item in lessons if item["slug"] == "alphabet-letter-b")

    # Lesson detail includes slides and choice activity
    detail = client.get(f"/api/lessons/{lesson['id']}", headers=headers)
    assert detail.status_code == 200
    detail_body = detail.json()
    assert len(detail_body["content_json"]["slides"]) >= 3
    assert detail_body["activities"][0]["payload_json"]["engine"] == "choice"

    # First completion awards 3 lesson stars + 2 first_lesson badge stars = 5 total
    first = client.post(
        "/api/progress/lesson",
        headers=headers,
        json={
            "child_id": child_id,
            "lesson_id": lesson["id"],
            "status": "completed",
            "completion_pct": 100,
            "time_spent_seconds": 120,
        },
    )
    assert first.status_code == 200, first.text
    body = first.json()
    assert body["stars_awarded"] == 3
    assert body["total_stars"] == 5
    assert body["streak_days"] == 1
    assert "first_lesson" in [r["badge_key"] for r in body["new_rewards"]]

    # Repeating completion does not farm extra stars
    repeat = client.post(
        "/api/progress/lesson",
        headers=headers,
        json={
            "child_id": child_id,
            "lesson_id": lesson["id"],
            "status": "completed",
            "completion_pct": 100,
            "time_spent_seconds": 60,
        },
    )
    assert repeat.status_code == 200
    assert repeat.json()["stars_awarded"] == 0
    assert repeat.json()["total_stars"] == 5

    # Summary lists the completed lesson
    summary = client.get(f"/api/progress/summary/{child_id}", headers=headers)
    assert summary.status_code == 200
    statuses = summary.json()["lesson_statuses"]
    assert any(s["lesson_id"] == lesson["id"] and s["status"] == "completed" for s in statuses)


def test_progress_access_control_and_activity_validation(client: TestClient) -> None:
    p1_headers = login_headers(client, "parent@littlesteps.edu")
    p2_headers = login_headers(client, "parent2@littlesteps.edu")

    sofia_id = client.get("/api/children", headers=p2_headers).json()[0]["id"]
    lessons = client.get("/api/lessons", headers=p1_headers).json()
    games = client.get("/api/games", headers=p1_headers).json()

    # Parent 1 cannot post progress for Sofia
    forbidden = client.post(
        "/api/progress/lesson",
        headers=p1_headers,
        json={
            "child_id": sofia_id,
            "lesson_id": lessons[0]["id"],
            "status": "completed",
            "completion_pct": 100,
            "time_spent_seconds": 30,
        },
    )
    assert forbidden.status_code == 403

    mia_id = client.get("/api/children", headers=p1_headers).json()[0]["id"]
    lesson_detail = client.get(f"/api/lessons/{lessons[0]['id']}", headers=p1_headers).json()
    activity_id = lesson_detail["activities"][0]["id"]

    # Both game_id and activity_id -> 422
    both = client.post(
        "/api/progress/activity",
        headers=p1_headers,
        json={
            "child_id": mia_id,
            "game_id": games[0]["id"],
            "activity_id": activity_id,
            "score_pct": 100,
            "attempts_count": 1,
            "duration_seconds": 20,
            "completed": True,
        },
    )
    assert both.status_code == 422

    # Neither game_id nor activity_id -> 422
    neither = client.post(
        "/api/progress/activity",
        headers=p1_headers,
        json={
            "child_id": mia_id,
            "score_pct": 100,
            "attempts_count": 1,
            "duration_seconds": 20,
            "completed": True,
        },
    )
    assert neither.status_code == 422


def test_game_daily_star_cap_and_game_configs(client: TestClient) -> None:
    headers = login_headers(client, "parent@littlesteps.edu")
    child_id = _create_fresh_child(client, headers, "Milo")

    games_resp = client.get("/api/games", headers=headers)
    assert games_resp.status_code == 200
    games = games_resp.json()
    assert len(games) == 16
    for game in games:
        assert game["config_json"]["engine"] in {"choice", "sort", "memory", "puzzle"}

    single_game = client.get(f"/api/games/{games[0]['id']}", headers=headers)
    assert single_game.status_code == 200

    first_play = client.post(
        "/api/progress/activity",
        headers=headers,
        json={
            "child_id": child_id,
            "game_id": games[0]["id"],
            "score_pct": 90,
            "attempts_count": 1,
            "duration_seconds": 45,
            "completed": True,
        },
    )
    assert first_play.status_code == 200
    assert first_play.json()["stars_awarded"] > 0
    assert "game_starter" in [r["badge_key"] for r in first_play.json()["new_rewards"]]

    second_play = client.post(
        "/api/progress/activity",
        headers=headers,
        json={
            "child_id": child_id,
            "game_id": games[0]["id"],
            "score_pct": 100,
            "attempts_count": 1,
            "duration_seconds": 30,
            "completed": True,
        },
    )
    assert second_play.status_code == 200
    assert second_play.json()["stars_awarded"] == 0


def test_quiz_endpoint_scoring_and_badge(client: TestClient) -> None:
    headers = login_headers(client, "parent@littlesteps.edu")
    child_id = _create_fresh_child(client, headers, "Nora")
    lessons = client.get("/api/lessons", headers=headers).json()

    colors_lesson = next(l for l in lessons if l["slug"] == "primary-colors-studio")
    other_lesson = next(l for l in lessons if l["slug"] == "alphabet-letter-b")

    quiz_resp = client.get(f"/api/lessons/{colors_lesson['id']}/quiz", headers=headers)
    assert quiz_resp.status_code == 200
    quiz = quiz_resp.json()
    assert quiz is not None
    assert len(quiz["questions"]) == 3

    other_quiz = client.get(f"/api/lessons/{other_lesson['id']}/quiz", headers=headers)
    assert other_quiz.status_code == 200
    assert other_quiz.json() is None

    # Wrong answer count -> 400
    bad_len = client.post(
        "/api/progress/quiz",
        headers=headers,
        json={"child_id": child_id, "quiz_id": quiz["id"], "answers": [1, 0]},
    )
    assert bad_len.status_code == 400

    # Correct indexes [1, 0, 1] -> 100%, 3 stars, quiz_whiz badge
    submit = client.post(
        "/api/progress/quiz",
        headers=headers,
        json={"child_id": child_id, "quiz_id": quiz["id"], "answers": [1, 0, 1]},
    )
    assert submit.status_code == 200, submit.text
    res = submit.json()
    assert res["score_pct"] == 100
    assert res["stars_awarded"] == 3
    assert "quiz_whiz" in [r["badge_key"] for r in res["new_rewards"]]
