import re
from rest_framework import serializers
from .models import User, Team, Repository


# ─── Phone number validator ───────────────────────────────────────────────────
def validate_phone(value):
    """
    Validates E.164 international phone format: +[country_code][number]
    Examples: +917904179377, +14155238886, +447911123456
    """
    if not value:
        return value
    # Must start with + followed by country code (1-3 digits) then number
    pattern = r'^\+[1-9]\d{6,14}$'
    if not re.match(pattern, value):
        raise serializers.ValidationError(
            'Phone number must be in international format: +[country code][number] '
            '(e.g. +917904179377 for India, +14155238886 for USA). '
            'Include the + and country code.'
        )
    return value


# ─── Password strength validator ─────────────────────────────────────────────
def validate_password_strength(value):
    if len(value) < 8:
        raise serializers.ValidationError('Password must be at least 8 characters.')
    if not re.search(r'[A-Z]', value):
        raise serializers.ValidationError('Password must contain at least one uppercase letter.')
    if not re.search(r'[a-z]', value):
        raise serializers.ValidationError('Password must contain at least one lowercase letter.')
    if not re.search(r'\d', value):
        raise serializers.ValidationError('Password must contain at least one number.')
    return value


class RepositorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Repository
        fields = ['id', 'name', 'invite_code', 'is_active', 'created_at']
        read_only_fields = ['id', 'invite_code', 'created_at']


class TeamSerializer(serializers.ModelSerializer):
    repositories = RepositorySerializer(many=True, read_only=True)
    github_pat = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = Team
        fields = ['id', 'name', 'github_pat', 'repositories', 'created_at']
        read_only_fields = ['id', 'created_at']


class UserSerializer(serializers.ModelSerializer):
    team = TeamSerializer(read_only=True)
    repositories = RepositorySerializer(many=True, read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'name', 'email', 'role', 'avatar', 'is_active',
            'team', 'repositories', 'whatsapp_number', 'role_tag', 'invite_code_used', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class RegisterLeadSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200, min_length=2)
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8, write_only=True)
    whatsapp_number = serializers.CharField(max_length=20, required=False, allow_blank=True)

    def validate_name(self, value):
        if not re.match(r'^[a-zA-Z\s\-\.]+$', value.strip()):
            raise serializers.ValidationError('Name can only contain letters, spaces, hyphens and dots.')
        return value.strip()

    def validate_password(self, value):
        return validate_password_strength(value)

    def validate_whatsapp_number(self, value):
        if value and not value.startswith('+'):
            cc = self.initial_data.get('country_code', '')
            value = cc + value
        return validate_phone(value)


class RegisterMemberSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200, min_length=2)
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8, write_only=True)
    whatsapp_number = serializers.CharField(max_length=20, required=False, allow_blank=True)
    role_tag = serializers.ChoiceField(
        choices=['frontend', 'backend', 'devops', 'fullstack', ''],
        required=False, allow_blank=True
    )
    invite_code = serializers.CharField(max_length=8, min_length=6)

    def validate_name(self, value):
        if not re.match(r'^[a-zA-Z\s\-\.]+$', value.strip()):
            raise serializers.ValidationError('Name can only contain letters, spaces, hyphens and dots.')
        return value.strip()

    def validate_password(self, value):
        return validate_password_strength(value)

    def validate_whatsapp_number(self, value):
        if value and not value.startswith('+'):
            cc = self.initial_data.get('country_code', '')
            value = cc + value
        return validate_phone(value)

    def validate_invite_code(self, value):
        return value.strip().upper()


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=1)


class UpdateUserSerializer(serializers.ModelSerializer):
    whatsapp_number = serializers.CharField(
        max_length=20, required=False, allow_blank=True
    )

    def validate_whatsapp_number(self, value):
        return validate_phone(value)

    class Meta:
        model = User
        fields = ['name', 'avatar', 'whatsapp_number', 'role_tag', 'role', 'is_active']
