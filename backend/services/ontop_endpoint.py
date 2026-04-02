"""Manage the Ontop SPARQL endpoint process."""
import asyncio
import logging
import signal
from typing import Optional

import httpx

from config import (
    ONTOP_CLI,
    ONTOLOGY_FILE,
    MAPPING_FILE,
    PROPERTIES_FILE,
    ONTOP_ENDPOINT_URL,
    ONTOP_ENDPOINT_PORT,
)

logger = logging.getLogger(__name__)

# Global reference to the endpoint process
_endpoint_process: Optional[asyncio.subprocess.Process] = None


async def start_endpoint(
    ontology_path: str = None,
    mapping_path: str = None,
    properties_path: str = None,
    port: int = ONTOP_ENDPOINT_PORT,
    dev: bool = True,
    enable_download_ontology: bool = True,
) -> tuple[bool, str]:
    """Start the Ontop SPARQL endpoint as a subprocess."""
    global _endpoint_process

    # Stop existing endpoint first
    if _endpoint_process and _endpoint_process.returncode is None:
        await stop_endpoint()

    ontology_path = ontology_path or str(ONTOLOGY_FILE)
    mapping_path = mapping_path or str(MAPPING_FILE)
    properties_path = properties_path or str(PROPERTIES_FILE)

    cmd = [
        str(ONTOP_CLI), "endpoint",
        "-t", ontology_path,
        "-m", mapping_path,
        "-p", properties_path,
        "--port", str(port),
        "--cors-allowed-origins", "*",
    ]
    if dev:
        cmd.append("--dev")
    if enable_download_ontology:
        cmd.append("--enable-download-ontology")

    logger.info(f"Starting Ontop endpoint: {' '.join(cmd)}")

    try:
        _endpoint_process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )

        # Wait for startup message (up to 30s)
        startup_output = ""
        for _ in range(60):
            line = await _endpoint_process.stdout.readline()
            if not line:
                break
            decoded = line.decode("utf-8", errors="replace")
            startup_output += decoded
            if "Ontop virtual repository initialized" in decoded:
                logger.info("Ontop endpoint started successfully")
                return True, startup_output
            if "Exception" in decoded or "Error" in decoded:
                await stop_endpoint()
                return False, startup_output
            await asyncio.sleep(0.5)

        await stop_endpoint()
        return False, f"Timeout waiting for endpoint startup\n{startup_output}"

    except Exception as e:
        return False, str(e)


async def stop_endpoint():
    """Stop the Ontop endpoint process."""
    global _endpoint_process
    if _endpoint_process and _endpoint_process.returncode is None:
        logger.info("Stopping Ontop endpoint...")
        _endpoint_process.terminate()
        try:
            await asyncio.wait_for(_endpoint_process.wait(), timeout=10)
        except asyncio.TimeoutError:
            _endpoint_process.kill()
        _endpoint_process = None
        logger.info("Ontop endpoint stopped")


async def get_endpoint_status() -> dict:
    """Check if the Ontop endpoint is alive."""
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{ONTOP_ENDPOINT_URL}/sparql", params={"query": "ASK { ?s ?p ?o }"})
            return {"running": resp.status_code == 200, "port": ONTOP_ENDPOINT_PORT}
    except Exception:
        return {"running": False, "port": ONTOP_ENDPOINT_PORT}


def get_endpoint_process() -> Optional[asyncio.subprocess.Process]:
    return _endpoint_process
