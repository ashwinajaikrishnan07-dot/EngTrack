import threading
from django.conf import settings


def _can_send():
    sid = getattr(settings, 'TWILIO_ACCOUNT_SID', '')
    token = getattr(settings, 'TWILIO_AUTH_TOKEN', '')
    return bool(sid and token and sid != 'your_twilio_account_sid')


def send_whatsapp(to, body):
    if not _can_send() or not to:
        print(f'[WhatsApp] Not configured or no number — skipping')
        return
    try:
        from twilio.rest import Client
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        phone = to if to.startswith('+') else f'+{to}'
        client.messages.create(
            from_=f'whatsapp:{settings.TWILIO_WHATSAPP_FROM}',
            to=f'whatsapp:{phone}',
            body=body,
        )
        print(f'[WhatsApp] Sent to {phone}')
    except Exception as e:
        print(f'[WhatsApp] Failed to {to}: {e}')



def notify_new_issue(issue, triggered_by):
    def _send():
        recipients = []
        if issue.repository.team.lead and issue.repository.team.lead != triggered_by:
            if issue.repository.team.lead.whatsapp_number:
                recipients.append(issue.repository.team.lead.whatsapp_number)
        if issue.assignee and issue.assignee != triggered_by:
            if issue.assignee.whatsapp_number:
                recipients.append(issue.assignee.whatsapp_number)

        message = (
            f"ISSUE RAISED — {issue.repository.name}\n"
            f"#{issue.issue_id} — {issue.title}\n"
            f"Severity: {issue.severity}\n"
            f"VIEW ON GITHUB: {issue.github_url or 'N/A'}\n"
            f"VIEW ON GITORA: http://localhost:3000/issues/{issue.id}"
        )
        for phone in recipients:
            send_whatsapp(phone, message)

    threading.Thread(target=_send).start()


def notify_issue_resolved(issue, closed_by):
    def _send():
        recipients = []
        if issue.repository.team.lead and issue.repository.team.lead != closed_by:
            if issue.repository.team.lead.whatsapp_number:
                recipients.append(issue.repository.team.lead.whatsapp_number)
        if issue.assignee and issue.assignee != closed_by:
            if issue.assignee.whatsapp_number:
                recipients.append(issue.assignee.whatsapp_number)

        message = (
            f"ISSUE CLOSED — #{issue.issue_id}\n"
            f"{issue.title}\n"
            f"Closed by: {closed_by.name if closed_by else 'Unknown'}\n"
            f"VIEW ON GITHUB: {issue.github_url or 'N/A'}\n"
            f"VIEW ON GITORA: http://localhost:3000/issues/{issue.id}"
        )
        for phone in recipients:
            send_whatsapp(phone, message)

    threading.Thread(target=_send).start()


def notify_critical_issue(issue, triggered_by):
    def _send():
        recipients = []
        if issue.repository.team.lead and issue.repository.team.lead != triggered_by:
            if issue.repository.team.lead.whatsapp_number:
                recipients.append(issue.repository.team.lead.whatsapp_number)

        message = (
            f"⚠️ CRITICAL ISSUE — {issue.repository.name}\n"
            f"#{issue.issue_id} — {issue.title}\n"
            f"Severity: {issue.severity}\n"
            f"VIEW ON GITHUB: {issue.github_url or 'N/A'}\n"
            f"VIEW ON GITORA: http://localhost:3000/issues/{issue.id}"
        )
        for phone in recipients:
            send_whatsapp(phone, message)

    threading.Thread(target=_send).start()
