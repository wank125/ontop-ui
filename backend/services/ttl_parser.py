"""TTL (Turtle) ontology parser — extracts classes, properties, and SHACL constraints."""
import re
from models.ontology import (
    TtlOntology, OntologyMetadata, BilingualLabel,
    OwlClass, OwlObjectProperty, OwlDataProperty,
    ShaclConstraint, ShaclPropertyConstraint, ShaclSparqlConstraint,
)

# Section-to-domain mapping (from TTL comments)
DOMAIN_SECTIONS = [
    (r"W域|W-域|W域：物", "W"),
    (r"H域|H-域|H域：人", "H"),
    (r"F域|F-域|F域：财", "F"),
    (r"E域|E-域|E域：事", "E"),
]


def _local_name(uri_or_prefixed: str) -> str:
    if ":" in uri_or_prefixed and not uri_or_prefixed.startswith("http"):
        return uri_or_prefixed.split(":", 1)[1]
    if "/" in uri_or_prefixed:
        return uri_or_prefixed.rstrip("/>").split("/")[-1]
    return uri_or_prefixed


def _extract_bilingual(pairs: list[tuple[str, str]]) -> BilingualLabel:
    zh, en = "", ""
    for lang, val in pairs:
        if lang == "zh":
            zh = val
        elif lang == "en":
            en = val
    return BilingualLabel(zh=zh, en=en)


def _parse_literal(raw: str) -> str:
    raw = raw.strip()
    if raw.startswith('"""'):
        return raw[3:].rstrip('"').strip()
    m = re.match(r'"([^"]*)"(?:@(\w+))?(?:\^\^.+)?$', raw)
    if m:
        return m.group(1)
    return raw


def _find_matching_bracket(text: str, start: int) -> int:
    """Find the matching ] for [ at position start, handling nesting and triple-quotes."""
    depth = 0
    i = start
    n = len(text)
    in_triple = False
    while i < n:
        if text[i:i+3] == '"""':
            in_triple = not in_triple
            i += 3
            continue
        if in_triple:
            i += 1
            continue
        if text[i] == '[':
            depth += 1
        elif text[i] == ']':
            depth -= 1
            if depth == 0:
                return i
        i += 1
    return -1


def _find_end_of_block(text: str, start: int) -> int:
    """Find the '.' that ends a subject block, respecting brackets, quotes, and triple-quotes."""
    depth = 0
    i = start
    n = len(text)
    in_triple = False
    in_quote = False
    while i < n:
        if text[i:i+3] == '"""':
            in_triple = not in_triple
            i += 3
            continue
        if in_triple:
            i += 1
            continue
        if text[i] == '"' and not in_quote:
            in_quote = True
            i += 1
            continue
        if text[i] == '\\' and in_quote:
            i += 2  # skip escaped char
            continue
        if text[i] == '"' and in_quote:
            in_quote = False
            i += 1
            continue
        if in_quote:
            i += 1
            continue
        if text[i] == '[':
            depth += 1
        elif text[i] == ']':
            depth -= 1
        elif text[i] == '.' and depth == 0:
            return i
        i += 1
    return n


def _split_into_blocks(content: str) -> list[tuple[str, str]]:
    """Split TTL into (subject, predicate-object-body) pairs."""
    # Remove @prefix lines, comments, and blank lines
    # Domain detection is handled separately in parse_ttl() via domain_by_subject
    lines = content.split('\n')
    filtered = []
    for line in lines:
        s = line.strip()
        if s.startswith('@prefix') or s.startswith('@base'):
            continue
        if s.startswith('#'):
            continue
        if s == '':
            continue
        filtered.append(line)
    text = '\n'.join(filtered)

    blocks = []
    i = 0
    n = len(text)
    while i < n:
        # Skip whitespace
        while i < n and text[i] in ' \t\n\r':
            i += 1
        if i >= n:
            break

        # Read subject (first token)
        subj_start = i
        if text[i] == '<':
            while i < n and text[i] != '>':
                i += 1
            i += 1
        else:
            while i < n and text[i] not in ' \t\n\r':
                i += 1
        subject = text[subj_start:i].strip()
        if not subject:
            i += 1
            continue

        # Find end of block
        end = _find_end_of_block(text, i)
        body = text[i:end].strip()
        blocks.append((subject, body))
        i = end + 1  # skip the '.'

    return blocks


