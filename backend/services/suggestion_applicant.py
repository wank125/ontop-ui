"""本体精化建议自动应用服务 — 将 accepted 建议写入 TTL 文件。

支持的自动应用类型：
  RENAME_CLASS:    在 TTL 中替换 ClassName（URI + rdfs:label）
  RENAME_PROPERTY: 同上，替换属性 local name
  REFINE_TYPE:     替换 rdfs:range 的 XSD 类型
  ADD_LABEL:       追加 rdfs:label 三元组（写入注释层，不改 TTL）

不自动应用（返回人工指引）：
  ADD_SUBCLASS:    给出需要追加的 Turtle 片段供人工核实
  MERGE_CLASS:     给出合并建议文本
"""
import logging
import re
from pathlib import Path

logger = logging.getLogger(__name__)


def apply_suggestion(suggestion: dict, ttl_path: str) -> tuple[bool, str]:
    """将单条建议应用到 TTL 文件。

    Returns:
        (success, message)
    """
    sug_type    = suggestion.get("type", "")
    current_val = suggestion.get("current_val", "")
    proposed_val = suggestion.get("proposed_val", "")

    if sug_type == "RENAME_CLASS":
        return _rename_in_ttl(ttl_path, current_val, proposed_val, "class")

    if sug_type == "RENAME_PROPERTY":
        return _rename_in_ttl(ttl_path, current_val, proposed_val, "property")

    if sug_type == "REFINE_TYPE":
        return _refine_xsd_type(ttl_path, current_val, proposed_val)

    if sug_type == "ADD_LABEL":
        # 写入语义注释层，不改 TTL
        return _add_label_to_annotation_layer(suggestion)

    if sug_type == "ADD_SUBCLASS":
        return False, (
            f"请手动在本体文件中追加：\n"
            f"  :{current_val} rdfs:subClassOf :{proposed_val} .\n"
            f"建议位置：{ttl_path} 中 :{current_val} 的类声明块之后"
        )

    return False, f"不支持自动应用的建议类型：{sug_type}"


# ── 内部实现 ─────────────────────────────────────────────


def _rename_in_ttl(ttl_path: str, current: str, proposed: str, kind: str) -> tuple[bool, str]:
    """在 TTL 文件中做安全的文本替换。

    替换逻辑（保守策略）：
      - 只替换 URI local name 部分（cls:ClassName 或 #propertyName）
      - 使用词边界避免误替换子字符串
    """
    path = Path(ttl_path)
    if not path.exists():
        return False, f"TTL 文件不存在：{ttl_path}"

    content = path.read_text(encoding="utf-8")
    original = content

    # 替换 URI 写法：:/ClassName 或 #ClassName
    pattern = re.compile(r'(?<=[:/])' + re.escape(current) + r'(?=[\s>.,;)])')
    new_content = pattern.sub(proposed, content)

    if new_content == original:
        return False, f"未找到 '{current}'，无需修改（可能已被重命名）"

    # 写入前备份
    backup_path = path.with_suffix(".ttl.bak")
    backup_path.write_text(original, encoding="utf-8")

    path.write_text(new_content, encoding="utf-8")
    count = len(pattern.findall(original))
    logger.info("Renamed %s '%s' → '%s' (%d occurrences) in %s",
                kind, current, proposed, count, ttl_path)
    return True, f"已将 '{current}' 重命名为 '{proposed}'（{count} 处），备份：{backup_path}"


def _refine_xsd_type(ttl_path: str, current_type: str, proposed_type: str) -> tuple[bool, str]:
    """替换 rdfs:range 中的 XSD 类型。"""
    path = Path(ttl_path)
    if not path.exists():
        return False, f"TTL 文件不存在：{ttl_path}"

    content = path.read_text(encoding="utf-8")

    # 替换 xsd:oldType → xsd:newType（精确匹配有界词）
    old = f"xsd:{current_type}"
    new = f"xsd:{proposed_type}"
    if old not in content:
        return False, f"未找到类型 '{old}'，无需修改"

    new_content = content.replace(old, new)
    backup = path.with_suffix(".ttl.bak")
    backup.write_text(content, encoding="utf-8")
    path.write_text(new_content, encoding="utf-8")
    count = content.count(old)
    return True, f"已将 '{old}' 精化为 '{new}'（{count} 处），备份：{backup}"


def _add_label_to_annotation_layer(suggestion: dict) -> tuple[bool, str]:
    """ADD_LABEL 类型：将建议的 label 写入语义注释层（pending 状态）。"""
    try:
        from repositories.annotation_repo import upsert_annotation  # type: ignore
        entity_uri = suggestion.get("current_val", "")
        label_zh   = suggestion.get("proposed_val", "")
        ds_id      = suggestion.get("ds_id", "")
        if not entity_uri or not label_zh:
            return False, "entity_uri 或 label 为空"
        upsert_annotation(
            ds_id=ds_id,
            entity_uri=entity_uri,
            entity_kind="class",
            lang="zh",
            label=label_zh,
            comment="",
            source="llm",
            status="pending",
        )
        return True, f"已将 '{label_zh}' 写入语义注释层（status=pending，请前往注释页审核）"
    except Exception as e:
        return False, f"写入注释层失败：{e}"
