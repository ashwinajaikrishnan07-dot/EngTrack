import threading
from datetime import datetime, timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from django.db.models import Q
from django.utils import timezone as tz
from .models import Issue, IssueComment, Reminder
from .serializers import (
    IssueSerializer, IssueListSerializer, CreateIssueSerializer,
    UpdateIssueSerializer, WorkflowStatusSerializer, ReminderSerializer
)
from users.models import User
from services.github_service import (
    create_github_issue, close_github_issue, reopen_github_issue,
    fetch_github_issues, get_priority_from_labels
)
from services.email_service import send_new_issue_notification, send_issue_closed_notification
from services.whatsapp_service import notify_new_issue, notify_issue_resolved, notify_critical_issue
from services.ai_service import triage_issue_with_claude, classify_issue_with_groq
from django.conf import settings


class IssuePagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'limit'
    max_page_size = 100

class CreateIssueView(APIView):
    def post(self, request):
        import traceback
        try:
            print("REQUEST DATA:", request.data)
            team = request.user.team
            if not team or not team.github_pat:
                return Response({'message': 'No GitHub PAT configured for this team'}, status=400)
                
            data = request.data
            title = data.get('title')
            if not title:
                return Response({'message': 'Title is required'}, status=400)

            repo_input = data.get('repository') or data.get('repository_id')
            if not repo_input:
                return Response({'message': 'Repository is required'}, status=400)

            owner_repo = None
            repository = None

            if isinstance(repo_input, int) or (isinstance(repo_input, str) and repo_input.isdigit()):
                try:
                    repository = team.repositories.get(id=int(repo_input))
                except Exception:
                    return Response({'message': 'Repository not found'}, status=404)
                owner_repo = repository.name
            else:
                owner_repo = str(repo_input)
                try:
                    repository = team.repositories.get(name=owner_repo)
                except Exception:
                    return Response({'message': 'Repository not found'}, status=404)

            if '/' not in owner_repo:
                return Response({'message': 'Invalid repository format. Expected owner/repo.'}, status=400)

            try:
                gh_labels = data.get('labels', [])
                if isinstance(gh_labels, str):
                    gh_labels = [gh_labels]
                priority = data.get('priority', 'normal')
                if priority and priority != 'normal':
                    gh_labels.append(priority)
                
                github_data = create_github_issue(
                    owner_repo, title, data.get('description', ''), gh_labels, token=team.github_pat
                )
            except Exception as e:
                err_msg = str(e)
                if hasattr(e, 'response') and e.response is not None:
                    print(f"[GitHub API Error] Status: {e.response.status_code}")
                    print(f"[GitHub API Error] Body: {e.response.text}")
                    
                    if e.response.status_code == 404:
                        return Response({'message': 'Repository not found or PAT has no access'}, status=400)
                    if e.response.status_code == 422:
                        return Response({'message': 'Invalid issue data'}, status=400)
                    
                    try:
                        err_msg = e.response.json().get('message', err_msg)
                    except Exception:
                        err_msg = e.response.text
                else:
                    print(f"[GitHub API Error] {e}")

                return Response({'message': f'GitHub API Error: {err_msg}'}, status=400)

            assignee = None
            assignee_id = data.get('assignee_id') or data.get('assignee')
            if assignee_id:
                try:
                    assignee = User.objects.get(pk=int(assignee_id))
                except (User.DoesNotExist, ValueError, TypeError):
                    pass

            classified_team, severity, is_urgent = '', priority, priority == 'urgent'
            try:
                result = classify_issue_with_groq(title, data.get('description', '') or '')
                classified_team = result.get('team', '')
                severity = result.get('severity', severity)
                is_urgent = result.get('is_urgent', is_urgent)
            except Exception:
                pass

            issue = Issue.objects.create(
                team=team,
                repository=repository,
                issue_id=github_data['number'],
                title=title,
                description=data.get('description', ''),
                priority=priority,
                assignee=assignee,
                labels=gh_labels,
                github_url=github_data['html_url'],
                status='open',
                workflow_status='open',
                classified_team=classified_team,
                severity=severity,
                is_urgent=is_urgent,
            )

            from services.notification_service import trigger_notification
            trigger_notification(issue, 'created', request.user)

            return Response(IssueListSerializer(issue).data)
        except Exception as e:
            traceback.print_exc()
            return Response({'message': str(e)}, status=500)


