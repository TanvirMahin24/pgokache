import threading
import time
import logging
from django.conf import settings
from django.utils import timezone
from cryptography.fernet import InvalidToken
from .models import Instance, SetupState, Snapshot, QueryStat
from .crypto import decrypt_password
from .postgres import get_connection, collect_top_queries

logger = logging.getLogger(__name__)
_started = False


def _tick():
    while True:
        interval = max(settings.COLLECTOR_INTERVAL_SECONDS, 10)
        for state in SetupState.objects.filter(ready=True).select_related('instance'):
            try:
                _collect_instance(state.instance)
            except Exception as exc:
                logger.exception('collection failed for instance %s: %s', state.instance_id, exc)
            state.last_checked_at = timezone.now()
            state.save(update_fields=['last_checked_at'])
        time.sleep(interval)


def _collect_instance(instance: Instance):
    try:
        password = decrypt_password(bytes(instance.password_enc))
    except InvalidToken:
        logger.warning('collection skipped for instance %s: invalid credentials', instance.id)
        return
    conn = get_connection(instance, password)
    rows = collect_top_queries(conn)
    conn.close()

    snapshot = Snapshot.objects.create(instance=instance)
    QueryStat.objects.bulk_create([QueryStat(snapshot=snapshot, **row) for row in rows])


def start_scheduler():
    global _started
    if _started:
        return
    _started = True
    thread = threading.Thread(target=_tick, daemon=True)
    thread.start()
