from django.db import models
from django.conf import settings


class Issue(models.Model):
    PRIORITY_CHOICES = [('urgent','Urgent'),('high','High'),('normal','Normal'),('low','Low')]
    STATUS_CHOICES = [('open','Open'),('in-progress','In Progress'),('closed','Closed')]
    WORKFLOW_CHOICES = [('open','Open'),('in_progress','In Progress'),('resolved','Resolved')]
    SEVERITY_CHOICES = [('critical','Critical'),('moderate','Moderate'),('low','Low'),('','')]
    COMPLEXITY_CHOICES = [('quick-fix','Quick Fix'),('medium','Medium'),('complex','Complex'),('','')]
    TEAM_CHOICES = [('frontend','Frontend'),('backend','Backend'),('devops','DevOps'),('fullstack','Full Stack'),('','')]

    issue_id = models.IntegerField()
    title = models.CharField(max_length=500)
    description = models.TextField(blank=True, default='')
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='assigned_issues'
    )
    assignee_github_login = models.CharField(max_length=100, blank=True, null=True)
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='normal')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    workflow_status = models.CharField(max_length=20, choices=WORKFLOW_CHOICES, default='open')
    labels = models.JSONField(default=list, blank=True)
    github_url = models.URLField(blank=True, default='')
    closed_at = models.DateTimeField(null=True, blank=True)
    closed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='closed_issues'
    )
    synced_at = models.DateTimeField(auto_now=True)

    # AI Triage
    ai_triage = models.JSONField(null=True, blank=True)

    # Duplicate detection
    duplicate_of = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True, related_name='duplicates'
    )
    similar_issues = models.JSONField(default=list, blank=True)

    # Escalation
    escalated = models.BooleanField(default=False)
    escalated_at = models.DateTimeField(null=True, blank=True)
    escalation_reason = models.CharField(max_length=500, blank=True, default='')

    # Timing
    first_response_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolution_time_hours = models.FloatField(null=True, blank=True)

    # Groq classification
    team = models.ForeignKey(
        'users.Team', on_delete=models.SET_NULL, null=True, blank=True, related_name='issues'
    )
    repository = models.ForeignKey(
        'users.Repository', on_delete=models.CASCADE, null=True, blank=True, related_name='issues'
    )
    classified_team = models.CharField(max_length=20, choices=TEAM_CHOICES, blank=True, default='')
    severity = models.CharField(max_length=10, choices=SEVERITY_CHOICES, blank=True, default='')
    severity_reason = models.CharField(max_length=500, blank=True, default='')
    ai_explanation = models.TextField(blank=True, default='')
    is_urgent = models.BooleanField(default=False)
    suggested_action = models.CharField(max_length=500, blank=True, default='')
    estimated_complexity = models.CharField(max_length=20, choices=COMPLEXITY_CHOICES, blank=True, default='')

    # Resolution
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='resolved_issues'
    )
    opened_at = models.DateTimeField(auto_now_add=True)
    github_closed_at = models.DateTimeField(null=True, blank=True)   # timestamp from GitHub close event
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = ('issue_id', 'repository')
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['priority']),
            models.Index(fields=['assignee']),
            models.Index(fields=['classified_team']),
            models.Index(fields=['severity']),
        ]

    def __str__(self):
        return f'#{self.issue_id} {self.title}'


class IssueComment(models.Model):
    issue = models.ForeignKey(Issue, on_delete=models.CASCADE, related_name='comments')
    body = models.TextField()
    author = models.CharField(max_length=200, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']


class Reminder(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='reminders'
    )
    issue = models.ForeignKey(
        Issue, on_delete=models.CASCADE, related_name='reminders'
    )
    scheduled_time = models.DateTimeField()
    notify_email = models.BooleanField(default=False)
    notify_whatsapp = models.BooleanField(default=False)
    triggered = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['scheduled_time']

    def __str__(self):
        return f'Reminder for #{self.issue.issue_id} by {self.user.name} at {self.scheduled_time}'

