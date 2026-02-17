from django.db import transaction
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Instance, SetupState, Snapshot, QueryStat, Recommendation
from .serializers import (
    InstanceSerializer,
    SetupStateSerializer,
    SnapshotSerializer,
    RecommendationSerializer,
)
from .crypto import decrypt_password
from .postgres import get_connection, check_setup, collect_top_queries


class InstanceViewSet(viewsets.ModelViewSet):
    queryset = Instance.objects.all().order_by('-created_at')
    serializer_class = InstanceSerializer

    @action(detail=True, methods=['post'])
    def check_setup(self, request, pk=None):
        instance = self.get_object()
        password = decrypt_password(bytes(instance.password_enc))
        conn = get_connection(instance, password)
        info = check_setup(conn)

        SetupState.objects.update_or_create(
            instance=instance,
            defaults={
                'pg_version_num': info['pg_version_num'],
                'preload_ok': info['preload_ok'],
                'ext_created': info['ext_created'],
                'ready': info['ready'],
            },
        )
        conn.close()
        return Response(info)

    @action(detail=True, methods=['post'])
    def collect(self, request, pk=None):
        instance = self.get_object()
        state = SetupState.objects.filter(instance=instance, ready=True).first()
        if not state:
            return Response({'detail': 'setup not ready'}, status=status.HTTP_409_CONFLICT)

        password = decrypt_password(bytes(instance.password_enc))
        conn = get_connection(instance, password)
        rows = collect_top_queries(conn)
        conn.close()

        with transaction.atomic():
            snapshot = Snapshot.objects.create(instance=instance)
            QueryStat.objects.bulk_create(
                [QueryStat(snapshot=snapshot, **row) for row in rows]
            )
        return Response({'snapshot_id': snapshot.id, 'rows': len(rows)})


class SetupStateViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = SetupState.objects.select_related('instance').all().order_by('-last_checked_at')
    serializer_class = SetupStateSerializer


class SnapshotViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Snapshot.objects.prefetch_related('query_stats').all().order_by('-captured_at')
    serializer_class = SnapshotSerializer


class RecommendationViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Recommendation.objects.all().order_by('-created_at')
    serializer_class = RecommendationSerializer
