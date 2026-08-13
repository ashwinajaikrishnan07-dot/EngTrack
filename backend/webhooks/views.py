import hmac
import hashlib
import json
import threading
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.conf import settings
from django.utils import timezone as tz
from issues.models import Issue
from users.models import User
from services.github_service import get_priority_from_labels
from issues.utils import send_notification_async
from services.ai_service import classify_issue_with_groq


class GithubWebhookView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        # Verify signature
        secret = getattr(settings, 'GITHUB_WEBHOOK_SECRET', '')
        if secret:
            sig = request.headers.get('X-Hub-Signature-256', '')
            if not sig:
                return Response({'message': 'No signature'}, status=401)
            body = request.body
            digest = 'sha256=' + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
            if not hmac.compare_digest(sig, digest):
                return Response({'message': 'Invalid signature'}, status=401)

        event = request.headers.get('X-Github-Event', '')
        payload = request.data

        if event == 'issues':
            action = payload.get('action')
            issue_data = payload.get('issue', {})
            self._handle_issue_event(action, issue_data)

        return Response({'received': True})

    def _handle_issue_event(self, action, issue_data):
        labels = issue_data.get('labels', [])
        priority = get_priority_from_labels(labels)
        label_names = [l['name'] for l in labels]

        if action == 'opened':
            if Issue.objects.filter(issue_id=issue_data['number']).exists():
                return

            classified_team = ''
            severity = ''
            is_urgent = False
            severity_reason = ''
            suggested_action = ''
            estimated_complexity = ''
            ai_explanation = ''

            try:
                classification = classify_issue_with_groq(issue_data['title'], issue_data.get('body') or '')
                classified_team = classification.get('team', '')
                severity = classification.get('severity', '')
                is_urgent = classification.get('is_urgent', False)
                severity_reason = classification.get('severity_reason', '')
                suggested_action = classification.get('suggested_action', '')
                estimated_complexity = classification.get('estimated_complexity', '')
                ai_explanation = classification.get('ai_explanation', '')
            except Exception as e:
                print(f'[Webhook] Immediate classification error: {e}')

            issue = Issue.objects.create(
                issue_id=issue_data['number'],
                title=issue_data['title'],
                description=issue_data.get('body') or '',
                priority=priority,
                status='open',
                workflow_status='open',
                labels=label_names,
                github_url=issue_data['html_url'],
                assignee_github_login=issue_data['assignee']['login'] if issue_data.get('assignee') else None,
                classified_team=classified_team,
                severity=severity,
                is_urgent=is_urgent,
                severity_reason=severity_reason,
                suggested_action=suggested_action,
                estimated_complexity=estimated_complexity,
                ai_explanation=ai_explanation,
            )

            # Async: notify using the standardized template system
            send_notification_async('issue_raised', issue)

        elif action == 'closed':
            from django.utils.dateparse import parse_datetime
            closed_at = parse_datetime(issue_data['closed_at']) if issue_data.get('closed_at') else tz.now()
            Issue.objects.filter(issue_id=issue_data['number']).update(
                status='closed', workflow_status='resolved',
                closed_at=closed_at, resolved_at=closed_at,
                github_closed_at=closed_at,   # track GitHub-side close separately
            )

        elif action == 'reopened':
            Issue.objects.filter(issue_id=issue_data['number']).update(
                status='open', workflow_status='open',
                closed_at=None, resolved_at=None,
                github_closed_at=None,
                resolved_by=None,             # clear resolver on reopen
            )

        elif action == 'edited':
            Issue.objects.filter(issue_id=issue_data['number']).update(
                title=issue_data['title'],
                description=issue_data.get('body') or '',
            )

        elif action in ('labeled', 'unlabeled'):
            new_labels = [l['name'] for l in issue_data.get('labels', [])]
            new_priority = get_priority_from_labels(issue_data.get('labels', []))
            Issue.objects.filter(issue_id=issue_data['number']).update(
                labels=new_labels, priority=new_priority,
            )
