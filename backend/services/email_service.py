from django.core.mail import send_mail, EmailMessage
from django.conf import settings
import threading


def can_email():
    return bool(settings.EMAIL_HOST_USER and settings.EMAIL_HOST_PASSWORD
                and settings.EMAIL_HOST_USER != 'your_email@gmail.com')


def send_new_issue_notification(issue, triggered_by):
    def _send():
        try:
            recipients = []
            # Add TL
            if issue.repository.team.lead and issue.repository.team.lead != triggered_by:
                recipients.append(issue.repository.team.lead.email)
            # Add assignee
            if issue.assignee and issue.assignee != triggered_by:
                recipients.append(issue.assignee.email)

            if not recipients:
                return

            subject = f"[Gitora] New Issue #{issue.issue_id} raised in {issue.repository.name}"
            body = f"""ISSUE RAISED — {issue.repository.name}

#{issue.issue_id} — {issue.title}

{(issue.description or '')[:150]}

Severity: {issue.severity}
Raised by: {triggered_by.name if triggered_by else 'Unknown'}

🔗 VIEW ON GITHUB: {issue.github_url or '#'}
🔗 VIEW ON GITORA: http://localhost:3000/issues/{issue.id}
"""
            send_mail(subject, body, settings.EMAIL_HOST_USER, recipients, fail_silently=True)
            print(f"[Email] New issue notification sent to {recipients}")
        except Exception as e:
            print(f"[Email] Failed to send new issue notification: {e}")

    threading.Thread(target=_send).start()