class IssueListCreateView(APIView):
    def get(self, request):
        qs = Issue.objects.select_related('assignee', 'closed_by', 'resolved_by')

        status_filter = request.query_params.get('status')
        priority = request.query_params.get('priority')
        assignee_id = request.query_params.get('assignee')
        search = request.query_params.get('search')
        classified_team = request.query_params.get('classifiedTeam') or request.query_params.get('classified_team')

        if status_filter:
            if status_filter in ['closed', 'resolved']:
                qs = qs.filter(Q(status='closed') | Q(workflow_status='resolved') | Q(status='resolved') | Q(workflow_status='closed'))
            else:
                qs = qs.filter(Q(status=status_filter) | Q(workflow_status=status_filter))
        if priority:
            qs = qs.filter(priority=priority)
        if assignee_id:
            qs = qs.filter(assignee_id=assignee_id)
        if search:
            qs = qs.filter(Q(title__icontains=search) | Q(description__icontains=search))
        if classified_team:
            qs = qs.filter(classified_team=classified_team)
            
        repository_id = request.query_params.get('repository')
        if repository_id:
            qs = qs.filter(repository_id=repository_id)
        elif request.user.is_lead:
            qs = qs.filter(repository__in=request.user.team.repositories.all() if request.user.team else [])
        else:
            qs = qs.filter(repository__in=request.user.repositories.all())

        paginator = IssuePagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = IssueListSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    def post(self, request):
        s = CreateIssueSerializer(data=request.data)
        if not s.is_valid():
            return Response(s.errors, status=400)
        d = s.validated_data

        # Create on GitHub first
        owner_repo = None
        repository = None
        if d.get('repository_id'):
            from users.models import Repository
            repository = Repository.objects.filter(id=d['repository_id']).first()
            if repository:
                owner_repo = repository.name
        elif request.user.team and request.user.team.repositories.exists():
            repository = request.user.team.repositories.first()
            owner_repo = repository.name
        elif request.user.repositories.exists():
            repository = request.user.repositories.first()
            owner_repo = repository.name
            
        github_data = None
        if owner_repo:
            try:
                gh_labels = list(d.get('labels', []))
                if d.get('priority') and d['priority'] != 'normal':
                    gh_labels.append(d['priority'])
                github_data = create_github_issue(owner_repo, d['title'], d.get('description', ''), gh_labels)
            except Exception as e:
                print(f'[GitHub] Issue creation failed: {e}')

        assignee = None
        if d.get('assignee_id'):
            try:
                assignee = User.objects.get(pk=d['assignee_id'])
            except User.DoesNotExist:
                pass

        classified_team = ''
        severity = ''
        is_urgent = False
        severity_reason = ''
        ai_explanation = ''
        suggested_action = ''
        estimated_complexity = ''

        try:
            result = classify_issue_with_groq(d['title'], d.get('description', '') or '')
            classified_team = result.get('team', '')
            severity = result.get('severity', '')
            is_urgent = result.get('is_urgent', False)
            severity_reason = result.get('severity_reason', '')
            ai_explanation = result.get('ai_explanation', '')
            suggested_action = result.get('suggested_action', '')
            estimated_complexity = result.get('estimated_complexity', '')
        except Exception as e:
            print(f'[Groq] Immediate manual issue classification error: {e}')

        issue = Issue.objects.create(
            team=request.user.team,
            repository=repository,
            issue_id=github_data['number'] if github_data else Issue.objects.count() + 1000,
            title=d['title'],
            description=d.get('description', ''),
            priority=d.get('priority', 'normal'),
            assignee=assignee,
            labels=d.get('labels', []),
            github_url=github_data['html_url'] if github_data else '',
            status='open',
            workflow_status='open',
            classified_team=classified_team,
            severity=severity,
            is_urgent=is_urgent,
            severity_reason=severity_reason,
            ai_explanation=ai_explanation,
            suggested_action=suggested_action,
            estimated_complexity=estimated_complexity,
        )

        # Async: AI triage + notifications
        def async_tasks():
            try:
                team_members = list(User.objects.filter(is_active=True).values('name', 'role'))
                triage = triage_issue_with_claude(issue, team_members)
                Issue.objects.filter(pk=issue.pk).update(ai_triage=triage)
                if triage.get('severity') == 'Critical':
                    notify_critical_issue(issue, triage)
            except Exception as e:
                print(f'[Triage] Error: {e}')
                
            try:
                from services.notification_service import trigger_notification
                trigger_notification(issue, 'created', request.user)
            except Exception as e:
                print(f'[Notification] Error: {e}')

        threading.Thread(target=async_tasks, daemon=True).start()

        return Response({'issue': IssueListSerializer(issue).data, 'duplicates': []}, status=201)


