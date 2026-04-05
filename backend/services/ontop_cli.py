"""Compatibility wrapper around the HTTP-based Ontop client."""

from services.ontop_client import bootstrap, extract_db_metadata, materialize, validate

__all__ = ["bootstrap", "extract_db_metadata", "materialize", "validate"]
