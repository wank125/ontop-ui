"""Bootstrap 后本体语义增强服务 — 用 LLM 为每个类/属性自动生成中英文标注并写回 TTL。

调用时机：Bootstrap 完成后，异步在后台触发（不阻塞 HTTP 响应）。

流程：
  1. 解析 TTL，提取所有缺少 rdfs:label 的类和属性
  2. 批量调用 LLM 生成 (zh, en) 标注建议
  3. 将 label/comment 追加写入 TTL 文件（保留原有内容）
"""
import asyncio
import json
import logging
import re
from pathlib import Path

logger = logging.getLogger(__name__)


def _extract_unlabeled_entities(ttl_content: str) -> dict[str, list[str]]:
    """从 TTL 文本中提取尚未带有 rdfs:label 的类和属性名称。

    返回结构：
        {
            "classes": ["OrderItem", "Customer", ...],
            "data_properties": ["totalAmount", "createdAt", ...],
            "object_properties": ["hasCustomer", ...]
        }
    """
    classes: list[str] = []
    data_props: list[str] = []
    obj_props: list[str] = []

    # 按 subject 块划分，识别类型与是否已有 label
    # 简单正则匹配：寻找 owl:Class / owl:DatatypeProperty / owl:ObjectProperty 块
    block_pattern = re.compile(
        r'((?:[\w:]+|<[^>]+>)\s+(?:a|rdf:type)\s+(?:owl:Class|owl:DatatypeProperty|owl:ObjectProperty)[^.]+\.)',
        re.DOTALL
    )
    for block in block_pattern.finditer(ttl_content):
        text = block.group(1)
        # 跳过已有 label 的块
        if "rdfs:label" in text:
            continue
        # 提取 subject 本地名
        subj_match = re.match(r'([\w:]+|<[^>]+>)', text.strip())
        if not subj_match:
            continue
        subject = subj_match.group(1).strip("<>")
        if ":" in subject and not subject.startswith("http"):
            local = subject.split(":", 1)[1]
        else:
            local = subject.rsplit("/", 1)[-1].rsplit("#", 1)[-1].rstrip(">")
        if not local or local.startswith("_"):
            continue

        if "owl:Class" in text:
            classes.append(local)
        elif "owl:ObjectProperty" in text:
            obj_props.append(local)
        elif "owl:DatatypeProperty" in text:
            data_props.append(local)

    return {
        "classes": list(dict.fromkeys(classes)),          # deduplicate, keep order
        "data_properties": list(dict.fromkeys(data_props)),
        "object_properties": list(dict.fromkeys(obj_props)),
    }


async def _call_llm_for_labels(entity_list: list[dict], llm_client, model: str) -> list[dict]:
    """调用 LLM 批量生成中英文 label 和 comment。

    entity_list 形如：
        [{"name": "OrderItem", "kind": "class"}, {"name": "totalAmount", "kind": "data_property"}]

    返回：
        [{"name": "OrderItem", "label_zh": "订单明细", "label_en": "Order Item",
          "comment_zh": "表示一笔订单中的单个商品行", "comment_en": "..."}]
    """
    if not entity_list:
        return []

    names_json = json.dumps([e["name"] for e in entity_list], ensure_ascii=False)
    system_prompt = (
        "你是一名数据治理专家，负责为从关系数据库自动生成的知识图谱本体提供语义标注。\n"
        "用户会给你一个本体实体名称列表（camelCase 或 PascalCase 的类/属性名），\n"
        "你需要为每个名称生成：\n"
        "  - label_zh: 简洁准确的中文名称（2-6字）\n"
        "  - label_en: 规范的英文名称（1-4 words, Title Case）\n"
        "  - comment_zh: 一句话业务描述（15-50字）\n"
        "  - comment_en: One sentence business description in English\n\n"
        "直接以 JSON 数组格式输出，不要任何额外说明。格式：\n"
        '[{"name":"XX","label_zh":"...","label_en":"...","comment_zh":"...","comment_en":"..."}]'
    )
    user_msg = f"请为以下本体实体生成语义标注（来自关系数据库自动 bootstrap）：\n{names_json}"

    try:
        response = await llm_client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_msg},
            ],
            temperature=0.2,
            max_tokens=2048,
        )
        raw = response.choices[0].message.content.strip()
        # 去掉可能的 markdown 包裹
        if raw.startswith("```"):
            raw = "\n".join(raw.split("\n")[1:-1]).strip()
        return json.loads(raw)
    except Exception as e:
        logger.warning("LLM label generation failed: %s", e)
        return []


