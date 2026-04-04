"""Ontology (TTL) viewer router."""
from pathlib import Path

from fastapi import APIRouter, HTTPException

from services.ttl_parser import parse_ttl
from config import ONTOP_OUTPUT

router = APIRouter(prefix="/ontology", tags=["ontology"])


@router.get("")
async def list_ttl_files():
    """List available .ttl files in the output directory."""
    files = []
    for d in [ONTOP_OUTPUT]:
        if not d.exists():
            continue
        for f in d.glob("**/*.ttl"):
            stat = f.stat()
            files.append({
                "path": str(f),
                "filename": f.name,
                "modified_at": stat.st_mtime,
            })
    return files


@router.get("/content")
async def get_ontology_content(path: str):
    """Read and parse a .ttl file."""
    file_path = Path(path)
    if not file_path.exists():
        raise HTTPException(404, f"File not found: {path}")

    content = file_path.read_text(encoding="utf-8")
    parsed = parse_ttl(content)
    return parsed.model_dump()
