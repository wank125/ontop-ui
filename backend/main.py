"""Ontop UI - FastAPI Backend."""
import sys
import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Add backend dir to Python path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import FASTAPI_PORT
from routers import datasources, mappings, sparql, ai_query

logging.basicConfig(level=logging.INFO, format="%(asctime)s |%(levelname)-6s| %(name)s - %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="Ontop UI", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(datasources.router, prefix="/api/v1")
app.include_router(mappings.router, prefix="/api/v1")
app.include_router(sparql.router, prefix="/api/v1")
app.include_router(ai_query.router, prefix="/api/v1")


@app.get("/api/v1/health")
async def health():
    return {"status": "ok"}


@app.get("/api/v1/config")
async def get_config():
    from config import ONTOP_CLI, ONTOP_ENDPOINT_URL, LLM_BASE_URL, LLM_MODEL
    return {
        "ontop_cli": str(ONTOP_CLI),
        "ontop_endpoint_url": ONTOP_ENDPOINT_URL,
        "llm_base_url": LLM_BASE_URL,
        "llm_model": LLM_MODEL,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=FASTAPI_PORT, reload=True)
