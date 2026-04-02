"""LLM service for natural language to SPARQL translation."""
import logging
from typing import AsyncGenerator

from openai import AsyncOpenAI

from config import LLM_BASE_URL, LLM_API_KEY, LLM_MODEL

logger = logging.getLogger(__name__)

client = AsyncOpenAI(base_url=LLM_BASE_URL, api_key=LLM_API_KEY)

SPARQL_SYSTEM_PROMPT = """你是一个 SPARQL 查询生成器。根据本体结构将用户问题翻译为 SPARQL 查询。

本体结构:
- 类: {classes}
- 数据属性: {properties}
- 对象属性(关系): {relationships}

Prefix:
{prefixes}

规则:
1. 只返回一条 SPARQL 查询，不要解释
2. URI 模板使用尖括号，变量使用问号前缀
3. 使用 PREFIX 声明命名空间
4. 中文值直接用引号匹配

示例:
- 查询所有门店:
  PREFIX cls: <http://example.com/retail/>
  PREFIX p: <http://example.com/retail/dim_store#>
  SELECT ?store ?name ?region WHERE {{
    ?store a cls:dim_store ; p:name ?name ; p:region ?region .
  }}

- 查询某门店的员工:
  PREFIX cls: <http://example.com/retail/>
  PREFIX sp: <http://example.com/retail/dim_store#>
  PREFIX ep: <http://example.com/retail/dim_employee#>
  SELECT ?emp ?name ?role WHERE {{
    ?store a cls:dim_store ; sp:name "华东旗舰店" .
    ?emp a cls:dim_employee ; ep:name ?name ; ep:role ?role .
    ?emp <http://example.com/retail/dim_employee#ref-store_id> ?store .
  }}
"""

ANSWER_SYSTEM_PROMPT = """根据以下 SPARQL 查询结果，用中文简洁回答用户问题。

用户问题: {question}
SPARQL 查询结果: {result}

简洁回答:"""


def build_sparql_prompt(
    classes: list[str],
    properties: list[str],
    relationships: list[str],
    prefixes: dict[str, str],
) -> str:
    """Build the SPARQL generation system prompt."""
    prefix_str = "\n".join(f"PREFIX {k}: <{v}>" for k, v in prefixes.items())
    return SPARQL_SYSTEM_PROMPT.format(
        classes=", ".join(classes),
        properties=", ".join(properties),
        relationships=", ".join(relationships),
        prefixes=prefix_str,
    )


async def generate_sparql(system_prompt: str, question: str) -> str:
    """Generate SPARQL query from natural language question."""
    response = await client.chat.completions.create(
        model=LLM_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": question},
        ],
        temperature=0.1,
        max_tokens=1024,
    )
    return response.choices[0].message.content.strip()


async def generate_answer(question: str, result: str) -> str:
    """Generate natural language answer from query results."""
    prompt = ANSWER_SYSTEM_PROMPT.format(question=question, result=result)
    response = await client.chat.completions.create(
        model=LLM_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=512,
    )
    return response.choices[0].message.content.strip()
