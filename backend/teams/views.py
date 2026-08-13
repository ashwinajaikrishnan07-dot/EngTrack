from rest_framework.views import APIView
from rest_framework.response import Response
from django.utils import timezone as tz
from users.models import User, Team
from issues.models import Issue
from services.email_service import send_invite_email
from django.conf import settings


class InviteLinkView(APIView):
    def get(self, request):
        if not request.user.is_lead:
            return Response({'message': 'Team Lead access required'}, status=403)
        team = request.user.team
        if not team:
            return Response({'message': 'Team not found'}, status=404)
        repository_id = request.query_params.get('repository')
        if repository_id:
            repository = team.repositories.filter(id=repository_id).first()
        else:
            repository = team.repositories.first()
            
        if not repository:
            return Response({'message': 'No repository found for this team'}, status=404)
            
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        signup_url = f'{frontend_url}/register/member?invite={repository.invite_code}'
        return Response({'inviteCode': repository.invite_code, 'signupUrl': signup_url, 'teamName': team.name})


class SendInviteView(APIView):
    def post(self, request):
        if not request.user.is_lead:
            return Response({'message': 'Team Lead access required'}, status=403)
        team = request.user.team
        if not team:
            return Response({'message': 'Team not found'}, status=404)

        emails = request.data.get('emails', [])
        if not isinstance(emails, list) or not emails:
            return Response({'message': 'emails array is required'}, status=400)

        repository_id = request.data.get('repository')
        if repository_id:
            repository = team.repositories.filter(id=repository_id).first()
        else:
            repository = team.repositories.first()
            
        if not repository:
            return Response({'message': 'No repository found for this team'}, status=404)

        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        signup_url = f'{frontend_url}/register/member?invite={repository.invite_code}'

        sent, failed = 0, []
        for email in emails:
            ok = send_invite_email(request.user.name, repository.name, repository.invite_code, signup_url, email)
            if ok:
                sent += 1
            else:
                failed.append(email)

        return Response({
            'message': f'Invites sent: {sent} of {len(emails)}',
            'emailsSent': sent, 'failed': failed,
            'inviteCode': repository.invite_code, 'signupUrl': signup_url,
        })


class TeamMembersView(APIView):
    def get(self, request):
        if not request.user.team:
            # Let's fallback to returning the user themselves even if they aren't fully in a team yet,
            # or return an error if no team is set.
            # Fallback for registration sandbox:
            if not request.user.is_lead:
                members = User.objects.filter(pk=request.user.pk)
            else:
                members = User.objects.filter(is_active=True)
        else:
            if request.user.is_lead:
                members = User.objects.filter(team=request.user.team, is_active=True)
            else:
                members = User.objects.filter(pk=request.user.pk)

        result = []
        for m in members:
            total = Issue.objects.filter(assignee=m).count()
            resolved = Issue.objects.filter(resolved_by=m, workflow_status='resolved').count()
            in_progress = Issue.objects.filter(assignee=m, workflow_status='in_progress').count()
            open_count = Issue.objects.filter(assignee=m, workflow_status='open').count()
            
            # fallback/sync check: if open_count + resolved + in_progress is different from total
            if open_count + resolved + in_progress != total:
                # normalize open count
                open_count = max(0, total - resolved - in_progress)

            resolved_issues = Issue.objects.filter(
                resolved_by=m, workflow_status='resolved',
                resolved_at__isnull=False, opened_at__isnull=False
            )
            avg_hours = None
            if resolved_issues.exists():
                total_secs = sum(
                    (i.resolved_at - i.opened_at).total_seconds()
                    for i in resolved_issues if i.resolved_at and i.opened_at
                )
                avg_hours = round(total_secs / resolved_issues.count() / 3600, 1)

            # last active (most recent resolved_at or fallback to updated_at of assigned issues)
            m_last_resolved = Issue.objects.filter(resolved_by=m, workflow_status='resolved', resolved_at__isnull=False).order_by('-resolved_at').first()
            last_active = m_last_resolved.resolved_at.strftime('%Y-%m-%d %H:%M') if m_last_resolved and m_last_resolved.resolved_at else None
            
            # last 3 issues
            last_3 = Issue.objects.filter(assignee=m).order_by('-created_at')[:3]
            last_issues_data = []
            for i in last_3:
                last_issues_data.append({
                    'issue_id': i.issue_id,
                    'title': i.title,
                    'workflow_status': i.workflow_status,
                    'status': i.status,
                    'severity': i.severity or 'moderate'
                })

            result.append({
                'id': m.id, 'name': m.name, 'email': m.email,
                'role': m.role, 'role_tag': m.role_tag,
                'whatsapp_number': m.whatsapp_number,
                'created_at': m.created_at,
                'stats': {
                    'totalAssigned': total,
                    'resolved': resolved,
                    'inProgress': in_progress,
                    'open': open_count,
                    'avgResolutionHours': avg_hours,
                    'lastActive': last_active,
                    'lastIssues': last_issues_data
                },
            })
        return Response({'members': result, 'total': len(result)})



