from django.urls import path
from .views import GithubWebhookView

urlpatterns = [
    path('github', GithubWebhookView.as_view()),
]