def _tokenize_pred_objs(body: str) -> dict[str, list[str]]:
    """Parse a predicate-object body into {predicate: [object_values]}.

    Handles semicolons (new predicate), commas (multiple objects),
    blank nodes [...], quoted strings, and triple-quoted strings.
    """
    result = {}
    i = 0
    n = len(body)
    current_pred = None

    while i < n:
        # Skip whitespace
        while i < n and body[i] in ' \t\n\r':
            i += 1
        if i >= n:
            break

        # Semicolon = new predicate starts
        if body[i] == ';':
            current_pred = None
            i += 1
            continue

        if current_pred is None:
            # Read predicate
            tok_start = i
            if body[i] == '<':
                while i < n and body[i] != '>':
                    i += 1
                i += 1
            else:
                while i < n and body[i] not in ' \t\n\r;[':
                    i += 1
            current_pred = body[tok_start:i].strip()
        else:
            # Read object value
            val = _read_object_value(body, i)
            obj_str, new_i = val
            i = new_i
            if obj_str is not None:
                result.setdefault(current_pred, []).append(obj_str)

    return result


def _read_object_value(text: str, start: int) -> tuple[str | None, int]:
    """Read one object value starting at position start. Returns (value_string, new_position)."""
    i = start
    n = len(text)

    # Skip whitespace
    while i < n and text[i] in ' \t\n\r':
        i += 1
    if i >= n:
        return None, i

    # Blank node [...]
    if text[i] == '[':
        end = _find_matching_bracket(text, i)
        if end == -1:
            end = n - 1
        return text[i:end+1], end + 1

    # Triple-quoted string
    if text[i:i+3] == '"""':
        j = text.find('"""', i + 3)
        if j == -1:
            return text[i:], n
        val = text[i:j+3]
        # Skip language tag or datatype after closing """
        k = j + 3
        while k < n and text[k] not in ' \t\n\r;':
            k += 1
        return val, k

    # Regular quoted string "..."
    if text[i] == '"':
        j = i + 1
        while j < n:
            if text[j] == '\\':
                j += 2
                continue
            if text[j] == '"':
                break
            j += 1
        # Include closing quote
        j += 1  # past closing "
        # Skip language tag or datatype
        while j < n and text[j] not in ' \t\n\r;[':
            j += 1
        return text[i:j], j

    # URI <...>
    if text[i] == '<':
        j = text.find('>', i)
        if j == -1:
            return text[i:], n
        return text[i:j+1], j + 1

    # Plain token (prefixed name, number, etc.)
    tok_start = i
    while i < n and text[i] not in ' \t\n\r;[':
        i += 1
    return text[tok_start:i], i


def _extract_labels(pred_objs: dict) -> BilingualLabel:
    pairs = []
    for raw_val in pred_objs.get('rdfs:label', []):
        m = re.match(r'"([^"]*)"@(\w+)', raw_val)
        if m:
            pairs.append((m.group(2), m.group(1)))
        else:
            pairs.append(("en", _parse_literal(raw_val)))
    return _extract_bilingual(pairs)


def _extract_comments(pred_objs: dict) -> BilingualLabel:
    pairs = []
    for raw_val in pred_objs.get('rdfs:comment', []):
        m = re.match(r'"([^"]*)"@(\w+)', raw_val)
        if m:
            pairs.append((m.group(2), m.group(1)))
        else:
            # Try triple-quoted
            if raw_val.startswith('"""'):
                pairs.append(("zh", _parse_literal(raw_val)))
            else:
                val = _parse_literal(raw_val)
                if val:
                    pairs.append(("zh", val))
    return _extract_bilingual(pairs)


