import hashlib
from typing import Iterable

from .models import Recommendation, Snapshot, QueryStat, Instance
from .postgres import fingerprint


def _upsert(instance: Instance, fingerprint_value: str, **fields):
    Recommendation.objects.update_or_create(
        instance=instance,
        fingerprint=fingerprint_value,
        defaults=fields,
    )


def _is_select(query_norm: str) -> bool:
    if not query_norm:
        return False
    return query_norm.lstrip().lower().startswith('select')


def _read_replica_fingerprint(instance_id: int) -> str:
    return hashlib.sha256(f'{instance_id}:read_replica'.encode()).hexdigest()


def _index_candidates(stats: Iterable[QueryStat]):
    for stat in stats:
        if not _is_select(stat.query_norm):
            continue
        if stat.calls < 25:
            continue
        if stat.mean_time_ms < 50:
            continue
        yield stat


def generate_recommendations(snapshot: Snapshot):
    stats = list(snapshot.query_stats.all())
    if not stats:
        return

    total_time = sum(stat.total_time_ms for stat in stats)
    select_time = sum(stat.total_time_ms for stat in stats if _is_select(stat.query_norm))
    select_ratio = select_time / total_time if total_time > 0 else 0

    if total_time >= 10_000 and select_ratio >= 0.8:
        _upsert(
            snapshot.instance,
            _read_replica_fingerprint(snapshot.instance_id),
            type='read_replica',
            title='Read-heavy workload detected',
            details=(
                f'{select_ratio:.0%} of total query time comes from SELECT statements. '
                'A read replica can absorb reporting/analytics workloads.'
            ),
            sql='',
            confidence='medium',
            score=round(select_ratio * 100, 1),
            status='open',
        )

    top_stats = sorted(stats, key=lambda row: row.total_time_ms, reverse=True)[:5]
    for stat in _index_candidates(top_stats):
        _upsert(
            snapshot.instance,
            fingerprint(stat.queryid, snapshot.instance_id),
            type='index',
            title=f'Index opportunity for query {stat.queryid}',
            details=(
                f'Mean time {stat.mean_time_ms:.1f} ms across {stat.calls} calls. '
                'Consider EXPLAIN (ANALYZE, BUFFERS) and indexing filter/join columns.'
            ),
            sql='',
            confidence='medium' if stat.mean_time_ms >= 100 else 'low',
            score=min(100, round((stat.total_time_ms / total_time) * 100, 1) if total_time > 0 else 0),
            status='open',
        )