def send_issue_closed_notification(issue, closed_by):
    def _send():
        try:
            recipients = []
            if issue.repository.team.lead and issue.repository.team.lead != closed_by:
                recipients.append(issue.repository.team.lead.email)
            if issue.assignee and issue.assignee != closed_by:
                recipients.append(issue.assignee.email)

            if not recipients:
                return

            duration = ''
            if issue.created_at and issue.resolved_at:
                delta = issue.resolved_at - issue.created_at
                hours = int(delta.total_seconds() // 3600)
                minutes = int((delta.total_seconds() % 3600) // 60)
                duration = f"{hours}h {minutes}m" if hours else f"{minutes}m"

            subject = f"[Gitora] Issue #{issue.issue_id} Closed in {issue.repository.name}"
            body = f"""ISSUE CLOSED — #{issue.issue_id}

{issue.title}

Closed by: {closed_by.name if closed_by else 'Unknown'}
Opened on: {issue.created_at.strftime('%d %b %Y %H:%M') if issue.created_at else 'N/A'}
Closed on: {issue.resolved_at.strftime('%d %b %Y %H:%M') if issue.resolved_at else 'N/A'}
Time to resolve: {duration or 'N/A'}

🔗 VIEW ON GITHUB: {issue.github_url or '#'}
🔗 VIEW ON GITORA: http://localhost:3000/issues/{issue.id}
"""
            send_mail(subject, body, settings.EMAIL_HOST_USER, recipients, fail_silently=True)
            print(f"[Email] Closed issue notification sent to {recipients}")
        except Exception as e:
            print(f"[Email] Failed to send closed notification: {e}")

    threading.Thread(target=_send).start()


def send_eod_report(report, tl_email):
    if not can_email():
        return
    rows = ''.join(
        f'<tr><td style="padding:8px">#{i.issue_id}</td><td style="padding:8px">{i.title}</td>'
        f'<td style="padding:8px">{i.priority}</td>'
        f'<td style="padding:8px">{i.assignee.name if i.assignee else "Unassigned"}</td></tr>'
        for i in report['open_issues']
    )
    from datetime import date
    html = f"""<div style="font-family:Arial,sans-serif;max-width:700px">
<div style="background:#1e40af;padding:24px;border-radius:8px 8px 0 0">
<h1 style="color:#fff;margin:0">EOD Summary Report</h1>
<p style="color:#bfdbfe;margin:8px 0 0">{date.today().strftime('%A, %B %d, %Y')}</p></div>
<div style="background:#f9fafb;padding:24px;border:1px solid #e5e7eb">
<div style="display:flex;gap:16px;margin-bottom:24px">
<div style="flex:1;background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:16px;text-align:center">
<div style="font-size:32px;font-weight:bold;color:#3b82f6">{report['raised_today']}</div>
<div style="color:#6b7280;font-size:14px">Raised Today</div></div>
<div style="flex:1;background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:16px;text-align:center">
<div style="font-size:32px;font-weight:bold;color:#10b981">{report['closed_today']}</div>
<div style="color:#6b7280;font-size:14px">Closed Today</div></div>
<div style="flex:1;background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:16px;text-align:center">
<div style="font-size:32px;font-weight:bold;color:#f59e0b">{report['total_pending']}</div>
<div style="color:#6b7280;font-size:14px">Total Pending</div></div></div>
<h3 style="color:#111">Open Issues</h3>
<table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e5e7eb">
<tr style="background:#f3f4f6"><th style="padding:8px;text-align:left">#</th>
<th style="padding:8px;text-align:left">Title</th>
<th style="padding:8px;text-align:left">Priority</th>
<th style="padding:8px;text-align:left">Assignee</th></tr>
{rows or '<tr><td colspan="4" style="padding:16px;text-align:center;color:#6b7280">No open issues</td></tr>'}
</table></div></div>"""
    try:
        msg = EmailMessage(
            subject=f'[EOD Report] {date.today()} - {report["raised_today"]} raised, {report["closed_today"]} closed',
            body=html, from_email=settings.DEFAULT_FROM_EMAIL, to=[tl_email],
        )
        msg.content_subtype = 'html'
        msg.send()
        print(f'[Email] EOD report sent to {tl_email}')
    except Exception as e:
        print(f'[Email] EOD failed: {e}')


def send_escalation_email(escalated_issues, tl_email, manager_email=None):
    if not can_email():
        return
    rows = ''.join(
        f'<tr><td style="padding:8px">#{i["issue_id"]}</td>'
        f'<td style="padding:8px">{i["title"]}</td>'
        f'<td style="padding:8px;color:#dc2626">{i["reason"]}</td></tr>'
        for i in escalated_issues
    )
    html = f"""<div style="font-family:Arial,sans-serif;max-width:700px">
<div style="background:#dc2626;padding:20px;border-radius:8px 8px 0 0">
<h1 style="color:#fff;margin:0">Escalation Alert</h1></div>
<div style="background:#f9fafb;padding:24px;border:1px solid #e5e7eb;border-radius:0 0 8px 8px">
<table style="width:100%;border-collapse:collapse">
<tr style="background:#f3f4f6"><th style="padding:8px;text-align:left">#</th>
<th style="padding:8px;text-align:left">Title</th>
<th style="padding:8px;text-align:left">Reason</th></tr>
{rows}</table></div></div>"""
    recipients = [tl_email]
    if manager_email:
        recipients.append(manager_email)
    try:
        msg = EmailMessage(
            subject=f'[ESCALATION] {len(escalated_issues)} issue(s) need immediate attention',
            body=html, from_email=settings.DEFAULT_FROM_EMAIL, to=recipients,
        )
        msg.content_subtype = 'html'
        msg.send()
    except Exception as e:
        print(f'[Email] Escalation failed: {e}')


def send_standup_report(html_content, tl_email):
    if not can_email():
        return
    from datetime import date
    wrapper = f"""<div style="font-family:Arial,sans-serif;max-width:700px">
<div style="background:#1e40af;padding:20px;border-radius:8px 8px 0 0">
<h1 style="color:#fff;margin:0">AI Daily Standup Report</h1>
<p style="color:#bfdbfe;margin:6px 0 0">{date.today().strftime('%A, %B %d, %Y')}</p></div>
<div style="background:#f9fafb;padding:24px;border:1px solid #e5e7eb;border-radius:0 0 8px 8px">
{html_content}</div></div>"""
    try:
        msg = EmailMessage(
            subject=f'[AI Standup] {date.today()} Engineering Report',
            body=wrapper, from_email=settings.DEFAULT_FROM_EMAIL, to=[tl_email],
        )
        msg.content_subtype = 'html'
        msg.send()
    except Exception as e:
        print(f'[Email] Standup failed: {e}')


def send_invite_email(lead_name, team_name, invite_code, signup_url, recipient_email):
    if not can_email():
        return False
    message = f"""
Hi,

{lead_name} has invited you to join their team "{team_name}" on Gitora.

Use this invite code to register: {invite_code}

Register here: {signup_url}

The Gitora Team
    """
    try:
        from django.core.mail import send_mail
        send_mail(
            subject=f"You've been invited to join {team_name} on Gitora",
            message=message.strip(),
            from_email=settings.EMAIL_HOST_USER,
            recipient_list=[recipient_email],
            fail_silently=False,
        )
        print(f"[Email] Invite sent to {recipient_email}")
        return True
    except Exception as e:
        print(f'[Email] Invite to {recipient_email} failed: {e}')
        return False
