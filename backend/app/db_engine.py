"""
IBVAP Dual-Engine Database Manager (PostgreSQL + SQLite)
Transparently routes queries to PostgreSQL when DATABASE_URL is configured (e.g. Railway),
or gracefully falls back to local SQLite for development.
"""

import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union


def get_default_sqlite_path() -> Path:
    """Return default path to SQLite events.db."""
    return Path(__file__).resolve().parent.parent / "events.db"


def get_database_url() -> Optional[str]:
    """Retrieve normalized PostgreSQL DATABASE_URL if configured."""
    url = os.getenv("DATABASE_URL")
    if not url:
        return None
    url = url.strip()
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    return url


def is_postgres() -> bool:
    """Check if system is operating in PostgreSQL mode."""
    return bool(get_database_url())


class UnifiedCursor:
    """Cursor wrapper that normalizes SQLite (?) and PostgreSQL (%s) parameter markers."""
    def __init__(self, raw_cursor, is_pg: bool):
        self._cursor = raw_cursor
        self._is_pg = is_pg

    def _convert_query(self, query: str) -> str:
        if self._is_pg:
            # PostgreSQL uses %s placeholders, SQLite uses ?
            return query.replace("?", "%s")
        return query

    def execute(self, query: str, params: Union[Tuple, List] = ()):
        conv_q = self._convert_query(query)
        return self._cursor.execute(conv_q, params)

    def executemany(self, query: str, seq_of_params):
        conv_q = self._convert_query(query)
        return self._cursor.executemany(conv_q, seq_of_params)

    def fetchone(self):
        return self._cursor.fetchone()

    def fetchall(self):
        return self._cursor.fetchall()

    def fetchone_dict(self) -> Optional[Dict[str, Any]]:
        row = self._cursor.fetchone()
        if row is None:
            return None
        if hasattr(row, "keys"):
            return dict(row)
        if self._cursor.description:
            colnames = [col[0] for col in self._cursor.description]
            return dict(zip(colnames, row))
        return dict(row)

    def fetchall_dicts(self) -> List[Dict[str, Any]]:
        rows = self._cursor.fetchall()
        if not rows:
            return []
        if hasattr(rows[0], "keys"):
            return [dict(r) for r in rows]
        if self._cursor.description:
            colnames = [col[0] for col in self._cursor.description]
            return [dict(zip(colnames, r)) for r in rows]
        return [dict(r) for r in rows]

    @property
    def rowcount(self):
        return self._cursor.rowcount

    @property
    def lastrowid(self):
        return getattr(self._cursor, "lastrowid", None)


class UnifiedConnection:
    """Connection wrapper providing a uniform API for both SQLite and PostgreSQL."""
    def __init__(self, raw_conn, is_pg: bool):
        self._conn = raw_conn
        self._is_pg = is_pg

    def cursor(self) -> UnifiedCursor:
        return UnifiedCursor(self._conn.cursor(), self._is_pg)

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        self._conn.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            self.rollback()
        else:
            self.commit()
        self.close()


@contextmanager
def get_db_connection(db_path: Optional[Path] = None):
    """
    Context manager yielding a UnifiedConnection.
    If DATABASE_URL is set -> Connects to PostgreSQL.
    Otherwise -> Connects to SQLite at db_path (or default events.db).
    """
    pg_url = get_database_url()
    if pg_url:
        try:
            import psycopg2
            from psycopg2.extras import DictCursor
            conn = psycopg2.connect(pg_url)
            u_conn = UnifiedConnection(conn, is_pg=True)
            yield u_conn
            return
        except Exception as pg_err:
            print(f"[!] Warning: PostgreSQL connection failed ({pg_err}), falling back to SQLite.")

    # SQLite fallback
    if db_path is None:
        db_path = get_default_sqlite_path()
    sqlite_conn = sqlite3.connect(str(db_path), timeout=15.0)
    u_conn = UnifiedConnection(sqlite_conn, is_pg=False)
    yield u_conn
