from rest_framework.routers import DefaultRouter
from .views import InstanceViewSet, SetupStateViewSet, SnapshotViewSet, RecommendationViewSet

router = DefaultRouter()
router.register('instances', InstanceViewSet)
router.register('setup-states', SetupStateViewSet)
router.register('snapshots', SnapshotViewSet)
router.register('recommendations', RecommendationViewSet)

urlpatterns = router.urls
