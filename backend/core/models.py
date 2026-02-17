from django.db import models


class Instance(models.Model):
    name = models.CharField(max_length=128)
    host = models.CharField(max_length=255)
    port = models.PositiveIntegerField(default=5432)
    dbname = models.CharField(max_length=128)
    user = models.CharField(max_length=128)
    password_enc = models.BinaryField()
    ssl_mode = models.CharField(max_length=32, default='prefer')
    created_at = models.DateTimeField(auto_now_add=True)


class SetupState(models.Model):
    instance = models.OneToOneField(Instance, on_delete=models.CASCADE)
    pg_version_num = models.IntegerField(null=True)
    preload_ok = models.BooleanField(default=False)
    ext_created = models.BooleanField(default=False)
    ready = models.BooleanField(default=False)
    last_checked_at = models.DateTimeField(auto_now=True)


class Snapshot(models.Model):
    instance = models.ForeignKey(Instance, on_delete=models.CASCADE)
    captured_at = models.DateTimeField(auto_now_add=True)


class QueryStat(models.Model):
    snapshot = models.ForeignKey(Snapshot, on_delete=models.CASCADE, related_name='query_stats')
    queryid = models.CharField(max_length=128)
    query_norm = models.TextField()
    calls = models.BigIntegerField(default=0)
    total_time_ms = models.FloatField(default=0)
    mean_time_ms = models.FloatField(default=0)
    rows = models.BigIntegerField(default=0)
    shared_blks_read = models.BigIntegerField(default=0)
    shared_blks_hit = models.BigIntegerField(default=0)
    temp_blks_written = models.BigIntegerField(default=0)
    wal_bytes = models.BigIntegerField(default=0)


class QueryAnalysis(models.Model):
    queryid = models.CharField(max_length=128)
    instance = models.ForeignKey(Instance, on_delete=models.CASCADE)
    last_explained_at = models.DateTimeField(auto_now=True)
    explain_json = models.JSONField()
    features_json = models.JSONField()

    class Meta:
        unique_together = ('queryid', 'instance')


class Recommendation(models.Model):
    instance = models.ForeignKey(Instance, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    type = models.CharField(max_length=64)
    title = models.CharField(max_length=255)
    details = models.TextField()
    sql = models.TextField(blank=True)
    confidence = models.CharField(max_length=16)
    score = models.FloatField(default=0)
    fingerprint = models.CharField(max_length=128)
    status = models.CharField(max_length=32, default='open')
