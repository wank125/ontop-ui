---
name: Claude Session Storage Locations
description: Where Claude CLI stores conversation history files and the format used
type: reference
---

## Claude CLI History File Locations

- **Main history**: `~/.claude/history.jsonl` - 1311 lines, tracks session metadata
- **Project sessions**: `~/.claude/projects/<project-path-hash>/` - one directory per project
  - Each session gets a UUID-based `.jsonl` file (e.g., `7a3bc4b4-6164-4d68-b84c-1378effd14f3.jsonl`)
  - Subagents stored in `subagents/` subdirectory (e.g., `agent-a3b8d03.jsonl`)
- **Format**: JSONL (one JSON object per line), each line is a conversation message with `{"message": {"role": "...", "content": "..."}}`
- **Content encoding**: UTF-8, Chinese + English mixed content
- **Session directory naming**: URL-encoded path (e.g., `-Users-wangkai-SynologyDrive-20------18-microsoft-fabric-ontology/`)

## Key Neo4j Visualization Sessions Found

1. **`7a3bc4b4`** (2026-03-28 to 2026-04-01) - Main Ontop UI build session with ontology visualization module (Cytoscape.js)
   - Project: `-Users-wangkai-SynologyDrive-20------18-microsoft-fabric-ontology`
   - 1864 lines, contains the full Cytoscape integration, debugging, and fix

2. **`6e555011`** (2026-03-26 to 2026-03-28) - Open-source tech stack discussion, Neo4j vs Ontop comparison
   - Same project
   - 858 lines, contains full technology stack comparison

3. **`bf50552c`** (2026-03-25) - Neo4j source code analysis with neovis demos
   - Project: `-Users-wangkai-sourceFromGit-neo4j`

4. **`33305896`** (2026-03-25) - Neo4j ontology visualization features in source code
   - Project: `-Users-wangkai-sourceFromGit-neo4j`

## Physical Visualization Files

- `/Users/wangkai/sourceFromGit/neo4j/web/neovis-demo-v2.html` - Vis.js direct connection version
- `/Users/wangkai/sourceFromGit/neo4j/web/neovis-demo-v3.html` - Enhanced neovis version
- `/Users/wangkai/sourceFromGit/neo4j/web/ontology-visualization.html` - Ontology meta-model visualization
- `/Users/wangkai/sourceFromGit/neo4j/web/graph-visualization-preview.html` - Static SVG preview
