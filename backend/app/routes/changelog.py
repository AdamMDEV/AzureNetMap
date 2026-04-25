from pathlib import Path

from fastapi import APIRouter

router = APIRouter()

_CHANGELOG_PATHS = [
    Path("/app/CHANGELOG.md"),
    Path(__file__).parent.parent.parent.parent / "CHANGELOG.md",
]


@router.get("/changelog")
async def get_changelog() -> dict[str, str]:
    for path in _CHANGELOG_PATHS:
        if path.exists():
            return {"content": path.read_text(encoding="utf-8")}
    return {"content": "# Changelog\n\nNot available."}
