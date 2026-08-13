from django.urls import path
from .views import (
    IssueListCreateView, IssueDetailView, IssueStatsView,
    IssueSyncView, IssueRetriegeView, IssueWorkflowStatusView,
    IssueBatchClassifyView, ReminderListCreateView, ReminderDeleteView,
    AIChatView, AnalyticsView, CreateIssueView
)

urlpatterns = [
    path('', IssueListCreateView.as_view()),
    path('create/', CreateIssueView.as_view()),
    path('stats', IssueStatsView.as_view()),
    path('sync', IssueSyncView.as_view()),
    path('classify-all', IssueBatchClassifyView.as_view()),
    path('reminders', ReminderListCreateView.as_view()),
    path('reminders/<int:pk>', ReminderDeleteView.as_view()),
    path('chat', AIChatView.as_view()),
    path('analytics', AnalyticsView.as_view()),
    path('<int:pk>', IssueDetailView.as_view()),
    path('<int:pk>/retriage', IssueRetriegeView.as_view()),
    path('<int:pk>/status', IssueWorkflowStatusView.as_view()),
]