class IssueDetailView(APIView):
    def _get_issue(self, pk):
        try:
            return Issue.objects.select_related('assignee', 'closed_by', 'resolved_by').get(pk=pk)
        except Issue.DoesNotExist:
            return None

    def get(self, request, pk):
        issue = self._get_issue(pk)
        if not issue:
            return Response({'message': 'Issue not found'}, status=404)
        return Response(IssueSerializer(issue).data)

    def patch(self, request, pk):
        issue = self._get_issue(pk)
        if not issue:
            return Response({'message': 'Issue not found'}, status=404)

        s = UpdateIssueSerializer(data=request.data, partial=True)
        if not s.is_valid():
            return Response(s.errors, status=400)
        d = s.validated_data

        owner_repo = issue.repository.name if issue.repository else None
        was_open = issue.status != 'closed'

        if 'title' in d:
            issue.title = d['title']
        if 'description' in d:
            issue.description = d['description']
        if 'priority' in d:
            issue.priority = d['priority']
        if 'labels' in d:
            issue.labels = d['labels']
        if 'assignee_id' in d:
            if not request.user.is_lead:
                return Response({'message': 'Only Team Leads can assign issues'}, status=403)
            issue.assignee = User.objects.filter(pk=d['assignee_id']).first() if d['assignee_id'] else None

        if 'status' in d:
            new_status = d['status']
            issue.status = new_status
            if new_status == 'closed' and was_open:
                issue.closed_at = tz.now()
                issue.closed_by = request.user
                issue.resolved_at = tz.now()
                delta = (issue.resolved_at - issue.created_at).total_seconds()
                issue.resolution_time_hours = round(delta / 3600, 1)
                if owner_repo:
                    try:
                        close_github_issue(owner_repo, issue.issue_id)
                    except Exception as e:
                        print(f'[GitHub] Close failed: {e}')
                from services.notification_service import trigger_notification
                trigger_notification(issue, 'closed', request.user)
            elif new_status == 'open' and not was_open:
                issue.closed_at = None
                issue.closed_by = None
                if owner_repo:
                    try:
                        reopen_github_issue(owner_repo, issue.issue_id)
                    except Exception as e:
                        print(f'[GitHub] Reopen failed: {e}')

        issue.save()
        return Response(IssueSerializer(issue).data)

    def delete(self, request, pk):
        if not request.user.is_lead:
            return Response({'message': 'Team Lead access required'}, status=403)
        issue = self._get_issue(pk)
        if not issue:
            return Response({'message': 'Issue not found'}, status=404)
        issue.delete()
        return Response({'message': 'Issue deleted'})


class IssueStatsView(APIView):
    def get(self, request):
        from django.utils import timezone as tz
        today = tz.now().replace(hour=0, minute=0, second=0, microsecond=0)
        qs = Issue.objects.all()
        
        repository_id = request.query_params.get('repository')
        if repository_id:
            qs = qs.filter(repository_id=repository_id)
        elif request.user.is_lead:
            qs = qs.filter(repository__in=request.user.team.repositories.all() if request.user.team else [])
        else:
            qs = qs.filter(repository__in=request.user.repositories.all())
            
        return Response({
            'open': qs.filter(status='open').count(),
            'inProgress': qs.filter(status='in-progress').count(),
            'closed': qs.filter(status='closed').count(),
            'urgent': qs.filter(priority='urgent').exclude(status='closed').count(),
            'high': qs.filter(priority='high').exclude(status='closed').count(),
            'raisedToday': qs.filter(created_at__gte=today).count(),
            'closedToday': qs.filter(closed_at__gte=today).count(),
        })


