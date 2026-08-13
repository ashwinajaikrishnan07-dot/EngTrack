import threading
from django.conf import settings
from django.core.mail import EmailMessage
from services.email_service import can_email
from services.whatsapp_service import send_whatsapp

def format_duration(seconds):
    if seconds < 60:
        return f"{int(seconds)} seconds"
    minutes = int(seconds // 60)
    if minutes < 60:
        return f"{minutes} minutes"
    hours = int(minutes // 60)
    minutes = int(minutes % 60)
    if hours < 24:
        return f"{hours} hours {minutes} minutes"
    days = int(hours // 24)
    hours = int(hours % 24)
    return f"{days} days {hours} hours"

def build_email_body(template, issue, extra=None):
    if extra is None:
        extra = {}

    repo_name = issue.repository.name if issue.repository else 'Unknown Repo'
    number = issue.issue_id
    issue_title = issue.title
    severity = issue.severity.upper() if getattr(issue, 'severity', None) else (issue.priority.upper() if issue.priority else 'NORMAL')
    assignee_name = issue.assignee.name if issue.assignee else "Unassigned"
    
    opened_date = issue.opened_at or issue.created_at
    created_at = opened_date.strftime('%Y-%m-%d %H:%M') if opened_date else 'Unknown'
    
    github_issue_url = issue.github_url or 'N/A'
    app_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
    gitora_url = f"{app_url}/issues/{issue.id}"

    subject = ""
    body = ""

    if template == 'issue_raised':
        subject = f"[Gitora] New Issue #{number} raised in {repo_name}"
        short_description = (issue.description or '')[:150]
        if len(issue.description or '') > 150:
            short_description += "..."
        created_by = extra.get('created_by', 'Unknown')
        
        body = f"""ISSUE RAISED — {repo_name}

#{number} — {issue_title}

{short_description}

Severity: {severity}
Assigned to: {assignee_name}
Raised by: {created_by}
Raised on: {created_at}

🔗 VIEW ON GITHUB: {github_issue_url}
🔗 VIEW ON GITORA: {gitora_url}"""

    elif template == 'issue_closed':
        subject = f"[Gitora] Issue #{number} Closed in {repo_name}"
        closed_by_name = extra.get('closed_by_name', 'Unknown')
        
        closed_date = issue.closed_at or issue.resolved_at
        closed_at = closed_date.strftime('%Y-%m-%d %H:%M') if closed_date else 'Unknown'
        
        duration = "Unknown"
        if opened_date and closed_date:
            duration = format_duration((closed_date - opened_date).total_seconds())

        body = f"""ISSUE CLOSED — #{number}

{issue_title}

This issue has been closed by {closed_by_name}.
Opened on: {created_at}
Closed on: {closed_at}
Time to resolve: {duration}

🔗 VIEW ON GITHUB: {github_issue_url}
🔗 VIEW ON GITORA: {gitora_url}"""

    elif template == 'reminder':
        subject = f"[Gitora] REMINDER — Issue #{number} needs attention"
        body = f"""REMINDER

Issue #{number} has not been resolved yet:

{issue_title}
Severity: {severity}
Open since: {created_at}
Assigned to: {assignee_name}

Please resolve this issue as soon as possible.

🔗 VIEW ON GITHUB: {github_issue_url}
🔗 VIEW ON GITORA: {gitora_url}"""

    return subject, body

def send_notification_async(template, issue, trigger_user=None, extra=None):
    if extra is None:
        extra = {}
        
    recipients = set()
    team = issue.team
    
    if team and team.lead:
        recipients.add(team.lead)
    
    if issue.assignee:
        recipients.add(issue.assignee)
        
    if trigger_user and trigger_user in recipients:
        recipients.remove(trigger_user)
        
    if not recipients:
        return

    subject, body = build_email_body(template, issue, extra)

    def deliver():
        # Email
        emails = [u.email for u in recipients if u.email]
        if emails and can_email():
            try:
                msg = EmailMessage(
                    subject=subject,
                    body=body,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    to=emails
                )
                msg.send()
                print(f"[NotificationService] Email '{template}' sent to {emails}")
            except Exception as e:
                print(f"[NotificationService] Email delivery failed: {e}")

        # WhatsApp
        for u in recipients:
            if getattr(u, 'whatsapp_number', None):
                send_whatsapp(u.whatsapp_number, body)
                
    threading.Thread(target=deliver, daemon=True).start()
