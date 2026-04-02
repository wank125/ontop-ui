"""Ontop CLI subprocess wrapper."""
import asyncio
import logging
from pathlib import Path
from typing import Optional

from config import ONTOP_CLI, ONTOP_OUTPUT

logger = logging.getLogger(__name__)


async def run_ontop_command(*args: str, timeout: int = 60) -> tuple[bool, str]:
    """Run an Ontop CLI command and return (success, output)."""
    cmd = [str(ONTOP_CLI)] + list(args)
    logger.info(f"Running: {' '.join(cmd)}")

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        output = stdout.decode("utf-8", errors="replace")

        if proc.returncode != 0:
            logger.error(f"Ontop CLI failed (rc={proc.returncode}): {output}")
            return False, output

        return True, output

    except asyncio.TimeoutError:
        proc.kill()
        return False, "Command timed out"
    except Exception as e:
        return False, str(e)


async def extract_db_metadata(properties_path: str) -> tuple[bool, str]:
    """Run `ontop extract-db-metadata`."""
    return await run_ontop_command(
        "extract-db-metadata",
        "-p", properties_path,
    )


async def bootstrap(
    base_iri: str,
    ontology_path: str,
    mapping_path: str,
    properties_path: str,
) -> tuple[bool, str]:
    """Run `ontop bootstrap` to auto-generate ontology + mapping."""
    return await run_ontop_command(
        "bootstrap",
        "-b", base_iri,
        "-t", ontology_path,
        "-m", mapping_path,
        "-p", properties_path,
        timeout=120,
    )


async def validate(
    mapping_path: str,
    ontology_path: Optional[str] = None,
    properties_path: Optional[str] = None,
) -> tuple[bool, str]:
    """Run `ontop validate`."""
    args = ["validate", "-m", mapping_path]
    if ontology_path:
        args.extend(["-t", ontology_path])
    if properties_path:
        args.extend(["-p", properties_path])
    return await run_ontop_command(*args, timeout=60)


async def materialize(
    mapping_path: str,
    output_path: str,
    ontology_path: Optional[str] = None,
    properties_path: Optional[str] = None,
    fmt: str = "turtle",
) -> tuple[bool, str]:
    """Run `ontop materialize`."""
    args = ["materialize", "-m", mapping_path, "-o", output_path, "-f", fmt]
    if ontology_path:
        args.extend(["-t", ontology_path])
    if properties_path:
        args.extend(["-p", properties_path])
    return await run_ontop_command(*args, timeout=120)