def _build_label_triples(labels: list[dict], ttl_prefix: str) -> str:
    """把 LLM 返回的标注列表转换成 Turtle 追加块。"""
    lines: list[str] = ["\n# ── Auto-generated semantic labels (ontology_enrichment) ──\n"]
    for item in labels:
        name = item.get("name", "")
        if not name:
            continue
        label_zh = item.get("label_zh", "").replace('"', '\\"')
        label_en = item.get("label_en", "").replace('"', '\\"')
        comment_zh = item.get("comment_zh", "").replace('"', '\\"')
        comment_en = item.get("comment_en", "").replace('"', '\\"')
        if ttl_prefix == ":":
            subject = f":{name}"
        elif ttl_prefix:
            subject = f"{ttl_prefix}:{name}"
        else:
            subject = f"<{name}>"
        block = [f"\n{subject}"]
        if label_zh:
            block.append(f'    rdfs:label "{label_zh}"@zh')
        if label_en:
            block.append(f'    rdfs:label "{label_en}"@en')
        if comment_zh:
            block.append(f'    rdfs:comment "{comment_zh}"@zh')
        if comment_en:
            block.append(f'    rdfs:comment "{comment_en}"@en')
        if len(block) > 1:
            # Join with semicolons, end with period
            lines.append(block[0] + "\n" + " ;\n".join(block[1:]) + " .")
    return "\n".join(lines) + "\n"


def _detect_prefix(ttl_content: str) -> str:
    """从 TTL 中提取本体自身的主前缀（通常是 @prefix : 或最长的自定义 prefix）。"""
    # 优先寻找 @prefix : <...>
    m = re.search(r'@prefix\s+:\s*<([^>]+)>', ttl_content)
    if m:
        return ":"
    # 其次寻找非 owl/rdf 的前缀
    for m in re.finditer(r'@prefix\s+(\w+):\s*<([^>]+)>', ttl_content):
        prefix, uri = m.group(1), m.group(2)
        if prefix not in {"owl", "rdf", "rdfs", "xsd", "sh", "skos"}:
            return prefix
    return ""


async def enrich_ontology_labels(ttl_path: str, batch_size: int = 30) -> bool:
    """主入口：读取 TTL，提取未标注实体，调用 LLM，将结果追加写回文件。

    Args:
        ttl_path: 目标 TTL 文件绝对路径
        batch_size: 每批发送给 LLM 的实体数量（避免超出 token 限制）

    Returns:
        True 表示至少写入了一条标注，False 表示跳过（无需标注或失败）
    """
    path = Path(ttl_path)
    if not path.exists():
        logger.warning("enrich_ontology_labels: file does not exist: %s", ttl_path)
        return False

    ttl_content = path.read_text(encoding="utf-8")
    entities = _extract_unlabeled_entities(ttl_content)

    all_entities: list[dict] = (
        [{"name": n, "kind": "class"} for n in entities["classes"]]
        + [{"name": n, "kind": "data_property"} for n in entities["data_properties"]]
        + [{"name": n, "kind": "object_property"} for n in entities["object_properties"]]
    )

    if not all_entities:
        logger.info("enrich_ontology_labels: all entities already have labels, skipping.")
        return False

    logger.info("enrich_ontology_labels: enriching %d entities in %s", len(all_entities), ttl_path)

    # 懒加载 LLM client，避免循环依赖
    from services import llm_service
    client = llm_service._client
    model = llm_service._model

    all_labels: list[dict] = []
    for i in range(0, len(all_entities), batch_size):
        batch = all_entities[i: i + batch_size]
        labels = await _call_llm_for_labels(batch, client, model)
        all_labels.extend(labels)
        if i + batch_size < len(all_entities):
            # 避免 LLM 限速
            await asyncio.sleep(0.5)

    if not all_labels:
        return False

    prefix = _detect_prefix(ttl_content)
    triples = _build_label_triples(all_labels, prefix)

    # 追加到文件末尾
    with path.open("a", encoding="utf-8") as f:
        f.write(triples)

    logger.info("enrich_ontology_labels: wrote %d label blocks to %s", len(all_labels), ttl_path)
    return True
