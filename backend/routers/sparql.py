"""SPARQL query center router."""
import json
import uuid
import logging
from datetime import datetime
from pathlib import Path

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from models.query import SparqlQueryRequest, ReformulateRequest, QueryHistoryEntry
from services.ontop_endpoint import get_endpoint_status, ONTOP_ENDPOINT_URL
from config import DATA_DIR

router = APIRouter(prefix="/sparql", tags=["sparql"])

logger = logging.getLogger(__name__)

HISTORY_FILE = DATA_DIR / "query_history.json"

FORMAT_MAP = {
    "json": "application/sparql-results+json",
    "xml": "application/sparql-results+xml",
    "csv": "text/csv",
    "turtle": "text/turtle",
}


@router.post("/query")
async def execute_query(req: SparqlQueryRequest):
    """Proxy SPARQL query to Ontop endpoint."""
    accept = FORMAT_MAP.get(req.format, "application/sparql-results+json")

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.post(
                f"{ONTOP_ENDPOINT_URL}/sparql",
                data=req.query,
                headers={
                    "Content-Type": "application/sparql-query",
                    "Accept": accept,
                },
            )
        except httpx.ConnectError:
            raise HTTPException(503, "Ontop endpoint is not running")

    if resp.status_code != 200:
        raise HTTPException(resp.status_code, resp.text[:500])

    # Save to history
    _save_to_history(req.query, resp.text)

    return Response(
        content=resp.content,
        media_type=resp.headers.get("content-type", accept),
    )


@router.post("/reformulate")
async def reformulate_query(req: ReformulateRequest):
    """Get the SQL reformulation of a SPARQL query."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.get(
                f"{ONTOP_ENDPOINT_URL}/ontop/reformulate",
                params={"query": req.query},
            )
        except httpx.ConnectError:
            raise HTTPException(503, "Ontop endpoint is not running")

    if resp.status_code != 200:
        return {"sql": f"Error: {resp.text[:200]}"}

    return {"sql": resp.text}


@router.get("/history")
async def get_history():
    """Get query history."""
    return _load_history()


@router.delete("/history/{entry_id}", status_code=204)
async def delete_history(entry_id: str):
    """Delete a history entry."""
    history = _load_history()
    history = [h for h in history if h["id"] != entry_id]
    _save_history_list(history)


@router.get("/endpoint-status")
async def endpoint_status():
    """Check Ontop endpoint status."""
    return await get_endpoint_status()


def _load_history() -> list:
    if not HISTORY_FILE.exists():
        return []
    with open(HISTORY_FILE) as f:
        return json.load(f)


def _save_history_list(history: list):
    with open(HISTORY_FILE, "w") as f:
        json.dump(history, f, indent=2, ensure_ascii=False)


def _save_to_history(query: str, result: str):
    history = _load_history()
    entry = {
        "id": str(uuid.uuid4())[:8],
        "query": query,
        "timestamp": datetime.now().isoformat(),
    }
    # Try to count results
    try:
        data = json.loads(result)
        bindings = data.get("results", {}).get("bindings", [])
        entry["result_count"] = len(bindings)
    except Exception:
        pass

    history.insert(0, entry)
    # Keep last 100 entries
    history = history[:100]
    _save_history_list(history)
