"""SPARQL query center router."""
import json
import logging

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from models.query import SparqlQueryRequest, ReformulateRequest, QueryHistoryEntry
from services.ontop_endpoint import get_endpoint_status, ONTOP_ENDPOINT_URL
from repositories.query_history_repo import (
    list_history as repo_list_history,
    save_to_history as repo_save_history,
    delete_history_entry as repo_delete_history,
)

router = APIRouter(prefix="/sparql", tags=["sparql"])

logger = logging.getLogger(__name__)

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
    result_count = None
    try:
        data = json.loads(resp.text)
        bindings = data.get("results", {}).get("bindings", [])
        result_count = len(bindings)
    except Exception:
        pass
    repo_save_history(req.query, result_count)

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
    return repo_list_history()


@router.delete("/history/{entry_id}", status_code=204)
async def delete_history(entry_id: str):
    """Delete a history entry."""
    repo_delete_history(entry_id)


@router.get("/endpoint-status")
async def endpoint_status():
    """Check Ontop endpoint status."""
    return await get_endpoint_status()
