"""Character config loader.

Characters are stored in ``backend/characters.json`` so they can be edited
without touching Python code. Restart the backend after changing the JSON.
"""

import json
from pathlib import Path
from typing import Any


CHARACTER_CONFIG_PATH = Path(__file__).resolve().parents[2] / "characters.json"


def load_characters() -> dict[str, dict[str, Any]]:
    try:
        with CHARACTER_CONFIG_PATH.open("r", encoding="utf-8") as fp:
            data = json.load(fp)
    except FileNotFoundError as exc:
        raise RuntimeError(f"Character config not found: {CHARACTER_CONFIG_PATH}") from exc
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Character config is not valid JSON: {CHARACTER_CONFIG_PATH}") from exc

    if not isinstance(data, dict) or not data:
        raise RuntimeError("Character config must be a non-empty object")

    for key, character in data.items():
        if not isinstance(character, dict):
            raise RuntimeError(f"Character '{key}' must be an object")
        if character.get("id") != key:
            raise RuntimeError(f"Character '{key}' must contain matching id")

    return data


CHARACTERS = load_characters()


def get_character(companion_id: str) -> dict[str, Any] | None:
    return CHARACTERS.get(companion_id)


def get_all_characters() -> list[dict[str, Any]]:
    return [
        {
            "id": character["id"],
            "name": character["name"],
            "title": character["title"],
            "description": character["tone"],
            "themeClass": f"theme-{character['id']}",
        }
        for character in CHARACTERS.values()
    ]
