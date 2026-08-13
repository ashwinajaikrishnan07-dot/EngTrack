import threading
from django.conf import settings
from django.core.mail import send_mail
from users.models import Notification
from users.models import Notification
from issues.utils import send_notification_async

def trigger_notification(issue, event_type, triggered_by_user):
    """
    Triggers DB, Email, and WhatsApp notifications asynchronously.
    """
    team = issue.team
    if not team:
        return

    recipients = set()

    if event_type == 'created':
        if team.lead and team.lead != triggered_by_user:
            recipients.add(team.lead)
        if issue.repository:
            for member in issue.repository.users.all():
                if member != triggered_by_user:
                    recipients.add(member)
        repo_name = issue.repository.name if issue.repository else 'Unknown Repo'
        severity = issue.severity if issue.severity else (issue.priority if issue.priority else 'normal')
        message = f"[{repo_name}] — New issue #{issue.issue_id}: {issue.title} ({severity.upper()})"

    elif event_type == 'closed':
        if team.lead and team.lead != triggered_by_user:
            recipients.add(team.lead)
        if issue.assignee and issue.assignee != triggered_by_user:
            recipients.add(issue.assignee)
        repo_name = issue.repository.name if issue.repository else 'Unknown Repo'
        message = f"[{repo_name}] — Issue #{issue.issue_id} closed: {issue.title}"

    else:
        return

    if not recipients:
        return

    # 1. Create DB Notifications (synchronous so frontend can poll them immediately)
    for user in recipients:
        Notification.objects.create(
            user=user,
            issue=issue,
            message=message
        )

    # 2. Async delivery (Email and WhatsApp)
    if event_type == 'created':
        extra = {'created_by': triggered_by_user.name if triggered_by_user else 'Unknown'}
        send_notification_async('issue_raised', issue, triggered_by_user, extra)
    elif event_type == 'closed':
        extra = {'closed_by_name': triggered_by_user.name if triggered_by_user else 'Unknown'}
        send_notification_async('issue_closed', issue, triggered_by_user, extra)
