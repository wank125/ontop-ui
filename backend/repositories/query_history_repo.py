"""Query history repository — SQLite-backed with auto-prune."""
import uuid
from datetime import datetime

from database import get_connection

MAX_HISTORY = 100


def list_history() -> list[dict]:
    """Return query history, most recent first."""
    conn = get_connection()
    rows = conn.execute(
        "SELECT id, query, timestamp, result_count FROM query_history ORDER BY timestamp DESC"
    ).fetchall()
    return [dict(r) for r in rows]


def save_to_history(query: str, result_count: int | None = None) -> dict:
    """Save a query to history. Auto-prunes to MAX_HISTORY entries."""
    entry_id = str(uuid.uuid4())[:8]
    now = datetime.now().isoformat()

    conn = get_connection()
    conn.execute(
        "INSERT INTO query_history (id, query, timestamp, result_count) VALUES (?, ?, ?, ?)",
        (entry_id, query, now, result_count),
    )
    # Auto-prune: keep only the latest MAX_HISTORY
    conn.execute(
        """DELETE FROM query_history WHERE id NOT IN (
            SELECT id FROM query_history ORDER BY timestamp DESC LIMIT ?
        )""",
        (MAX_HISTORY,),
    )
    conn.commit()

    return {"id": entry_id, "query": query, "timestamp": now, "result_count": result_count}


def delete_history_entry(entry_id: str) -> bool:
    """Delete a single history entry. Returns True if deleted."""
    conn = get_connection()
    cursor = conn.execute("DELETE FROM query_history WHERE id = ?", (entry_id,))
    conn.commit()
    return cursor.rowcount > 0


def clear_history():
    """Delete all history entries."""
    conn = get_connection()
    conn.execute("DELETE FROM query_history")
    conn.commit()
