from django.contrib import admin
from .models import Instance, SetupState, Snapshot, QueryStat, QueryAnalysis, Recommendation

admin.site.register(Instance)
admin.site.register(SetupState)
admin.site.register(Snapshot)
admin.site.register(QueryStat)
admin.site.register(QueryAnalysis)
admin.site.register(Recommendation)
