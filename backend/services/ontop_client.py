"""HTTP client for the native Java Ontop builder service."""
from pathlib import Path

import httpx

from config import ONTOP_ENGINE_URL


def _read_properties(properties_path: str) -> dict[str, str]:
    props: dict[str, str] = {}
    for line in Path(properties_path).read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        props[key.strip()] = value.strip()
    return props


def _jdbc_payload(properties_path: str) -> dict[str, str]:
    props = _read_properties(properties_path)
    return {
        "jdbcUrl": props.get("jdbc.url", ""),
        "user": props.get("jdbc.user", ""),
        "password": props.get("jdbc.password", ""),
        "driver": props.get("jdbc.driver", ""),
    }


async def extract_db_metadata(properties_path: str) -> tuple[bool, str]:
    payload = {"jdbc": _jdbc_payload(properties_path)}
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            resp = await client.post(f"{ONTOP_ENGINE_URL}/api/ontop/extract-metadata", json=payload)
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            err_body = exc.response.json() if exc.response.text else {}
            return False, err_body.get("message", str(exc))
        except Exception as exc:
            return False, str(exc)

    body = resp.json()
    return body.get("success", False), body.get("metadataJson") or body.get("message", "")


async def bootstrap(
    base_iri: str,
    ontology_path: str,
    mapping_path: str,
    properties_path: str,
) -> tuple[bool, str]:
    payload = {
        "baseIri": base_iri,
        "jdbc": _jdbc_payload(properties_path),
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            resp = await client.post(f"{ONTOP_ENGINE_URL}/api/ontop/bootstrap", json=payload)
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            err_body = exc.response.json() if exc.response.text else {}
            return False, err_body.get("message", str(exc))
        except Exception as exc:
            return False, str(exc)

    body = resp.json()
    if not body.get("success", False):
        return False, body.get("message", "Bootstrap failed")

    Path(ontology_path).write_text(body.get("ontology", ""), encoding="utf-8")
    Path(mapping_path).write_text(body.get("mapping", ""), encoding="utf-8")
    return True, body.get("message", "Bootstrap completed")


async def validate(
    mapping_path: str,
    ontology_path: str | None = None,
    properties_path: str | None = None,
) -> tuple[bool, str]:
    if not ontology_path:
        return False, "Validation requires an ontology file"
    if not properties_path:
        return False, "Validation requires a properties file"

    payload = {
        "mappingContent": Path(mapping_path).read_text(encoding="utf-8"),
        "ontologyContent": Path(ontology_path).read_text(encoding="utf-8"),
        "jdbc": _jdbc_payload(properties_path),
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            resp = await client.post(f"{ONTOP_ENGINE_URL}/api/ontop/validate", json=payload)
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            err_body = exc.response.json() if exc.response.text else {}
            return False, err_body.get("message", str(exc))
        except Exception as exc:
            return False, str(exc)

    body = resp.json()
    return body.get("success", False), body.get("message", "")


async def materialize(
    mapping_path: str,
    output_path: str,
    ontology_path: str | None = None,
    properties_path: str | None = None,
    fmt: str = "turtle",
) -> tuple[bool, str]:
    del mapping_path, output_path, ontology_path, properties_path, fmt
    return False, "Materialize has not been migrated to ontop-engine yet"
