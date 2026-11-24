from fastapi.testclient import TestClient

from tests.conftest import login_headers


def test_all_18_games_have_weekly_pools_and_rotate_each_week(
    client: TestClient,
) -> None:
    headers = login_headers(client, "parent@littlesteps.edu")

    week47 = client.get("/api/games?week=2026-W47", headers=headers)
    assert week47.status_code == 200
    games_w47 = week47.json()
    assert len(games_w47) == 18

    for game in games_w47:
        cfg = game["config_json"]
        assert cfg["weekly_key"] == "2026-W47"
        assert cfg["weekly_label"] == "Week 47 Fresh Mix"
        engine = cfg["engine"]
        if engine == "choice":
            assert len(cfg["rounds"]) == 12, f"{game['slug']} should have 12 rounds"
            for r in cfg["rounds"]:
                keys = [c["key"] for c in r["choices"]]
                assert len(keys) == 4
                assert len(set(keys)) == 4
                assert r["answer"] in keys
        elif engine == "sort":
            assert len(cfg["bins"]) == 3
            assert len(cfg["items"]) == 12
        elif engine == "memory":
            assert len(cfg["pairs"]) == 6
        elif engine == "puzzle":
            assert len(cfg["pictures"]) == 3
        elif engine == "trace":
            assert len(cfg["prompts"]) == 4

    # Same week stays consistent; different week rotates dynamically
    week47_again = client.get("/api/games?week=2026-W47", headers=headers).json()
    assert week47_again[0]["config_json"] == games_w47[0]["config_json"]

    week48 = client.get("/api/games?week=2026-W48", headers=headers).json()
    rotations = sum(
        1
        for g47, g48 in zip(games_w47, week48)
        if g47["config_json"].get("rounds") != g48["config_json"].get("rounds")
        or g47["config_json"].get("items") != g48["config_json"].get("items")
        or g47["config_json"].get("pairs") != g48["config_json"].get("pairs")
        or g47["config_json"].get("pictures") != g48["config_json"].get("pictures")
        or g47["config_json"].get("prompts") != g48["config_json"].get("prompts")
    )
    assert rotations == 18

    # Single-game fetch also supports dynamic weekly rotation
    single_w49 = client.get(
        f"/api/games/{games_w47[0]['id']}?week=2026-W49", headers=headers
    )
    assert single_w49.status_code == 200
    assert single_w49.json()["config_json"]["weekly_key"] == "2026-W49"