def _parse_shacl_properties(pred_objs: dict) -> list[ShaclPropertyConstraint]:
    results = []
    for raw_bn in pred_objs.get('sh:property', []):
        if not raw_bn.startswith('['):
            continue
        constraint = _parse_single_shacl_property(raw_bn)
        results.append(constraint)
    return results


def _parse_single_shacl_property(raw: str) -> ShaclPropertyConstraint:
    constraint = ShaclPropertyConstraint()
    # Extract inner content (strip outer [])
    inner = raw
    if inner.startswith('['):
        inner = inner[1:]
    if inner.endswith(']'):
        inner = inner[:-1]

    # Parse the inner predicate-object pairs recursively
    pred_objs = _tokenize_pred_objs(inner)

    # sh:path — could be simple URI or blank node [ sh:inverse ... ]
    path_vals = pred_objs.get('sh:path', [])
    if path_vals:
        path_val = path_vals[0]
        if path_val.startswith('['):
            inv_match = re.search(r'sh:inverse\s+(\S+)', path_val)
            if inv_match:
                constraint.path_inverse = _local_name(inv_match.group(1))
        else:
            constraint.path = _local_name(path_val)

    # Simple scalar fields
    if pred_objs.get('sh:minCount'):
        try:
            constraint.min_count = int(_parse_literal(pred_objs['sh:minCount'][0]))
        except (ValueError, IndexError):
            pass
    if pred_objs.get('sh:minInclusive'):
        try:
            constraint.min_inclusive = float(pred_objs['sh:minInclusive'][0])
        except (ValueError, IndexError):
            pass
    if pred_objs.get('sh:minExclusive'):
        try:
            constraint.min_exclusive = float(pred_objs['sh:minExclusive'][0])
        except (ValueError, IndexError):
            pass
    if pred_objs.get('sh:datatype'):
        constraint.datatype = pred_objs['sh:datatype'][0]
    if pred_objs.get('sh:hasValue'):
        constraint.has_value = _parse_literal(pred_objs['sh:hasValue'][0])

    # sh:in ( "val1" "val2" )
    for raw_val in pred_objs.get('sh:in', []):
        constraint.in_values = re.findall(r'"([^"]*)"', raw_val)

    return constraint


def _parse_shacl_sparql(pred_objs: dict) -> list[ShaclSparqlConstraint]:
    results = []
    for raw_bn in pred_objs.get('sh:sparql', []):
        if not raw_bn.startswith('['):
            continue
        inner = raw_bn[1:-1] if raw_bn.endswith(']') else raw_bn[1:]
        sparql = ShaclSparqlConstraint()

        # Extract message
        m = re.search(r'sh:message\s+"([^"]*)"@?\w*', inner)
        if m:
            sparql.message = m.group(1)

        # Extract SPARQL query (triple-quoted)
        m = re.search(r'sh:select\s+"""(.+?)"""', inner, re.DOTALL)
        if m:
            sparql.select = m.group(1).strip()

        results.append(sparql)
    return results