class IssueSyncView(APIView):
    def post(self, request):
        repository_id = request.data.get('repository') or request.query_params.get('repository')
        if not repository_id:
            return Response({'message': 'Repository ID is required for sync'}, status=400)
            
        from users.models import Repository
        try:
            repository = Repository.objects.get(id=repository_id)
        except Repository.DoesNotExist:
            return Response({'message': 'Repository not found'}, status=404)
            
        if not request.user.is_lead and not request.user.repositories.filter(id=repository_id).exists():
             return Response({'message': 'Forbidden'}, status=403)

        owner_repo = repository.name
        if not owner_repo:
            return Response({'message': 'No GitHub repository configured.'}, status=400)

        try:
            github_issues = fetch_github_issues(owner_repo, 'all')
        except Exception as e:
            return Response({'message': str(e)}, status=400)

        from django.utils.dateparse import parse_datetime
        from django.utils import timezone as tz

        created = updated = 0

        for gi in github_issues:
            # ── Parse all GitHub fields ───────────────────────────────────
            priority    = get_priority_from_labels(gi.get('labels', []))
            gh_state    = gi.get('state', 'open')           # 'open' or 'closed'
            gh_status   = 'closed' if gh_state == 'closed' else 'open'
            gh_workflow = 'resolved' if gh_state == 'closed' else 'open'
            labels      = [l['name'] for l in gi.get('labels', [])]

            # Timestamps — parse from GitHub ISO strings
            gh_created_at = parse_datetime(gi['created_at']) if gi.get('created_at') else None
            gh_updated_at = parse_datetime(gi['updated_at']) if gi.get('updated_at') else None
            gh_closed_at  = parse_datetime(gi['closed_at'])  if gi.get('closed_at')  else None

            # Assignee GitHub login
            assignee_login = gi['assignee']['login'] if gi.get('assignee') else None

            # Automatically run Groq classification synchronously for any new or currently unclassified issue
            classified_team = ''
            severity = ''
            is_urgent = False
            severity_reason = ''
            ai_explanation = ''
            suggested_action = ''
            estimated_complexity = ''

            existing_issue = Issue.objects.filter(issue_id=gi['number'], repository=repository).first()
            if not existing_issue or not existing_issue.ai_explanation:
                try:
                    result = classify_issue_with_groq(gi['title'], gi.get('body') or '')
                    classified_team = result.get('team', '')
                    severity = result.get('severity', '')
                    is_urgent = result.get('is_urgent', False)
                    severity_reason = result.get('severity_reason', '')
                    ai_explanation = result.get('ai_explanation', '')
                    suggested_action = result.get('suggested_action', '')
                    estimated_complexity = result.get('estimated_complexity', '')
                    import time
                    time.sleep(1)  # 1 second between each classification
                except Exception as e:
                    print(f'[Groq Sync] Immediate manual sync classification error for #{gi["number"]}: {e}')
            else:
                classified_team = existing_issue.classified_team
                severity = existing_issue.severity
                is_urgent = existing_issue.is_urgent
                severity_reason = existing_issue.severity_reason
                ai_explanation = existing_issue.ai_explanation
                suggested_action = existing_issue.suggested_action
                estimated_complexity = existing_issue.estimated_complexity

            # ── Upsert ────────────────────────────────────────────────────
            issue = existing_issue
            if not issue:
                is_new = True
                issue = Issue.objects.create(
                    issue_id=gi['number'],
                    repository=repository,
                    team=request.user.team,
                    title=gi['title'],
                    description=gi.get('body') or '',
                    priority=priority,
                    status=gh_status,
                    workflow_status=gh_workflow,
                    labels=labels,
                    github_url=gi['html_url'],
                    assignee_github_login=assignee_login,
                    closed_at=gh_closed_at,
                    resolved_at=gh_closed_at,
                    opened_at=gh_created_at or tz.now(),
                    classified_team=classified_team,
                    severity=severity,
                    is_urgent=is_urgent,
                    severity_reason=severity_reason,
                    ai_explanation=ai_explanation,
                    suggested_action=suggested_action,
                    estimated_complexity=estimated_complexity,
                )
            else:
                is_new = False

            if not is_new:
                # ── Sync every field from GitHub ──────────────────────────
                issue.title                 = gi['title']
                issue.description           = gi.get('body') or ''
                issue.priority              = priority
                issue.status                = gh_status
                issue.workflow_status       = gh_workflow
                issue.labels                = labels
                issue.github_url            = gi['html_url']
                issue.assignee_github_login = assignee_login
                issue.classified_team       = classified_team
                issue.severity              = severity
                issue.is_urgent             = is_urgent
                issue.severity_reason       = severity_reason
                issue.ai_explanation        = ai_explanation
                issue.suggested_action      = suggested_action
                issue.estimated_complexity  = estimated_complexity
                issue.repository            = repository

                # Timestamps
                if gh_created_at:
                    issue.opened_at = gh_created_at

                if gh_state == 'closed':
                    issue.closed_at   = gh_closed_at or tz.now()
                    issue.resolved_at = gh_closed_at or tz.now()
                    # Calculate resolution time in hours
                    if gh_closed_at and gh_created_at:
                        delta = (gh_closed_at - gh_created_at).total_seconds()
                        issue.resolution_time_hours = round(delta / 3600, 2)
                else:
                    # Reopened on GitHub — clear resolution
                    issue.closed_at             = None
                    issue.resolved_at           = None
                    issue.resolution_time_hours = None

                issue.save()
                updated += 1
            else:
                # For newly created issues, also set resolution time
                if gh_closed_at and gh_created_at:
                    delta = (gh_closed_at - gh_created_at).total_seconds()
                    Issue.objects.filter(pk=issue.pk).update(
                        resolution_time_hours=round(delta / 3600, 2)
                    )
                created += 1

        return Response({
            'message': f'Sync complete: {created} created, {updated} updated',
            'created': created,
            'updated': updated,
        })


