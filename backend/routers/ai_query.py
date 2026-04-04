"""AI natural language query router."""
import json
import logging
from typing import Any, Optional

import httpx
from fastapi import APIRouter, HTTPException
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel

from models.mapping import MappingContent
from services.llm_service import generate_sparql, generate_answer, build_sparql_prompt
from services.obda_parser import parse_obda
from config import ONTOP_ENDPOINT_URL, MAPPING_FILE, ONTOLOGY_FILE

router = APIRouter(prefix="/ai", tags=["ai"])

logger = logging.getLogger(__name__)

# ── Provider presets ──────────────────────────────
PROVIDER_PRESETS = {
    "openai": {
        "label": "OpenAI",
        "base_url": "https://api.openai.com/v1",
        "models": ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
    },
    "lm_studio": {
        "label": "LM Studio",
        "base_url": "http://localhost:1234/v1",
        "models": [],
    },
    "ollama": {
        "label": "Ollama",
        "base_url": "http://localhost:11434/v1",
        "models": [],
    },
    "deepseek": {
        "label": "DeepSeek",
        "base_url": "https://api.deepseek.com/v1",
        "models": ["deepseek-chat", "deepseek-reasoner"],
    },
    "zhipu": {
        "label": "智谱 AI",
        "base_url": "https://open.bigmodel.cn/api/paas/v4",
        "models": ["glm-4-flash", "glm-4-plus", "glm-4-long"],
    },
    "azure_openai": {
        "label": "Azure OpenAI",
        "base_url": "https://{resource}.openai.azure.com/openai/deployments/{deployment}",
        "models": [],
    },
    "anthropic": {
        "label": "Anthropic Claude",
        "base_url": "https://api.anthropic.com",
        "models": ["claude-sonnet-4-20250514", "claude-haiku-4-20250514", "claude-3.5-sonnet-20241022"],
    },
    "custom": {
        "label": "自定义 (OpenAI 兼容)",
        "base_url": "",
        "models": [],
    },
}

# ── Default config values ──────────────────────────────
DEFAULT_CONFIG = {
    "llm_provider": "lm_studio",
    "llm_base_url": "http://localhost:1234/v1",
    "llm_api_key": "lm-studio",
    "llm_model": "zai-org/glm-4.7-flash",
    "llm_temperature": 0.1,
    "max_tokens": 1024,
}

DEFAULT_SYSTEM_PROMPT = """你是一个 SPARQL 查询生成器。根据本体结构将用户问题翻译为 SPARQL 查询。

本体结构:
- 类: {classes}
- 数据属性: {properties}
- 对象属性(关系): {relationships}

声明的 Prefix:
{prefixes}

重要：必须使用上面声明的 Prefix 中的 cls: 前缀来构建 URI。
类 URI 用 cls:<ClassName>，属性 URI 也用 cls:<propertyName>。
不要编造其他命名空间。

规则:
1. 只返回一条 SPARQL 查询，不要解释
2. URI 模板使用尖括号，变量使用问号前缀
3. 使用 PREFIX 声明命名空间
4. 中文值直接用引号匹配
5. 属性使用完整 URI（用 cls: 前缀 + 类名 + 属性名的模式）
6. 类的 URI 格式: cls:<ClassName>，属性的 URI 格式: cls:<propertyName>

示例:
- 查询所有类型为 X 的实例及其属性:
  SELECT ?s ?val WHERE {{
    ?s a cls:X ; cls:attr1 ?val .
  }}

- 查询有关系的两个实例:
  SELECT ?a ?b WHERE {{
    ?a a cls:A ; cls:ref_b_id ?b .
    ?b a cls:B .
  }}"""

DEFAULT_QUICK_QUESTIONS = [
    {"id": "1", "question": "有哪些物业项目？"},
    {"id": "2", "question": "望京花园有多少空间单元？"},
    {"id": "3", "question": "哪些账单是待缴状态？"},
    {"id": "4", "question": "每个项目的客户数量？"},
    {"id": "5", "question": "最近有哪些工单？"},
]


def _load_ai_config() -> dict:
    """Load AI config from SQLite, merging with defaults."""
    from repositories.ai_config_repo import load_config
    config = dict(DEFAULT_CONFIG)
    try:
        saved = load_config()
        config.update(saved)
    except Exception:
        pass
    return config


def _save_ai_config(config: dict):
    """Save AI config to SQLite."""
    from repositories.ai_config_repo import save_config
    save_config(config)


# ── Config API ─────────────────────────────────────────


class AIConfigUpdate(BaseModel):
    llm_provider: Optional[str] = None
    llm_base_url: Optional[str] = None
    llm_api_key: Optional[str] = None
    llm_model: Optional[str] = None
    llm_temperature: Optional[float] = None
    max_tokens: Optional[int] = None