def parse_ttl(content: str) -> TtlOntology:
    """Parse a Turtle ontology file into structured data."""
    ontology = TtlOntology()
    pending_annotations: list[tuple[str, dict]] = []

    # Detect domain sections from comments
    current_domain = ""
    lines = content.split('\n')
    domain_by_subject = {}
    for line in lines:
        stripped = line.strip()
        for pattern, tag in DOMAIN_SECTIONS:
            if re.search(pattern, stripped):
                current_domain = tag
                break
        if stripped and not stripped.startswith('#') and not stripped.startswith('@'):
            subject = stripped.split()[0] if stripped.split() else ""
            if subject and current_domain:
                domain_by_subject[subject] = current_domain

    # Split into subject blocks
    blocks = _split_into_blocks(content)

    for subject, body in blocks:
        pred_objs = _tokenize_pred_objs(body)
        rdf_types = pred_objs.get('rdf:type', pred_objs.get('a', []))

        # Determine subject type
        subject_type = ""
        for t in rdf_types:
            local = _local_name(t)
            if local in ('Class', 'ObjectProperty', 'DatatypeProperty', 'Ontology', 'NodeShape'):
                subject_type = local
                break

        if subject_type == 'Class':
            local = _local_name(subject)
            domain = domain_by_subject.get(subject, "")
            examples = [_parse_literal(v) for v in pred_objs.get('skos:example', [])]
            ontology.classes.append(OwlClass(
                name=subject,
                local_name=local,
                labels=_extract_labels(pred_objs),
                comments=_extract_comments(pred_objs),
                examples=examples,
                domain_tag=domain,
            ))

        elif subject_type == 'ObjectProperty':
            domain = pred_objs.get('rdfs:domain', [''])[0]
            range_ = pred_objs.get('rdfs:range', [''])[0]
            inverse = pred_objs.get('owl:inverseOf', [''])[0]
            ontology.object_properties.append(OwlObjectProperty(
                name=subject,
                local_name=_local_name(subject),
                labels=_extract_labels(pred_objs),
                comments=_extract_comments(pred_objs),
                domain=_local_name(domain),
                range=_local_name(range_),
                inverse_of=_local_name(inverse) if inverse else "",
            ))

        elif subject_type == 'DatatypeProperty':
            domain = pred_objs.get('rdfs:domain', [''])[0]
            range_ = pred_objs.get('rdfs:range', [''])[0]
            ontology.data_properties.append(OwlDataProperty(
                name=subject,
                local_name=_local_name(subject),
                labels=_extract_labels(pred_objs),
                comments=_extract_comments(pred_objs),
                domain=_local_name(domain),
                range=range_,
            ))

        elif subject_type == 'Ontology':
            ontology.metadata = OntologyMetadata(
                labels=_extract_labels(pred_objs),
                comments=_extract_comments(pred_objs),
                version=_parse_literal(pred_objs.get('owl:versionInfo', [''])[0]) if pred_objs.get('owl:versionInfo') else "",
                version_iri=pred_objs.get('owl:versionIRI', [''])[0].strip('<>') if pred_objs.get('owl:versionIRI') else "",
            )

        elif subject_type == 'NodeShape':
            target = pred_objs.get('sh:targetClass', [''])[0]
            props = _parse_shacl_properties(pred_objs)
            sparqls = _parse_shacl_sparql(pred_objs)
            ontology.shacl_constraints.append(ShaclConstraint(
                name=subject,
                local_name=_local_name(subject),
                labels=_extract_labels(pred_objs),
                comments=_extract_comments(pred_objs),
                target_class=_local_name(target) if target else "",
                properties=props,
                sparql_constraints=sparqls,
            ))
        elif pred_objs.get('rdfs:label') or pred_objs.get('rdfs:comment'):
            pending_annotations.append((subject, pred_objs))

    if pending_annotations:
        class_by_local = {item.local_name: item for item in ontology.classes}
        data_by_local = {item.local_name: item for item in ontology.data_properties}
        object_by_local = {item.local_name: item for item in ontology.object_properties}

        for subject, pred_objs in pending_annotations:
            local = _local_name(subject)
            labels = _extract_labels(pred_objs)
            comments = _extract_comments(pred_objs)

            target = class_by_local.get(local) or data_by_local.get(local) or object_by_local.get(local)
            if not target:
                continue

            if labels.zh:
                target.labels.zh = labels.zh
            if labels.en:
                target.labels.en = labels.en
            if comments.zh:
                target.comments.zh = comments.zh
            if comments.en:
                target.comments.en = comments.en

    return ontology