class IssueRetriegeView(APIView):
    def post(self, request, pk):
        try:
            issue = Issue.objects.get(pk=pk)
        except Issue.DoesNotExist:
            return Response({'message': 'Issue not found'}, status=404)
        team_members = list(User.objects.filter(is_active=True).values('name', 'role'))
        triage = triage_issue_with_claude(issue, team_members)
        Issue.objects.filter(pk=pk).update(ai_triage=triage)
        return Response({'triage': triage})


class IssueBatchClassifyView(APIView):
    """Run Groq AI classification on all issues that haven't been classified yet."""
    def post(self, request):
        import time
        # Process issues with empty ai_explanation (unclassified or partially classified)
        unclassified = Issue.objects.filter(
            ai_explanation=''
        )[:50]  # process max 50 at a time

        classified = 0
        errors = 0

        for issue in unclassified:
            try:
                result = classify_issue_with_groq(issue.title, issue.description or '')
                Issue.objects.filter(pk=issue.pk).update(
                    classified_team=result['team'],
                    severity=result['severity'],
                    is_urgent=result.get('is_urgent', False),
                    severity_reason=result['severity_reason'],
                    ai_explanation=result.get('ai_explanation', ''),
                    suggested_action=result['suggested_action'],
                    estimated_complexity=result['estimated_complexity'],
                )
                classified += 1
                time.sleep(0.3)  # rate limit: ~3 req/sec
            except Exception as e:
                print(f'[Groq] Batch classify error for #{issue.issue_id}: {e}')
                errors += 1

        return Response({
            'message': f'Classified {classified} issues ({errors} errors)',
            'classified': classified,
            'errors': errors,
        })


class IssueWorkflowStatusView(APIView):
    def patch(self, request, pk):
        try:
            issue = Issue.objects.select_related('assignee', 'resolved_by').get(pk=pk)
        except Issue.DoesNotExist:
            return Response({'message': 'Issue not found'}, status=404)

        s = WorkflowStatusSerializer(data=request.data)
        if not s.is_valid():
            return Response(s.errors, status=400)
        new_status = s.validated_data['status']

        # Team check
        if issue.team and request.user.team:
            if issue.team_id != request.user.team_id:
                return Response({'message': 'You do not have access to this issue'}, status=403)

        owner_repo = issue.repository.name if issue.repository else None
        issue.workflow_status = new_status
        if new_status == 'resolved':
            issue.resolved_by = request.user
            issue.resolved_at = tz.now()
            issue.status = 'closed'
            issue.closed_at = tz.now()
            if issue.opened_at:
                delta = (issue.resolved_at - issue.opened_at).total_seconds()
                issue.resolution_time_hours = round(delta / 3600, 1)
            if owner_repo:
                try:
                    close_github_issue(owner_repo, issue.issue_id)
                    print(f"[GitHub] Closed issue #{issue.issue_id} successfully.")
                except Exception as e:
                    print(f"[GitHub] Close failed inside workflow update: {e}")
            from services.notification_service import trigger_notification
            trigger_notification(issue, 'closed', request.user)
        elif new_status == 'in_progress':
            issue.status = 'in-progress'
        elif new_status == 'open':
            issue.status = 'open'
            issue.resolved_by = None
            issue.resolved_at = None

        issue.save()
        return Response(IssueListSerializer(issue).data)