class TeamStatsView(APIView):
    def get(self, request):
        import datetime
        three_days_ago = tz.now() - datetime.timedelta(days=3)

        # Show ALL issues in the workspace (GitHub synced issues have no team)
        # Filter by team only if the user has one AND there are team-specific issues
        team = request.user.team
        base_filter = {}
        repository_id = request.query_params.get('repository')
        if repository_id:
            base_filter['repository_id'] = repository_id
        elif team and Issue.objects.filter(team=team).exists():
            base_filter['team'] = team

        total = Issue.objects.filter(**base_filter).count()
        by_severity = {
            'critical': Issue.objects.filter(**base_filter, severity='critical').count(),
            'moderate': Issue.objects.filter(**base_filter, severity='moderate').count(),
            'low':      Issue.objects.filter(**base_filter, severity='low').count(),
        }
        by_status = {
            'open':        Issue.objects.filter(**base_filter, workflow_status='open').count(),
            'in_progress': Issue.objects.filter(**base_filter, workflow_status='in_progress').count(),
            'resolved':    Issue.objects.filter(**base_filter, workflow_status='resolved').count(),
        }

        # Also count by legacy status field for issues synced from GitHub
        by_status['open']     += Issue.objects.filter(**base_filter, status='open').exclude(workflow_status='open').count()
        by_status['resolved'] += Issue.objects.filter(**base_filter, status='closed').exclude(workflow_status='resolved').count()

        unresolved = Issue.objects.filter(
            **base_filter,
            workflow_status__in=['open', 'in_progress'],
            opened_at__lte=three_days_ago,
        ).select_related('assignee')

        alerts = [{
            'issueId': i.issue_id, 'title': i.title,
            'openedAt': i.opened_at, 'workflowStatus': i.workflow_status,
            'severity': i.severity,
            'assignee': i.assignee.name if i.assignee else 'Unassigned',
            'daysOpen': (tz.now() - i.opened_at).days if i.opened_at else 0,
        } for i in unresolved]

        members = User.objects.filter(is_active=True) if not team else User.objects.filter(team=team, is_active=True)
        member_stats = []
        for m in members:
            resolved_issues = Issue.objects.filter(
                **base_filter,
                resolved_by=m, workflow_status='resolved',
                resolved_at__isnull=False, opened_at__isnull=False
            )
            count = resolved_issues.count()
            avg = None
            if count:
                total_secs = sum(
                    (i.resolved_at - i.opened_at).total_seconds()
                    for i in resolved_issues if i.resolved_at and i.opened_at
                )
                avg = round(total_secs / count / 3600, 2)
            member_stats.append({'id': m.id, 'name': m.name, 'issuesResolved': count, 'avgResolutionTime': avg})

        return Response({
            'totalIssues': total,
            'bySeverity': by_severity,
            'byStatus': by_status,
            'memberStats': member_stats,
            'unresolvedAlerts': alerts,
        })
