from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    RegisterLeadView, RegisterMemberView, LoginView,
    LogoutView, MeView, UserListView, UserDetailView, UpdateMeView, TeamRepositoryView,
    NotificationListView, NotificationReadView, NotificationReadAllView
)

urlpatterns = [
    path('register/lead', RegisterLeadView.as_view()),
    path('register/member', RegisterMemberView.as_view()),
    path('login', LoginView.as_view()),
    path('logout', LogoutView.as_view()),
    path('me', MeView.as_view()),
    path('refresh', TokenRefreshView.as_view()),
    path('users', UserListView.as_view()),
    path('users/me', UpdateMeView.as_view()),
    path('users/<int:pk>', UserDetailView.as_view()),
    path('team/repos/', TeamRepositoryView.as_view()),
]