class ReminderListCreateView(APIView):
    def get(self, request):
        if not request.user or not request.user.is_authenticated:
            return Response({'message': 'Authentication required'}, status=401)
        reminders = Reminder.objects.filter(user=request.user, triggered=False).order_by('scheduled_time')
        serializer = ReminderSerializer(reminders, many=True)
        return Response(serializer.data)

    def post(self, request):
        if not request.user or not request.user.is_authenticated:
            return Response({'message': 'Authentication required'}, status=401)
        serializer = ReminderSerializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        serializer.save()
        return Response(serializer.data, status=201)


class ReminderDeleteView(APIView):
    def delete(self, request, pk):
        if not request.user or not request.user.is_authenticated:
            return Response({'message': 'Authentication required'}, status=401)
        try:
            reminder = Reminder.objects.get(pk=pk, user=request.user)
        except Reminder.DoesNotExist:
            return Response({'message': 'Reminder not found'}, status=404)
        reminder.delete()
        return Response({'message': 'Reminder deleted successfully'})


class AIChatView(APIView):
    def post(self, request):
        import requests
        from django.utils import timezone as tz
        
        user = request.user
        if not user or not user.is_authenticated:
            return Response({'message': 'Authentication required'}, status=401)
            
        prompt = request.data.get('message', '')
        history = request.data.get('history', [])
        
        # Build issue list context
        if user.is_lead:
            team = user.team
            if team:
                issues = Issue.objects.filter(Q(team=team) | Q(assignee__team=team)).select_related('assignee', 'resolved_by')
                if not issues.exists():
                    issues = Issue.objects.all().select_related('assignee', 'resolved_by')
            else:
                issues = Issue.objects.all().select_related('assignee', 'resolved_by')
        else:
            # Members can ask questions about their assigned issues
            issues = Issue.objects.filter(assignee=user).select_related('assignee', 'resolved_by')
            
        # Format the issues for the AI context
        issue_lines = []
        now = tz.now()
        
        for i in issues:
            assignee_name = i.assignee.name if i.assignee else 'Unassigned'
            resolved_by_name = i.resolved_by.name if i.resolved_by else 'None'
            created_str = i.created_at.strftime('%Y-%m-%d') if i.created_at else 'Unknown'
            resolved_str = i.resolved_at.strftime('%Y-%m-%d') if i.resolved_at else 'N/A'
            issue_lines.append(
                f"- Issue #{i.issue_id}: '{i.title}' | Status: {i.status} | Workflow Status: {i.workflow_status} | "
                f"Priority: {i.priority} | Severity: {i.severity} | Team: {i.classified_team} | "
                f"Assignee: {assignee_name} | Resolved By: {resolved_by_name} | Created: {created_str} | "
                f"Resolved At: {resolved_str} | Resolution Hours: {i.resolution_time_hours or 'N/A'} | "
                f"AI Explanation: {i.ai_explanation or 'N/A'} | Suggested Action: {i.suggested_action or 'N/A'}"
            )
        
        issues_context = "\n".join(issue_lines) if issue_lines else "No issues found in this context."
        
        # Build the system prompt
        system_prompt = request.data.get('system_prompt', None)
        if not system_prompt:
            system_prompt = (
                f"You are a helpful software engineering assistant called Gitora AI. You are helping {user.name}, who is a {user.get_role_display()}."
            )
            if user.role_tag:
                system_prompt += f" Their role specialty tag is {user.get_role_tag_display()}."
                
            system_prompt += (
                f"\n\nHere is the current list of issues relevant to them:\n"
                f"{issues_context}\n\n"
                f"Current time is {now.strftime('%Y-%m-%d %H:%M:%S')}.\n\n"
                f"Your instructions:\n"
            )
            
            if user.is_lead:
                system_prompt += (
                    "1. You have access to all team issues. Answer questions and give stats summaries like 'how many issues closed this week', "
                    "'who resolved the most', 'which team has most open issues', etc. Use calculations based on the provided issue list. "
                    "For 'closed this week', look at 'Resolved At' or 'Status: closed' and see which issues have resolved date within the last 7 days from the current time. "
                    "Provide detailed counts and names. Be extremely helpful and accurate."
                )
            else:
                system_prompt += (
                    "1. Answer questions about their assigned issues and suggest technical solutions or next steps. "
                    "Explain the bugs and guide them using the AI explanation and suggested action. "
                    "Keep your answers technically clear and actionable."
                )
                
            system_prompt += (
                "\n2. Maintain a friendly, supportive, professional developer-to-developer tone.\n"
                "3. Ground all statistics and answers in the real issue data provided. If you do not have enough data, clearly state it."
            )
        
        # Call Groq llama-3.3-70b-versatile
        api_key = getattr(settings, 'GROQ_API_KEY', '')
        if not api_key:
            return Response({'message': 'Groq API Key not configured on server.'}, status=500)
            
        # Build message history for Groq
        messages = [{'role': 'system', 'content': system_prompt}]
        for h in history[-10:]:
            role = 'user' if h.get('role') == 'user' else 'assistant'
            messages.append({'role': role, 'content': h.get('content', '')})
            
        messages.append({'role': 'user', 'content': prompt})
        
        import time
        for attempt in range(3):
            try:
                resp = requests.post(
                    'https://api.groq.com/openai/v1/chat/completions',
                    headers={
                        'Authorization': f'Bearer {api_key}',
                        'Content-Type': 'application/json',
                    },
                    json={
                        'model': 'llama-3.3-70b-versatile',
                        'messages': messages,
                        'temperature': 0.7,
                        'max_tokens': 1000,
                    },
                    timeout=25,
                )
                resp.raise_for_status()
                ai_content = resp.json()['choices'][0]['message']['content'].strip()
                return Response({'message': ai_content})
            except Exception as e:
                if '429' in str(e):
                    if attempt < 2:
                        print(f'[Groq Chat] 429 Too Many Requests, retrying in 2s (attempt {attempt+1}/3)...')
                        time.sleep(2)
                        continue
                    print(f'[Groq Chat] 429 Too Many Requests, returning friendly message.')
                    return Response({
                        'message': "I'm receiving too many requests right now. Please wait a moment and try again."
                    }, status=200)
                print(f'[Groq Chat] Error: {e}')
                return Response({'message': f'Error: {str(e)}'}, status=500)


