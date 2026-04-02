from pathlib import Path

# Project paths
PROJECT_ROOT = Path(__file__).resolve().parent
DATA_DIR = PROJECT_ROOT / "data"
DATA_DIR.mkdir(exist_ok=True)

# Ontop paths
ONTOP_BASE = PROJECT_ROOT.parent.parent / "ontop-test"
ONTOP_CLI = ONTOP_BASE / "ontop-cli" / "ontop"
ONTOP_OUTPUT = ONTOP_BASE / "output"

# Default Ontop endpoint config
ONTOLOGY_FILE = ONTOP_OUTPUT / "retail_ontology.ttl"
MAPPING_FILE = ONTOP_OUTPUT / "retail_mapping.obda"
PROPERTIES_FILE = ONTOP_OUTPUT / "retail.properties"

# Ontop endpoint
ONTOP_ENDPOINT_URL = "http://localhost:8080"
ONTOP_ENDPOINT_PORT = 8080

# FastAPI
FASTAPI_PORT = 8000

# LLM
LLM_BASE_URL = "http://localhost:1234/v1"
LLM_API_KEY = "lm-studio"
LLM_MODEL = "zai-org/glm-4.7-flash"