class ModelDiscoveryRequest(BaseModel):
    provider: Optional[str] = None
    base_url: Optional[str] = None
    api_key: Optional[str] = None


def _resolve_effective_ai_settings(data: ModelDiscoveryRequest) -> tuple[str, str, str]:
    config = _load_ai_config()
    provider = data.provider or config.get("llm_provider", DEFAULT_CONFIG["llm_provider"])
    base_url = data.base_url or config.get("llm_base_url", DEFAULT_CONFIG["llm_base_url"])
    api_key = data.api_key or config.get("llm_api_key", "")

    # The UI receives a masked key; fall back to saved config when unchanged.
    if "*" in api_key:
        api_key = config.get("llm_api_key", "")

    return provider, base_url, api_key


def _normalize_base_url(base_url: str) -> str:
    return base_url.rstrip("/")


async def _fetch_openai_compatible_models(base_url: str, api_key: str) -> list[str]:
    headers: dict[str, str] = {}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
        response = await client.get(f"{_normalize_base_url(base_url)}/models", headers=headers)
        response.raise_for_status()
        payload = response.json()

    models = payload.get("data", [])
    names = [item.get("id", "") for item in models if isinstance(item, dict) and item.get("id")]
    return sorted(set(names))


async def _fetch_ollama_models(base_url: str) -> list[str]:
    normalized = _normalize_base_url(base_url)
    candidates = []

    if normalized.endswith("/v1"):
        candidates.append(f"{normalized[:-3]}/api/tags")
    candidates.append(f"{normalized}/api/tags")

    async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
        last_error: Exception | None = None
        for candidate in candidates:
            try:
                response = await client.get(candidate)
                response.raise_for_status()
                payload = response.json()
                models = payload.get("models", [])
                names = [item.get("name", "") for item in models if isinstance(item, dict) and item.get("name")]
                cleaned = sorted(set(name.split(":", 1)[0] if ":" in name else name for name in names))
                if cleaned:
                    return cleaned
            except Exception as exc:  # pragma: no cover - network branch
                last_error = exc
        if last_error:
            raise last_error
    return []


@router.post("/models")
async def discover_models(data: ModelDiscoveryRequest):
    """Discover available models for the current provider."""
    provider, base_url, api_key = _resolve_effective_ai_settings(data)
    preset = PROVIDER_PRESETS.get(provider, {"models": []})
    fallback_models = list(preset.get("models", []))

    if not base_url:
        return {
            "provider": provider,
            "base_url": base_url,
            "models": fallback_models,
            "source": "preset",
            "warning": "未配置 Base URL，返回预设模型列表。",
        }

    try:
        if provider == "ollama":
            models = await _fetch_ollama_models(base_url)
        else:
            models = await _fetch_openai_compatible_models(base_url, api_key)

        if not models:
            raise HTTPException(status_code=404, detail="No models returned")

        return {
            "provider": provider,
            "base_url": base_url,
            "models": models,
            "source": "remote",
            "warning": None,
        }
    except Exception as exc:
        logger.warning("Failed to discover models for provider %s: %s", provider, exc)
        return {
            "provider": provider,
            "base_url": base_url,
            "models": fallback_models,
            "source": "preset" if fallback_models else "manual",
            "warning": "无法自动拉取模型列表，已切换到预设或手动输入。",
            "error": str(exc),
        }


@router.get("/providers")
async def list_providers():
    """List available LLM providers with presets."""
    return {k: {"label": v["label"], "base_url": v["base_url"], "models": v["models"]} for k, v in PROVIDER_PRESETS.items()}


class SystemPromptUpdate(BaseModel):
    system_prompt: str


class QuickQuestionsUpdate(BaseModel):
    questions: list[dict]


@router.get("/config")
async def get_ai_config():
    """Get current AI configuration (API key masked)."""
    config = _load_ai_config()
    # Mask API key
    api_key = config.get("llm_api_key", "")
    if api_key and len(api_key) > 4:
        config["llm_api_key"] = api_key[:2] + "*" * (len(api_key) - 4) + api_key[-2:]
    return config


@router.put("/config")
async def update_ai_config(data: AIConfigUpdate):
    """Update AI configuration."""
    config = _load_ai_config()
    updates = data.model_dump(exclude_none=True)
    config.update(updates)
    _save_ai_config(config)

    # Reload LLM client
    from services.llm_service import reload_client
    reload_client(
        base_url=config["llm_base_url"],
        api_key=config.get("llm_api_key", ""),
        model=config["llm_model"],
        temperature=config.get("llm_temperature", 0.1),
        max_tokens=config.get("max_tokens", 1024),
    )
    return {"success": True, "message": "Configuration updated"}


