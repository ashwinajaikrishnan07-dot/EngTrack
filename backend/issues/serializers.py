from rest_framework import serializers
from .models import Issue, IssueComment, Reminder
from users.serializers import UserSerializer
from users.models import User as UserModel


class IssueCommentSerializer(serializers.ModelSerializer):
    class Meta:
        model = IssueComment
        fields = ['id', 'body', 'author', 'created_at']
        read_only_fields = ['id', 'created_at']


class IssueSerializer(serializers.ModelSerializer):
    assignee = UserSerializer(read_only=True)
    assignee_id = serializers.PrimaryKeyRelatedField(
        source='assignee', queryset=UserModel.objects.all(),
        required=False, allow_null=True, write_only=True
    )
    closed_by = UserSerializer(read_only=True)
    resolved_by = UserSerializer(read_only=True)
    comments = IssueCommentSerializer(many=True, read_only=True)

    class Meta:
        model = Issue
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at', 'opened_at', 'synced_at']


class IssueListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views."""
    assignee = UserSerializer(read_only=True)
    closed_by = UserSerializer(read_only=True)
    resolved_by = UserSerializer(read_only=True)

    class Meta:
        model = Issue
        fields = [
            'id', 'issue_id', 'title', 'description', 'priority', 'status',
            'workflow_status', 'labels', 'github_url', 'assignee',
            'classified_team', 'severity', 'severity_reason',
            'ai_explanation', 'suggested_action', 'estimated_complexity',
            'is_urgent', 'escalated', 'ai_triage',
            'opened_at', 'created_at', 'resolved_at', 'closed_at',
            'resolution_time_hours', 'closed_by', 'resolved_by',
        ]


class CreateIssueSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=500)
    description = serializers.CharField(required=False, allow_blank=True, default='')
    priority = serializers.ChoiceField(
        choices=['urgent', 'high', 'normal', 'low'], default='normal'
    )
    assignee_id = serializers.IntegerField(required=False, allow_null=True)
    repository_id = serializers.IntegerField(required=False, allow_null=True)
    labels = serializers.ListField(
        child=serializers.CharField(), required=False, default=list
    )


class UpdateIssueSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=500, required=False)
    description = serializers.CharField(required=False, allow_blank=True)
    priority = serializers.ChoiceField(
        choices=['urgent', 'high', 'normal', 'low'], required=False
    )
    status = serializers.ChoiceField(
        choices=['open', 'in-progress', 'closed'], required=False
    )
    assignee_id = serializers.IntegerField(required=False, allow_null=True)
    labels = serializers.ListField(child=serializers.CharField(), required=False)


class WorkflowStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=['open', 'in_progress', 'resolved'])


class ReminderSerializer(serializers.ModelSerializer):
    issue = IssueListSerializer(read_only=True)
    issue_id_input = serializers.IntegerField(write_only=True)

    class Meta:
        model = Reminder
        fields = [
            'id', 'issue', 'issue_id_input', 'scheduled_time',
            'notify_email', 'notify_whatsapp', 'triggered', 'created_at'
        ]
        read_only_fields = ['id', 'triggered', 'created_at']

    def create(self, validated_data):
        user = self.context['request'].user
        issue_id_val = validated_data.pop('issue_id_input')
        try:
            issue = Issue.objects.get(issue_id=issue_id_val)
        except Issue.DoesNotExist:
            raise serializers.ValidationError({'issue_id_input': f"Issue with number #{issue_id_val} does not exist."})
        
        # Check if user has access to issue or if it's open (it's open for all relevant user requests)
        reminder = Reminder.objects.create(user=user, issue=issue, **validated_data)
        return reminder

