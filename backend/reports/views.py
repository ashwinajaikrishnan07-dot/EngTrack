import threading
from datetime import date, timedelta
from rest_framework.views import APIView
from rest_framework.response import Response
from django.utils import timezone as tz
from django.db.models import Count
from issues.models import Issue
from users.models import User
from services.email_service import send_eod_report, send_standup_report
from services.ai_service import generate_standup_with_claude
from django.conf import settings


class AnalyticsView(APIView):
    def get(self, request):
        days = int(request.query_params.get('days', 30))
        since = tz.now() - timedelta(days=days)

        by_status = list(Issue.objects.values('status').annotate(count=Count('id')))
        by_priority = list(Issue.objects.values('priority').annotate(count=Count('id')))

        # Trend per day
        from django.db.models.functions import TruncDate
        created_per_day = list(
            Issue.objects.filter(created_at__gte=since)
            .annotate(day=TruncDate('created_at'))
            .values('day').annotate(count=Count('id')).order_by('day')
        )
        closed_per_day = list(
            Issue.objects.filter(closed_at__gte=since, closed_at__isnull=False)
            .annotate(day=TruncDate('closed_at'))
            .values('day').annotate(count=Count('id')).order_by('day')
        )

        # Top assignees
        top_assignees = list(
            Issue.objects.exclude(status='closed').exclude(assignee=None)
            .values('assignee__id', 'assignee__name', 'assignee__email')
            .annotate(count=Count('id')).order_by('-count')[:5]
        )

        return Response({
            'byStatus': by_status,
            'byPriority': by_priority,
            'createdPerDay': [{'_id': str(d['day']), 'count': d['count']} for d in created_per_day],
            'closedPerDay': [{'_id': str(d['day']), 'count': d['count']} for d in closed_per_day],
            'topAssignees': [{'name': a['assignee__name'], 'email': a['assignee__email'], 'count': a['count']} for a in top_assignees],
        })


class TriggerEODView(APIView):
    def post(self, request):
        if not request.user.is_lead:
            return Response({'message': 'Team Lead access required'}, status=403)
        tl_email = getattr(settings, 'TL_EMAIL', '')
        if not tl_email:
            return Response({'message': 'TL_EMAIL not configured'}, status=400)

        today = tz.now().replace(hour=0, minute=0, second=0, microsecond=0)
        tomorrow = today + timedelta(days=1)

        raised = Issue.objects.filter(created_at__gte=today, created_at__lt=tomorrow).count()
        closed = Issue.objects.filter(closed_at__gte=today, closed_at__lt=tomorrow).count()
        pending = Issue.objects.filter(status__in=['open', 'in-progress']).count()
        open_issues = list(Issue.objects.filter(status__in=['open', 'in-progress']).select_related('assignee')[:50])

        threading.Thread(
            target=send_eod_report,
            args=({'raised_today': raised, 'closed_today': closed, 'total_pending': pending, 'open_issues': open_issues}, tl_email),
            daemon=True
        ).start()
        return Response({'message': 'EOD report sent successfully'})


class TriggerStandupView(APIView):
    def post(self, request):
        if not request.user.is_lead:
            return Response({'message': 'Team Lead access required'}, status=403)
        tl_email = getattr(settings, 'TL_EMAIL', '')
        if not tl_email:
            return Response({'message': 'TL_EMAIL not configured'}, status=400)

        today = tz.now().replace(hour=0, minute=0, second=0, microsecond=0)
        tomorrow = today + timedelta(days=1)

        resolved_today = list(Issue.objects.filter(closed_at__gte=today, closed_at__lt=tomorrow).values('issue_id', 'title'))
        pending_critical = list(Issue.objects.filter(status__in=['open', 'in-progress'], priority__in=['urgent', 'high']).select_related('assignee').values('issue_id', 'title', 'priority', 'assignee__name'))
        users = User.objects.filter(is_active=True)
        team_stats = [{'name': u.name, 'open_count': Issue.objects.filter(assignee=u).exclude(status='closed').count()} for u in users]

        data = {
            'resolved_today': resolved_today,
            'pending_critical': [{'issue_id': i['issue_id'], 'title': i['title']} for i in pending_critical],
            'team_stats': team_stats,
            'date': date.today().strftime('%A, %B %d, %Y'),
        }

        def send():
            html = generate_standup_with_claude(data)
            send_standup_report(html, tl_email)

        threading.Thread(target=send, daemon=True).start()
        return Response({'message': 'AI standup report sent successfully'})


class HealthDashboardView(APIView):
    def get(self, request):
        now = tz.now()
        one_day_ago = now - timedelta(hours=24)
        seven_days_ago = now - timedelta(days=7)
        two_days_ago = now - timedelta(hours=48)
        thirty_days_ago = now - timedelta(days=30)

        users = User.objects.filter(is_active=True)
        dev_stats = []
        for u in users:
            active = Issue.objects.filter(assignee=u).exclude(status='closed').count()
            overdue = Issue.objects.filter(assignee=u, created_at__lte=one_day_ago).exclude(status='closed').count()
            resolved = Issue.objects.filter(assignee=u, status='closed', closed_at__gte=seven_days_ago, resolution_time_hours__isnull=False)
            avg = None
            if resolved.exists():
                avg = round(sum(i.resolution_time_hours for i in resolved) / resolved.count(), 1)
            dev_stats.append({
                'id': u.id, 'name': u.name, 'email': u.email, 'role': u.role,
                'activeCount': active, 'overdueCount': overdue,
                'avgResolutionHours': avg, 'isOverloaded': active >= 5,
                'resolvedThisWeek': resolved.count(),
            })

        overdue_tasks = list(
            Issue.objects.filter(created_at__lte=one_day_ago).exclude(status='closed')
            .select_related('assignee').values(
                'issue_id', 'title', 'priority', 'created_at', 'escalated',
                'assignee__name'
            )[:20]
        )

        escalated = list(
            Issue.objects.filter(escalated=True).exclude(status='closed')
            .select_related('assignee').values(
                'issue_id', 'title', 'priority', 'escalated_at', 'escalation_reason',
                'assignee__name'
            ).order_by('-escalated_at')[:10]
        )

        bottlenecks = list(
            Issue.objects.filter(status='in-progress', updated_at__lte=two_days_ago)
            .select_related('assignee').values('issue_id', 'title', 'priority', 'updated_at', 'assignee__name')[:10]
        )

        recent_resolved = Issue.objects.filter(
            status='closed', closed_at__gte=thirty_days_ago, resolution_time_hours__isnull=False
        )
        avg_overall = None
        if recent_resolved.exists():
            avg_overall = round(sum(i.resolution_time_hours for i in recent_resolved) / recent_resolved.count(), 1)

        return Response({
            'summary': {
                'totalOpen': Issue.objects.filter(status='open').count(),
                'totalInProgress': Issue.objects.filter(status='in-progress').count(),
                'totalEscalated': Issue.objects.filter(escalated=True).exclude(status='closed').count(),
                'totalCritical': Issue.objects.filter(ai_triage__severity='Critical').exclude(status='closed').count(),
                'avgResolutionOverall': avg_overall,
                'overloadedDevs': sum(1 for d in dev_stats if d['isOverloaded']),
            },
            'developerStats': dev_stats,
            'overdueTasks': overdue_tasks,
            'escalatedIssues': escalated,
            'bottlenecks': bottlenecks,
        })
