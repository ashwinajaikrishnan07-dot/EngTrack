from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, Team, Repository


@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    list_display = ['name', 'lead', 'github_pat', 'created_at']
    search_fields = ['name']


@admin.register(Repository)
class RepositoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'team', 'invite_code', 'is_active', 'created_at']
    search_fields = ['name', 'invite_code', 'team__name']


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ['email', 'name', 'role', 'role_tag', 'team', 'is_active']
    list_filter = ['role', 'role_tag', 'is_active']
    search_fields = ['email', 'name']
    ordering = ['-created_at']
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Personal', {'fields': ('name', 'avatar', 'whatsapp_number')}),
        ('Team', {'fields': ('role', 'role_tag', 'team', 'repositories', 'invite_code_used')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser')}),
    )
    add_fieldsets = (
        (None, {'classes': ('wide',), 'fields': ('email', 'name', 'password1', 'password2', 'role')}),
    )
