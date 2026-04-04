"""Ontop UI - FastAPI Backend."""
import sys
import logging
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

# Add backend dir to Python path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import FASTAPI_PORT
from database import init_db, migrate_json_to_sqlite

LOG_DIR = Path(__file__).resolve().parent.parent / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)

log_format = "%(asctime)s |%(levelname)-6s| %(name)s - %(message)s"
logging.basicConfig(
    level=logging.INFO,
    format=log_format,
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(LOG_DIR / "backend.log", encoding="utf-8"),
    ],
    force=True,
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database and migrate JSON data on startup."""
    logger.info("Initializing database...")
    init_db()
    migrate_json_to_sqlite()
    logger.info("Database ready.")
    yield


app = FastAPI(title="Ontop UI", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from routers import datasources, mappings, sparql, ai_query, ontology

app.include_router(datasources.router, prefix="/api/v1")
app.include_router(mappings.router, prefix="/api/v1")
app.include_router(sparql.router, prefix="/api/v1")
app.include_router(ai_query.router, prefix="/api/v1")
app.include_router(ontology.router, prefix="/api/v1")


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next) -> Response:
    started = time.perf_counter()
    client_host = request.client.host if request.client else "-"
    logger.info("REQ  %s %s from=%s", request.method, request.url.path, client_host)

    try:
        response = await call_next(request)
    except Exception:
        elapsed_ms = (time.perf_counter() - started) * 1000
        logger.exception(
            "ERR  %s %s from=%s duration=%.2fms",
            request.method,
            request.url.path,
            client_host,
            elapsed_ms,
        )
        raise

    elapsed_ms = (time.perf_counter() - started) * 1000
    logger.info(
        "RESP %s %s status=%s duration=%.2fms",
        request.method,
        request.url.path,
        response.status_code,
        elapsed_ms,
    )
    return response


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