class AnalyticsView(APIView):
    def get(self, request):
        from datetime import timedelta
        from django.utils import timezone as tz
        
        user = request.user
        if not user or not user.is_authenticated:
            return Response({'message': 'Authentication required'}, status=401)
        if not user.is_lead:
            return Response({'message': 'Team Lead access required'}, status=403)
            
        team = user.team
        if team:
            issues_qs = Issue.objects.filter(Q(team=team) | Q(assignee__team=team)).select_related('assignee', 'resolved_by')
            if not issues_qs.exists():
                issues_qs = Issue.objects.all().select_related('assignee', 'resolved_by')
        else:
            issues_qs = Issue.objects.all().select_related('assignee', 'resolved_by')
            
        # 1. Issues over time (last 30 days)
        now = tz.now()
        thirty_days_ago = now - timedelta(days=30)
        recent_issues = issues_qs.filter(created_at__gte=thirty_days_ago)
        
        by_date = {}
        for d in range(30):
            day = (now - timedelta(days=d)).date()
            by_date[day.strftime('%Y-%m-%d')] = 0
            
        for issue in recent_issues:
            if issue.created_at:
                day_str = issue.created_at.date().strftime('%Y-%m-%d')
                if day_str in by_date:
                    by_date[day_str] += 1
                    
        issues_over_time = [{'date': k, 'count': v} for k, v in sorted(by_date.items())]
        
        # 2. Average time to close (resolved issues)
        resolved_qs = issues_qs.filter(
            Q(status='closed') | Q(workflow_status='resolved'),
            resolved_at__isnull=False
        )
        
        total_resolved = resolved_qs.count()
        avg_resolution_time = None
        if total_resolved > 0:
            times = []
            for ri in resolved_qs:
                if ri.resolution_time_hours is not None:
                    times.append(ri.resolution_time_hours)
                elif ri.opened_at:
                    delta = (ri.resolved_at - ri.opened_at).total_seconds() / 3600
                    times.append(delta)
            if times:
                avg_resolution_time = round(sum(times) / len(times), 1)
                
        # 3. Fastest resolved issues (top 5)
        fastest_issues = []
        resolved_list = []
        for ri in resolved_qs:
            val = ri.resolution_time_hours
            if val is None and ri.opened_at:
                val = (ri.resolved_at - ri.opened_at).total_seconds() / 3600
            if val is not None:
                resolved_list.append((ri, val))
                
        resolved_list.sort(key=lambda x: x[1])
        for ri, val in resolved_list[:5]:
            fastest_issues.append({
                'issue_id': ri.issue_id,
                'title': ri.title,
                'resolution_time_hours': round(val, 1),
                'assignee': ri.assignee.name if ri.assignee else 'Unassigned'
            })
            
        # 4. Slowest/overdue open issues (> 3 days old)
        three_days_ago = now - timedelta(days=3)
        overdue_qs = issues_qs.filter(
            status__in=['open', 'in-progress']
        ).exclude(workflow_status='resolved').filter(
            opened_at__lte=three_days_ago
        )
        
        overdue_issues = []
        for oi in overdue_qs:
            days_open = (now - oi.opened_at).days if oi.opened_at else 0
            overdue_issues.append({
                'issue_id': oi.issue_id,
                'title': oi.title,
                'days_open': days_open,
                'assignee': oi.assignee.name if oi.assignee else 'Unassigned',
                'severity': oi.severity or 'moderate'
            })
        overdue_issues.sort(key=lambda x: x['days_open'], reverse=True)
        
        # 5. Per member stats table
        if team:
            members = User.objects.filter(team=team, is_active=True)
        else:
            members = User.objects.filter(is_active=True)
            
        member_stats = []
        for m in members:
            m_issues = Issue.objects.filter(assignee=m)
            m_total = m_issues.count()
            m_resolved = m_issues.filter(workflow_status='resolved').count()
            m_in_progress = m_issues.filter(workflow_status='in_progress').count()
            
            m_resolved_qs = m_issues.filter(workflow_status='resolved', resolved_at__isnull=False)
            m_times = []
            for ri in m_resolved_qs:
                if ri.resolution_time_hours is not None:
                    m_times.append(ri.resolution_time_hours)
                elif ri.opened_at:
                    m_times.append((ri.resolved_at - ri.opened_at).total_seconds() / 3600)
            m_avg = round(sum(m_times) / len(m_times), 1) if m_times else None
            
            m_last_resolved = m_resolved_qs.order_by('-resolved_at').first()
            last_active = m_last_resolved.resolved_at.strftime('%Y-%m-%d') if m_last_resolved and m_last_resolved.resolved_at else None
            
            member_stats.append({
                'name': m.name,
                'role': m.role,
                'role_tag': m.role_tag,
                'total_assigned': m_total,
                'resolved': m_resolved,
                'in_progress': m_in_progress,
                'avg_resolution_time': m_avg,
                'last_active': last_active
            })
            
        # 6. Per team stats
        team_categories = ['frontend', 'backend', 'devops', 'fullstack']
        team_stats = []
        for tc in team_categories:
            tc_issues = issues_qs.filter(classified_team=tc)
            tc_total = tc_issues.count()
            tc_resolved = tc_issues.filter(workflow_status='resolved').count()
            tc_open = tc_issues.filter(workflow_status='open').count()
            
            tc_resolved_qs = tc_issues.filter(workflow_status='resolved', resolved_at__isnull=False)
            tc_times = []
            for ri in tc_resolved_qs:
                if ri.resolution_time_hours is not None:
                    tc_times.append(ri.resolution_time_hours)
                elif ri.opened_at:
                    tc_times.append((ri.resolved_at - ri.opened_at).total_seconds() / 3600)
            tc_avg = round(sum(tc_times) / len(tc_times), 1) if tc_times else None
            
            team_stats.append({
                'team': tc,
                'total': tc_total,
                'resolved': tc_resolved,
                'open': tc_open,
                'avg_close_time': tc_avg
            })
            
        return Response({
            'issues_over_time': issues_over_time,
            'avg_time_to_close': avg_resolution_time,
            'fastest_resolved': fastest_issues,
            'slowest_overdue': overdue_issues,
            'member_stats': member_stats,
            'team_stats': team_stats
        })

