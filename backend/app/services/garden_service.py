from copy import deepcopy
from typing import Any, Optional

from app.models.learner import Child

GARDEN_CROP_KEYS = (
    "kalabasa",
    "kamatis",
    "sitaw",
    "talong",
    "saging",
    "sampaguita",
)

THEME_STICKERS = (
    "colors-around-us",
    "my-alphabet-adventure",
    "counting-everyday-objects",
    "shapes-at-home",
    "animals-and-their-homes",
    "healthy-food",
    "my-five-senses",
    "understanding-emotions",
    "plants-and-gardening",
    "community-helpers",
    "weather-and-nature",
    "friendship-and-kindness",
)


def normalize_garden_state(raw: Optional[dict[str, Any]]) -> dict[str, Any]:
    """Ensure garden_state_json always has a predictable, safe schema."""
    data = deepcopy(raw) if isinstance(raw, dict) else {}
    raw_plants = data.get("plants") if isinstance(data.get("plants"), dict) else {}
    plants: dict[str, int] = {
        key: max(0, min(3, int(raw_plants.get(key, 0) or 0)))
        for key in GARDEN_CROP_KEYS
    }
    if plants["kalabasa"] == 0 and sum(plants.values()) == 0:
        plants["kalabasa"] = 1

    raw_stickers = data.get("stickers") if isinstance(data.get("stickers"), list) else []
    stickers = [str(s) for s in raw_stickers if str(s) in THEME_STICKERS]

    sunbeams = max(0, int(data.get("sunbeams", 1) or 0))
    raindrops = max(0, int(data.get("raindrops", 1) or 0))

    return {
        "sunbeams": sunbeams,
        "raindrops": raindrops,
        "plants": plants,
        "stickers": stickers,
    }


def credit_garden(
    child: Child,
    *,
    sunbeams: int = 0,
    raindrops: int = 0,
    sticker_slug: Optional[str] = None,
) -> dict[str, Any]:
    """Credit sunbeams (digital play), raindrops (offline play), and optional sticker."""
    state = normalize_garden_state(getattr(child, "garden_state_json", None))
    if sunbeams > 0:
        state["sunbeams"] += sunbeams
    if raindrops > 0:
        state["raindrops"] += raindrops
    if sticker_slug and sticker_slug in THEME_STICKERS and sticker_slug not in state["stickers"]:
        state["stickers"].append(sticker_slug)
    child.garden_state_json = state
    return state


def grow_garden_crop(
    child: Child,
    crop_key: str,
    use_resource: str = "sunbeam",
) -> dict[str, Any]:
    """Spend 1 sunbeam or raindrop to sprout/water a Bahay Kubo crop up to stage 3."""
    if crop_key not in GARDEN_CROP_KEYS:
        raise ValueError(f"Unknown garden crop '{crop_key}'.")

    state = normalize_garden_state(getattr(child, "garden_state_json", None))
    current_stage = state["plants"].get(crop_key, 0)
    if current_stage >= 3:
        raise ValueError("This plant is already in full bloom!")

    if use_resource == "raindrop":
        if state["raindrops"] <= 0:
            raise ValueError("Ask a grown-up to log a Home Activity to collect a Raindrop!")
        state["raindrops"] -= 1
    else:
        if state["sunbeams"] <= 0:
            raise ValueError("Complete a lesson or game to collect a Sunbeam!")
        state["sunbeams"] -= 1

    state["plants"][crop_key] = current_stage + 1
    child.garden_state_json = state
    return state
