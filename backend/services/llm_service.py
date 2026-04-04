"""LLM service for natural language to SPARQL translation."""
import logging
from typing import Optional

from openai import AsyncOpenAI

from config import LLM_BASE_URL, LLM_API_KEY, LLM_MODEL

logger = logging.getLogger(__name__)

# Mutable module-level state
_client: AsyncOpenAI = AsyncOpenAI(base_url=LLM_BASE_URL, api_key=LLM_API_KEY)
_model: str = LLM_MODEL
_temperature: float = 0.1
_max_tokens: int = 1024

DEFAULT_ANSWER_PROMPT = """根据以下 SPARQL 查询结果，用中文简洁回答用户问题。

用户问题: {question}
SPARQL 查询结果: {result}

简洁回答:"""


def reload_client(
    base_url: str,
    api_key: str,
    model: str,
    temperature: float = 0.1,
    max_tokens: int = 1024,
):
    """Reload LLM client with new config."""
    global _client, _model, _temperature, _max_tokens
    _client = AsyncOpenAI(base_url=base_url, api_key=api_key)
    _model = model
    _temperature = temperature
    _max_tokens = max_tokens
    logger.info(f"LLM client reloaded: model={model}, base_url={base_url}")


def build_sparql_prompt(
    classes: list[str],
    properties: list[str],
    relationships: list[str],
    prefixes: dict[str, str],
    template: Optional[str] = None,
) -> str:
    """Build the SPARQL generation system prompt."""
    if template is None:
        template = "你是一个 SPARQL 查询生成器。根据本体结构将用户问题翻译为 SPARQL 查询。\n\n本体结构:\n- 类: {classes}\n- 数据属性: {properties}\n- 对象属性(关系): {relationships}\n\n声明的 Prefix:\n{prefixes}\n"

    prefix_str = "\n".join(f"PREFIX {k}: <{v}>" for k, v in prefixes.items())
    return template.format(
        classes=", ".join(classes),
        properties=", ".join(properties),
        relationships=", ".join(relationships),
        prefixes=prefix_str,
    )


async def generate_sparql(system_prompt: str, question: str) -> str:
    """Generate SPARQL query from natural language question."""
    response = await _client.chat.completions.create(
        model=_model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": question},
        ],
        temperature=_temperature,
        max_tokens=_max_tokens,
    )
    return response.choices[0].message.content.strip()


async def generate_answer(question: str, result: str) -> str:
    """Generate natural language answer from query results."""
    prompt = DEFAULT_ANSWER_PROMPT.format(question=question, result=result)
    response = await _client.chat.completions.create(
        model=_model,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=512,
    )
    return response.choices[0].message.content.strip()