@router.get("/system-prompt")
async def get_system_prompt():
    """Get current system prompt template."""
    config = _load_ai_config()
    return {"system_prompt": config.get("system_prompt", DEFAULT_SYSTEM_PROMPT)}


@router.put("/system-prompt")
async def update_system_prompt(data: SystemPromptUpdate):
    """Update system prompt template."""
    config = _load_ai_config()
    config["system_prompt"] = data.system_prompt
    _save_ai_config(config)
    return {"success": True, "message": "System prompt updated"}


@router.get("/quick-questions")
async def get_quick_questions():
    """Get quick questions list."""
    config = _load_ai_config()
    return {"questions": config.get("quick_questions", DEFAULT_QUICK_QUESTIONS)}


@router.put("/quick-questions")
async def update_quick_questions(data: QuickQuestionsUpdate):
    """Update quick questions list."""
    config = _load_ai_config()
    config["quick_questions"] = data.questions
    _save_ai_config(config)
    return {"success": True, "message": "Quick questions updated"}


# ── Ontology Summary ──────────────────────────────────


@router.get("/ontology-summary")
async def ontology_summary():
    """Get ontology schema summary for prompt context."""
    import re as re_mod

    mapping_content = MAPPING_FILE.read_text(encoding="utf-8")
    parsed = parse_obda(mapping_content)

    classes = set()
    data_properties = set()
    object_properties = set()
    all_uris: set[str] = set()

    for m in parsed.mappings:
        target = m.target
        class_matches = re_mod.findall(r'a\s+<([^>]+)>', target)
        for c in class_matches:
            classes.add(c.split("/")[-1])
            all_uris.add(c)

        # Extract property URIs: match <uri> {column}
        prop_matches = re_mod.findall(r'<([^>]+)>\s*\{[^}]+\}', target)
        for p in prop_matches:
            if p.startswith("http://www.w3.org/") or p.startswith("https://www.w3.org/"):
                continue
            all_uris.add(p)
            local_name = p.rsplit("/", 1)[-1].rsplit("#", 1)[-1]
            if local_name.startswith("ref-"):
                object_properties.add(local_name)
            else:
                data_properties.add(local_name)

    # Auto-detect ontology namespace
    namespaces: dict[str, str] = dict(parsed.prefixes)
    for uri in all_uris:
        base = uri.rsplit("/", 1)[0] + "/"
        if base.startswith("http://ontology.") or base.startswith("http://example.com/ontology"):
            if "cls" not in namespaces:
                namespaces["cls"] = base
            break

    if "cls" not in namespaces and classes:
        for uri in all_uris:
            if uri.endswith(next(iter(classes))):
                base = uri.rsplit("/", 1)[0] + "/"
                namespaces["cls"] = base
                break

    return {
        "classes": sorted(classes),
        "data_properties": sorted(data_properties),
        "object_properties": sorted(object_properties),
        "prefixes": namespaces,
    }


# ── AI Query Pipeline ──────────────────────────────────


@router.get("/query")
async def ai_query(question: str):
    """Full NL -> SPARQL -> results -> answer pipeline with SSE streaming."""
    import asyncio

    async def event_generator():
        summary = await ontology_summary()
        yield {"event": "step", "data": json.dumps({"step": "analyzing", "message": "Analyzing ontology..."})}

        # Use custom system prompt if configured
        config = _load_ai_config()
        custom_prompt = config.get("system_prompt", DEFAULT_SYSTEM_PROMPT)

        prompt = build_sparql_prompt(
            classes=summary["classes"],
            properties=summary["data_properties"],
            relationships=summary["object_properties"],
            prefixes=summary["prefixes"],
            template=custom_prompt,
        )

        sparql = await generate_sparql(prompt, question)
        sparql = sparql.strip()
        if sparql.startswith("```"):
            sparql = "\n".join(sparql.split("\n")[1:-1])

        # Auto-inject PREFIX declarations if missing
        prefix_lines = []
        for prefix, uri in summary["prefixes"].items():
            if f"PREFIX {prefix}:" not in sparql:
                prefix_lines.append(f"PREFIX {prefix}: <{uri}>")
        if prefix_lines:
            sparql = "\n".join(prefix_lines) + "\n" + sparql

        yield {"event": "sparql", "data": json.dumps({"step": "sparql_generated", "sparql": sparql})}

        yield {"event": "step", "data": json.dumps({"step": "executing", "message": "Executing query..."})}

        sql = ""
        result_text = ""
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                resp = await client.get(
                    f"{ONTOP_ENDPOINT_URL}/ontop/reformulate",
                    params={"query": sparql},
                )
                if resp.status_code == 200:
                    sql = resp.text
            except Exception:
                pass

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

        answer = await generate_answer(question, result_text[:2000])
        yield {"event": "answer", "data": json.dumps({"step": "answer", "answer": answer})}

    return EventSourceResponse(event_generator())
