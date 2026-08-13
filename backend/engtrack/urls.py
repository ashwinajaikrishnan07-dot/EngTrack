from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('users.urls')),
    path('api/issues/', include('issues.urls')),
    path('api/team/', include('teams.urls')),
    path('api/reports/', include('reports.urls')),
    path('api/webhook/', include('webhooks.urls')),
    path('api/notifications/', include('users.notification_urls')),
]
