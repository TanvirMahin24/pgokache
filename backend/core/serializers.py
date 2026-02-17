from rest_framework import serializers
from .models import Instance, SetupState, Snapshot, QueryStat, Recommendation
from .crypto import encrypt_password


class InstanceSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = Instance
        fields = [
            'id',
            'name',
            'host',
            'port',
            'dbname',
            'user',
            'password',
            'ssl_mode',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def create(self, validated_data):
        password = validated_data.pop('password')
        validated_data['password_enc'] = encrypt_password(password)
        return super().create(validated_data)


class SetupStateSerializer(serializers.ModelSerializer):
    class Meta:
        model = SetupState
        fields = '__all__'


class QueryStatSerializer(serializers.ModelSerializer):
    class Meta:
        model = QueryStat
        fields = '__all__'


class SnapshotSerializer(serializers.ModelSerializer):
    query_stats = QueryStatSerializer(many=True)

    class Meta:
        model = Snapshot
        fields = ['id', 'instance', 'captured_at', 'query_stats']


class RecommendationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Recommendation
        fields = '__all__'
