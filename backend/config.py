import os
from pathlib import Path

# Project paths
PROJECT_ROOT = Path(__file__).resolve().parent
DATA_DIR = PROJECT_ROOT / "data"
DATA_DIR.mkdir(exist_ok=True)

AI_CONFIG_FILE = DATA_DIR / "ai_config.json"  # kept for migration
DB_PATH = DATA_DIR / "ontop_ui.db"
ENCRYPTION_KEY_PATH = DATA_DIR / ".encryption_key"

# Ontop paths — support env override for Docker
ONTOP_BASE = Path(os.environ.get("ONTOP_BASE", str(PROJECT_ROOT.parent.parent / "ontop-test")))
ONTOP_CLI = Path(os.environ.get("ONTOP_CLI", str(ONTOP_BASE / "ontop-cli" / "ontop")))
ONTOP_OUTPUT = Path(os.environ.get("ONTOP_OUTPUT", str(ONTOP_BASE / "output")))

# Default Ontop endpoint config
ONTOLOGY_FILE = Path(os.environ.get("ONTOLOGY_FILE", str(ONTOP_OUTPUT / "retail_ontology.ttl")))
MAPPING_FILE = Path(os.environ.get("MAPPING_FILE", str(ONTOP_OUTPUT / "retail_mapping.obda")))
PROPERTIES_FILE = Path(os.environ.get("PROPERTIES_FILE", str(ONTOP_OUTPUT / "retail.properties")))

# Ontop endpoint
ONTOP_ENDPOINT_URL = os.environ.get("ONTOP_ENDPOINT_URL", "http://localhost:8080")
ONTOP_ENDPOINT_PORT = int(os.environ.get("ONTOP_ENDPOINT_PORT", "8080"))

# FastAPI
FASTAPI_PORT = int(os.environ.get("FASTAPI_PORT", "8000"))

# LLM
LLM_BASE_URL = os.environ.get("LLM_BASE_URL", "http://localhost:1234/v1")
LLM_API_KEY = os.environ.get("LLM_API_KEY", "lm-studio")
LLM_MODEL = os.environ.get("LLM_MODEL", "zai-org/glm-4.7-flash")
