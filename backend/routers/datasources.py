"""Data source management router."""
import json
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException

from models.datasource import DataSource, DataSourceCreate, DataSourceUpdate, BootstrapRequest
from services.ontop_cli import extract_db_metadata, bootstrap as ontop_bootstrap
from services.bootstrap_service import (
    build_preview,
    generate_partial_bootstrap,
    get_version_dir,
    load_schema_metadata,
    resolve_requested_tables,
    write_manifest,
)
from config import DATA_DIR
from repositories.datasource_repo import (
    list_datasources as repo_list,
    get_datasource as repo_get,
    create_datasource as repo_create,
    update_datasource as repo_update,
    delete_datasource as repo_delete,
)

router = APIRouter(prefix="/datasources", tags=["datasources"])


@router.get("")
async def list_datasources():
    return repo_list()


@router.post("", status_code=201)
async def create_datasource(data: DataSourceCreate):
    return repo_create(
        name=data.name,
        jdbc_url=data.jdbc_url,
        user=data.user,
        password=data.password,
        driver=data.driver,
    )


@router.get("/{ds_id}")
async def get_datasource(ds_id: str):
    ds = repo_get(ds_id)
    if not ds:
        raise HTTPException(404, "Data source not found")
    return ds


@router.put("/{ds_id}")
async def update_datasource(ds_id: str, data: DataSourceUpdate):
    ds = repo_update(ds_id, data.model_dump(exclude_none=True))
    if not ds:
        raise HTTPException(404, "Data source not found")
    return ds


@router.delete("/{ds_id}", status_code=204)
async def delete_datasource(ds_id: str):
    repo_delete(ds_id)


@router.post("/{ds_id}/test")
async def test_connection(ds_id: str):
    ds = _get_ds(ds_id)
    props_path = _write_temp_properties(ds)
    try:
        success, output = await extract_db_metadata(props_path)
        return {"connected": success, "message": output[:500] if not success else "Connection successful"}
    finally:
        Path(props_path).unlink(missing_ok=True)


@router.get("/{ds_id}/schema")
async def get_schema(ds_id: str):
    ds = _get_ds(ds_id)
    props_path = _write_temp_properties(ds)
    try:
        success, output = await extract_db_metadata(props_path)
        if not success:
            raise HTTPException(400, f"Failed to extract metadata: {output[:500]}")
        import json as json_mod
        try:
            return json_mod.loads(output)
        except json_mod.JSONDecodeError:
            return {"raw": output}
    finally:
        Path(props_path).unlink(missing_ok=True)


@router.post("/{ds_id}/bootstrap")
async def run_bootstrap(ds_id: str, req: BootstrapRequest):
    ds = _get_ds(ds_id)
    base_name = ds["name"].replace(" ", "_")
    root_output_dir = Path(req.output_dir) if req.output_dir else Path(DATA_DIR) / ds["id"]
    root_output_dir.mkdir(parents=True, exist_ok=True)

    effective_mode = "partial" if req.mode == "partial" or req.tables else "full"
    requested_tables = [table for table in req.tables if table.strip()]
    resolved_tables: list[str] = []
    added_dependencies: list[str] = []

    if effective_mode == "partial":
        if not requested_tables:
            raise HTTPException(400, "Partial bootstrap requires at least one selected table.")
        schema = await _get_schema_metadata(ds)
        requested_tables, resolved_tables, added_dependencies = resolve_requested_tables(
            schema,
            requested_tables,
            req.include_dependencies,
        )

    version, version_dir = get_version_dir(root_output_dir, effective_mode)
    props_path = version_dir / f"{base_name}.properties"
    _write_properties(ds, str(props_path))

    if effective_mode == "partial":
        onto_path, mapping_path, output = await generate_partial_bootstrap(
            base_iri=req.base_iri,
            version_dir=version_dir,
            base_name=base_name,
            properties_path=str(props_path),
            requested_tables=requested_tables,
            resolved_tables=resolved_tables,
        )
    else:
        onto_path = str(version_dir / f"{base_name}_ontology.ttl")
        mapping_path = str(version_dir / f"{base_name}_mapping.obda")
        success, output = await ontop_bootstrap(
            base_iri=req.base_iri,
            ontology_path=onto_path,
            mapping_path=mapping_path,
            properties_path=str(props_path),
        )
        if not success:
            raise HTTPException(400, f"Bootstrap failed: {output[:500]}")

    manifest = {
        "version": version,
        "mode": effective_mode,
        "requested_tables": requested_tables,
        "resolved_tables": resolved_tables,
        "added_dependencies": added_dependencies,
        "include_dependencies": req.include_dependencies,
        "base_iri": req.base_iri,
        "created_at": datetime.now().isoformat(),
        "ontology_path": onto_path,
        "mapping_path": mapping_path,
        "properties_path": str(props_path),
    }
    manifest_path, selected_tables_path = write_manifest(version_dir, manifest)

    return {
        "version": version,
        "mode": effective_mode,
        "requested_tables": requested_tables,
        "resolved_tables": resolved_tables,
        "added_dependencies": added_dependencies,
        "ontology_path": onto_path,
        "mapping_path": mapping_path,
        "properties_path": str(props_path),
        "manifest_path": str(manifest_path),
        "selected_tables_path": str(selected_tables_path),
        "output": output[:1000],
    }


@router.post("/{ds_id}/bootstrap-preview")
async def preview_bootstrap(ds_id: str, req: BootstrapRequest):
    ds = _get_ds(ds_id)
    if req.mode != "partial" and not req.tables:
        schema = await _get_schema_metadata(ds)
        all_tables = [
            ".".join(part.replace('"', '') for part in relation.get("name", [])).split(".")[-1]
            for relation in schema.get("relations", [])
        ]
        return build_preview(schema, all_tables, all_tables, [])

    if not req.tables:
        raise HTTPException(400, "Bootstrap preview requires at least one selected table.")

    schema = await _get_schema_metadata(ds)
    requested_tables, resolved_tables, added_dependencies = resolve_requested_tables(
        schema,
        req.tables,
        req.include_dependencies,
    )
    return build_preview(schema, requested_tables, resolved_tables, added_dependencies)


def _get_ds(ds_id: str) -> dict:
    ds = repo_get(ds_id)
    if not ds:
        raise HTTPException(404, "Data source not found")
    return ds


def _write_properties(ds: dict, path: str):
    with open(path, "w") as f:
        f.write(f"jdbc.url={ds['jdbc_url']}\n")
        f.write(f"jdbc.user={ds['user']}\n")
        f.write(f"jdbc.password={ds['password']}\n")
        f.write(f"jdbc.driver={ds['driver']}\n")


def _write_temp_properties(ds: dict) -> str:
    tmp = tempfile.NamedTemporaryFile(suffix=".properties", delete=False, mode="w")
    _write_properties(ds, tmp.name)
    tmp.close()
    return tmp.name


async def _get_schema_metadata(ds: dict) -> dict:
    props_path = _write_temp_properties(ds)
    try:
        success, output = await extract_db_metadata(props_path)
        if not success:
            raise HTTPException(400, f"Failed to extract metadata: {output[:500]}")
        return load_schema_metadata(output)
    finally:
        Path(props_path).unlink(missing_ok=True)
