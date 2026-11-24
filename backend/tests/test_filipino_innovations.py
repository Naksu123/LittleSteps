import base64
from fastapi.testclient import TestClient

from app.services.game_generator import WEATHER_SCENARIOS
from tests.conftest import login_headers

MINIMAL_PNG_B64 = (
    "data:image/png;base64,"
    + base64.b64encode(
        b"\x89PNG\r\n\x1a\n"
        b"\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4"
        b"\x00\x00\x00\nIDATx\x9cc`\x00\x00\x00\x02\x00\x01\xe2!\xbc3\x00\x00\x00\x00IEND\xaeB`\x82"
    ).decode("ascii")
)


def test_parent_pin_bilingual_settings_and_me_preferences(client: TestClient) -> None:
    headers = login_headers(client, "parent@littlesteps.edu")

    # Save bilingual setting + 4-digit Parent PIN + disable notifications
    updated = client.patch(
        "/api/parent/settings",
        headers=headers,
        json={
            "preferred_language": "bilingual",
            "daily_screen_limit_mins": 25,
            "notifications_enabled": False,
            "parent_pin": "2468",
        },
    )
    assert updated.status_code == 200, updated.text
    body = updated.json()
    assert body["preferred_language"] == "bilingual"
    assert body["daily_screen_limit_mins"] == 25
    assert body["notifications_enabled"] is False
    assert body["has_parent_pin"] is True

    # Verify PIN endpoint
    ok_pin = client.post("/api/parent/verify-pin", headers=headers, json={"pin": "2468"})
    assert ok_pin.status_code == 200
    assert ok_pin.json()["valid"] is True

    bad_pin = client.post("/api/parent/verify-pin", headers=headers, json={"pin": "9999"})
    assert bad_pin.status_code == 200
    assert bad_pin.json()["valid"] is False

    # /api/auth/me reflects preferences immediately
    me = client.get("/api/auth/me", headers=headers).json()
    assert me["parent_preferences"]["preferred_language"] == "bilingual"
    assert me["parent_preferences"]["daily_screen_limit_mins"] == 25
    assert me["parent_preferences"]["has_parent_pin"] is True

    # Clear PIN cleanly
    cleared = client.patch("/api/parent/settings", headers=headers, json={"clear_parent_pin": True})
    assert cleared.status_code == 200
    assert cleared.json()["has_parent_pin"] is False


def test_bahay_kubo_garden_and_offline_home_raindrops(client: TestClient) -> None:
    headers = login_headers(client, "parent@littlesteps.edu")
    child_resp = client.post(
        "/api/children",
        headers=headers,
        json={"display_name": "Tala", "birth_year": 2021, "avatar_key": "owl"},
    )
    assert child_resp.status_code == 201
    tala = child_resp.json()
    initial_rain = tala["garden_state_json"]["raindrops"]

    # Completing an offline Home Activity credits a raindrop + stars + sticker
    themes = client.get(f"/api/parent/home-learning?child_id={tala['id']}", headers=headers).json()
    ha_id = themes[0]["home_activities"][0]["id"]
    prog = client.post(
        f"/api/parent/home-activities/{ha_id}/progress",
        headers=headers,
        json={"child_id": tala["id"], "completed": True},
    )
    assert prog.status_code == 200

    tala_after = client.get(f"/api/children/{tala['id']}", headers=headers).json()
    assert tala_after["garden_state_json"]["raindrops"] == initial_rain + 1
    assert "colors-around-us" in tala_after["garden_state_json"]["stickers"]

    # Watering a Bahay Kubo crop advances its stage
    grown = client.post(
        f"/api/children/{tala['id']}/garden/grow",
        headers=headers,
        json={"crop_key": "kamatis", "use_resource": "raindrop"},
    )
    assert grown.status_code == 200, grown.text
    assert grown.json()["garden_state_json"]["plants"]["kamatis"] == 1


def test_artwork_approval_and_child_data_export_and_delete(client: TestClient) -> None:
    headers = login_headers(client, "parent@littlesteps.edu")
    p2_headers = login_headers(client, "parent2@littlesteps.edu")

    created = client.post(
        "/api/children",
        headers=headers,
        json={"display_name": "Lito", "birth_year": 2020, "avatar_key": "fox"},
    )
    assert created.status_code == 201
    child_id = created.json()["id"]

    art = client.post(
        f"/api/children/{child_id}/artworks",
        headers=headers,
        json={"title": "Bahay Kubo Sunset", "image_data": MINIMAL_PNG_B64, "palette_used": ["#FF6B6B"]},
    )
    assert art.status_code == 201
    art_id = art.json()["id"]

    # Toggle approval status
    toggled = client.patch(
        f"/api/children/{child_id}/artworks/{art_id}/approval",
        headers=headers,
        json={"approved_by_parent": False},
    )
    assert toggled.status_code == 200
    assert toggled.json()["approved_by_parent"] is False

    # Other parent forbidden from approval toggle, export, or deletion
    assert (
        client.patch(
            f"/api/children/{child_id}/artworks/{art_id}/approval",
            headers=p2_headers,
            json={"approved_by_parent": True},
        ).status_code
        == 403
    )
    assert client.get(f"/api/children/{child_id}/export", headers=p2_headers).status_code == 403
    assert client.delete(f"/api/children/{child_id}", headers=p2_headers).status_code == 403

    # Export data works
    exported = client.get(f"/api/children/{child_id}/export", headers=headers)
    assert exported.status_code == 200
    assert exported.json()["progress"]["child"]["display_name"] == "Lito"

    # Dashboard includes 5-second bilingual digest
    dash = client.get("/api/parent/dashboard", headers=headers).json()
    assert any(item.get("digest") is not None for item in dash["children"])

    # Erase child profile cleanly
    deleted = client.delete(f"/api/children/{child_id}", headers=headers)
    assert deleted.status_code == 204
    assert client.get(f"/api/children/{child_id}", headers=headers).status_code in (403, 404)
    remaining_ids = [c["id"] for c in client.get("/api/children", headers=headers).json()]
    assert child_id not in remaining_ids


def test_weather_scenarios_localized_for_philippines() -> None:
    joined = " ".join(str(item) for item in WEATHER_SCENARIOS).lower()
    assert "snow" not in joined
    assert "autumn leaves" not in joined
    assert "payong" in joined or "tag-ulan" in joined
