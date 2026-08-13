from django.urls import path
from .views import AnalyticsView, TriggerEODView, TriggerStandupView, HealthDashboardView

urlpatterns = [
    path('analytics', AnalyticsView.as_view()),
    path('eod', TriggerEODView.as_view()),
    path('standup', TriggerStandupView.as_view()),
    path('health', HealthDashboardView.as_view()),
]
