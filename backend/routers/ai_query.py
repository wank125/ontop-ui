"""AI natural language query router."""
import json
import logging
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException
from sse_starlette.sse import EventSourceResponse

from models.mapping import MappingContent
from services.llm_service import generate_sparql, generate_answer, build_sparql_prompt
from services.obda_parser import parse_obda
from config import ONTOP_ENDPOINT_URL, MAPPING_FILE, ONTOLOGY_FILE

router = APIRouter(prefix="/ai", tags=["ai"])

logger = logging.getLogger(__name__)


@router.get("/ontology-summary")
async def ontology_summary():
    """Get ontology schema summary for prompt context."""
    # Read mapping file for classes, properties, relationships
    mapping_content = MAPPING_FILE.read_text(encoding="utf-8")
    parsed = parse_obda(mapping_content)

    classes = set()
    data_properties = set()
    object_properties = set()

    for m in parsed.mappings:
        target = m.target
        # Extract class URIs from "a <class_uri>"
        import re
        class_matches = re.findall(r'a\s+<([^>]+)>', target)
        for c in class_matches:
            classes.add(c.split("/")[-1])

        # Extract property URIs
        prop_matches = re.findall(r'<([^>]+#[^>]+)>', target)
        for p in prop_matches:
            prop_name = p.split("#")[-1]
            if prop_name.startswith("ref-"):
                object_properties.add(prop_name)
            else:
                data_properties.add(prop_name)

    return {
        "classes": sorted(classes),
        "data_properties": sorted(data_properties),
        "object_properties": sorted(object_properties),
        "prefixes": parsed.prefixes,
    }


@router.get("/query")
async def ai_query(question: str):
    """Full NL -> SPARQL -> results -> answer pipeline with SSE streaming."""
    import asyncio

    async def event_generator():
        # Step 1: Get ontology summary
        summary = await ontology_summary()
        yield {"event": "step", "data": json.dumps({"step": "analyzing", "message": "Analyzing ontology..."})}

        # Step 2: Build prompt and generate SPARQL
        prompt = build_sparql_prompt(
            classes=summary["classes"],
            properties=summary["data_properties"],
            relationships=summary["object_properties"],
            prefixes=summary["prefixes"],
        )

        sparql = await generate_sparql(prompt, question)
        # Clean up SPARQL (remove markdown fences if present)
        sparql = sparql.strip()
        if sparql.startswith("```"):
            sparql = "\n".join(sparql.split("\n")[1:-1])
        yield {"event": "sparql", "data": json.dumps({"step": "sparql_generated", "sparql": sparql})}

        # Step 3: Execute SPARQL
        yield {"event": "step", "data": json.dumps({"step": "executing", "message": "Executing query..."})}

        sql = ""
        result_text = ""
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Get SQL
            try:
                resp = await client.get(
                    f"{ONTOP_ENDPOINT_URL}/ontop/reformulate",
                    params={"query": sparql},
                )
                if resp.status_code == 200:
                    sql = resp.text
            except Exception:
                pass

            # Execute query
            try:
                resp = await client.post(
                    f"{ONTOP_ENDPOINT_URL}/sparql",
                    data=sparql,
                    headers={
                        "Content-Type": "application/sparql-query",
                        "Accept": "application/sparql-results+json",
                    },
                )
                if resp.status_code == 200:
                    result_text = resp.text
                else:
                    result_text = f"Error: {resp.text[:200]}"
            except httpx.ConnectError:
                result_text = "Error: Ontop endpoint not running"

        yield {"event": "executed", "data": json.dumps({"step": "executed", "sql": sql, "results": result_text[:2000]})}

        # Step 4: Generate natural language answer
        answer = await generate_answer(question, result_text[:2000])
        yield {"event": "answer", "data": json.dumps({"step": "answer", "answer": answer})}

    return EventSourceResponse(event_generator())
