import hashlib
import re
import psycopg
from psycopg.rows import dict_row
from django.conf import settings


READINESS_CHECKS = {
    'server_version': 'SHOW server_version;',
    'server_version_num': 'SHOW server_version_num;',
    'shared_preload_libraries': 'SHOW shared_preload_libraries;',
    'available': "SELECT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name='pg_stat_statements') AS available;",
    'created': "SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_stat_statements') AS created;",
    'has_view': "SELECT to_regclass('public.pg_stat_statements') IS NOT NULL AS has_view;",
}

PARAM_CHECKS = [
    'SHOW pg_stat_statements.track;',
    'SHOW pg_stat_statements.max;',
    'SHOW pg_stat_statements.save;',
    'SHOW pg_stat_statements.track_utility;',
]


def get_connection(instance, password: str):
    return psycopg.connect(
        host=instance.host,
        port=instance.port,
        dbname=instance.dbname,
        user=instance.user,
        password=password,
        sslmode=instance.ssl_mode,
        row_factory=dict_row,
    )


def check_setup(conn):
    out = {}
    with conn.cursor() as cur:
        for key, sql in READINESS_CHECKS.items():
            cur.execute(sql)
            row = cur.fetchone()
            if isinstance(row, dict):
                out[key] = next(iter(row.values()))
            else:
                out[key] = row[0]

    preload = str(out.get('shared_preload_libraries', ''))
    preload_ok = 'pg_stat_statements' in [s.strip() for s in preload.split(',') if s.strip()]
    ready = bool(out['available']) and preload_ok and bool(out['created']) and bool(out['has_view'])

    status = 'READY' if ready else 'BLOCKED'
    if not out['available']:
        status = 'BLOCKED'
    elif not preload_ok:
        status = 'NEEDS_PRELOAD'
    elif not out['created']:
        status = 'NEEDS_CREATE_EXTENSION'

    params = {}
    with conn.cursor() as cur:
        for sql in PARAM_CHECKS:
            try:
                cur.execute(sql)
                params[sql.split()[1].strip(';')] = cur.fetchone()[0]
            except Exception:
                conn.rollback()

    return {
        'status': status,
        'ready': ready,
        'pg_version_num': int(out['server_version_num']),
        'preload_ok': preload_ok,
        'ext_created': bool(out['created']),
        'checks': out,
        'params': params,
    }


def collect_top_queries(conn, limit=200, min_calls=5, min_total_time_ms=50):
    sql = """
    SELECT queryid::text AS queryid, query, calls, total_time, mean_time, rows,
           COALESCE(shared_blks_read,0) AS shared_blks_read,
           COALESCE(shared_blks_hit,0) AS shared_blks_hit,
           COALESCE(temp_blks_written,0) AS temp_blks_written,
           COALESCE(wal_bytes,0) AS wal_bytes
    FROM pg_stat_statements
    WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
    ORDER BY total_time DESC
    LIMIT %s;
    """
    cleaned = []
    with conn.cursor() as cur:
        cur.execute(sql, (limit,))
        for row in cur.fetchall():
            if row['calls'] < min_calls or row['total_time'] < min_total_time_ms:
                continue
            query_text = normalize_query(row['query'])
            cleaned.append(
                {
                    'queryid': row['queryid'],
                    'query_norm': query_text if not settings.STORE_FULL_QUERY_TEXT else row['query'],
                    'calls': row['calls'],
                    'total_time_ms': row['total_time'],
                    'mean_time_ms': row['mean_time'],
                    'rows': row['rows'],
                    'shared_blks_read': row['shared_blks_read'],
                    'shared_blks_hit': row['shared_blks_hit'],
                    'temp_blks_written': row['temp_blks_written'],
                    'wal_bytes': row['wal_bytes'],
                }
            )
    return cleaned


def normalize_query(query: str) -> str:
    compact = re.sub(r'\s+', ' ', query).strip()
    compact = re.sub(r"'(?:''|[^'])*'", '?', compact)
    compact = re.sub(r'\b\d+\b', '?', compact)
    return compact


def fingerprint(queryid: str, instance_id: int) -> str:
    return hashlib.sha256(f'{instance_id}:{queryid}'.encode()).hexdigest()
