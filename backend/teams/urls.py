from django.urls import path
from .views import InviteLinkView, SendInviteView, TeamMembersView, TeamStatsView
from users.views import TeamRepositoryView, JoinRepositoryView

urlpatterns = [
    path('invite-link', InviteLinkView.as_view()),
    path('send-invite', SendInviteView.as_view()),
    path('members', TeamMembersView.as_view()),
    path('stats', TeamStatsView.as_view()),
    path('repos/', TeamRepositoryView.as_view()),
    path('join-repo/', JoinRepositoryView.as_view()),
]
