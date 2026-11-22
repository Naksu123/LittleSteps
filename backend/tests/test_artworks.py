import base64
from pathlib import Path

from fastapi.testclient import TestClient

from app.core.config import settings
from tests.conftest import login_headers

TINY_PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
)
TINY_PNG_DATA_URL = f"data:image/png;base64,{TINY_PNG_B64}"


def test_artwork_lifecycle_and_security(
    client: TestClient, tmp_path: Path, monkeypatch
) -> None:
    monkeypatch.setattr(settings, "LOCAL_UPLOAD_DIR", str(tmp_path))

    p1_headers = login_headers(client, "parent@littlesteps.edu")
    p2_headers = login_headers(client, "parent2@littlesteps.edu")
    teacher_headers = login_headers(client, "teacher@littlesteps.edu")

    mia_id = client.get("/api/children", headers=p1_headers).json()[0]["id"]

    # Create artwork -> 201 and young_artist badge awarded
    created = client.post(
        f"/api/children/{mia_id}/artworks",
        headers=p1_headers,
        json={
            "title": "My Sunny Rainbow",
            "image_data": TINY_PNG_DATA_URL,
            "palette_used": ["#FF9C8C", "#FFE58A"],
        },
    )
    assert created.status_code == 201, created.text
    art = created.json()
    assert art["title"] == "My Sunny Rainbow"
    assert art["image_url"].endswith(f"/artworks/{art['id']}/image")

    # Ensure child_id is not exposed in stored filenames on disk
    stored_files = list(tmp_path.rglob("*.png"))
    assert len(stored_files) == 1
    assert mia_id not in str(stored_files[0])

    # young_artist reward granted
    prog = client.get(f"/api/children/{mia_id}/progress", headers=p1_headers).json()
    assert "young_artist" in [r["badge_key"] for r in prog["rewards"]]

    # List artworks contains the new item
    listed = client.get(f"/api/children/{mia_id}/artworks", headers=p1_headers)
    assert listed.status_code == 200
    assert any(item["id"] == art["id"] for item in listed.json())

    # Stream PNG image bytes
    img = client.get(art["image_url"], headers=p1_headers)
    assert img.status_code == 200
    assert img.headers["content-type"] == "image/png"
    assert img.content.startswith(b"\x89PNG\r\n\x1a\n")

    # Parent 2 cannot view or create for Mia
    assert client.get(f"/api/children/{mia_id}/artworks", headers=p2_headers).status_code == 403
    assert client.get(art["image_url"], headers=p2_headers).status_code == 403

    # Non-PNG bytes -> 400
    bad_png = "data:image/png;base64," + base64.b64encode(b"hello").decode("ascii")
    invalid = client.post(
        f"/api/children/{mia_id}/artworks",
        headers=p1_headers,
        json={"title": "Bad", "image_data": bad_png, "palette_used": []},
    )
    assert invalid.status_code == 400

    # Oversize -> 413
    monkeypatch.setattr(settings, "MAX_ARTWORK_BYTES", 10)
    oversize = client.post(
        f"/api/children/{mia_id}/artworks",
        headers=p1_headers,
        json={"title": "Too Big", "image_data": TINY_PNG_DATA_URL, "palette_used": []},
    )
    assert oversize.status_code == 413
    monkeypatch.setattr(settings, "MAX_ARTWORK_BYTES", 3 * 1024 * 1024)

    # Teacher cannot delete parent's child artwork
    assert (
        client.delete(
            f"/api/children/{mia_id}/artworks/{art['id']}", headers=teacher_headers
        ).status_code
        == 403
    )

    # Owning parent deletes artwork -> 204
    deleted = client.delete(
        f"/api/children/{mia_id}/artworks/{art['id']}", headers=p1_headers
    )
    assert deleted.status_code == 204

    after_delete = client.get(f"/api/children/{mia_id}/artworks", headers=p1_headers)
    assert after_delete.status_code == 200
    assert after_delete.json() == []
