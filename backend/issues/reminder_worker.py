import time
import threading
from django.utils import timezone as tz
from django.conf import settings

def sync_issues_with_github():
    print("[GitHub Sync] Starting background synchronization...")
    try:
        from services.github_service import fetch_github_issues, get_priority_from_labels
        from issues.models import Issue
        from users.models import Team
        from django.utils.dateparse import parse_datetime
        from django.utils import timezone as tz

        from users.models import Repository
        repositories = Repository.objects.filter(is_active=True).exclude(name='')
        if not repositories.exists():
            print("[GitHub Sync] No repositories configured. Skipping sync.")
            return

        for repository in repositories:
            owner_repo = repository.name
            team = repository.team
            print(f"[GitHub Sync] Syncing repository {owner_repo} for team '{team.name}'...")
            
            try:
                github_issues = fetch_github_issues(owner_repo, 'all')
            except Exception as e:
                print(f"[GitHub Sync] Failed fetching issues for {owner_repo}: {e}")
                continue
            
            created = updated = 0
            for gi in github_issues:
                priority    = get_priority_from_labels(gi.get('labels', []))
                gh_state    = gi.get('state', 'open')
                gh_status   = 'closed' if gh_state == 'closed' else 'open'
                gh_workflow = 'resolved' if gh_state == 'closed' else 'open'
                labels      = [l['name'] for l in gi.get('labels', [])]

                gh_created_at = parse_datetime(gi['created_at']) if gi.get('created_at') else None
                gh_updated_at = parse_datetime(gi['updated_at']) if gi.get('updated_at') else None
                gh_closed_at  = parse_datetime(gi['closed_at'])  if gi.get('closed_at')  else None
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
                        from services.ai_service import classify_issue_with_groq
                        result = classify_issue_with_groq(gi['title'], gi.get('body') or '')
                        classified_team = result.get('team', '')
                        severity = result.get('severity', '')
                        is_urgent = result.get('is_urgent', False)
                        severity_reason = result.get('severity_reason', '')
                        ai_explanation = result.get('ai_explanation', '')
                        suggested_action = result.get('suggested_action', '')
                        estimated_complexity = result.get('estimated_complexity', '')
                        import time
                        time.sleep(2)  # Delay to avoid Groq 429 Too Many Requests
                    except Exception as e:
                        print(f'[Groq Sync] Immediate sync classification error for #{gi["number"]}: {e}')
                else:
                    classified_team = existing_issue.classified_team
                    severity = existing_issue.severity
                    is_urgent = existing_issue.is_urgent
                    severity_reason = existing_issue.severity_reason
                    ai_explanation = existing_issue.ai_explanation
                    suggested_action = existing_issue.suggested_action
                    estimated_complexity = existing_issue.estimated_complexity

                issue, is_new = Issue.objects.get_or_create(
                    issue_id=gi['number'],
                    repository=repository,
                    defaults={
                        'team':                   team,
                        'title':                  gi['title'],
                        'description':            gi.get('body') or '',
                        'priority':               priority,
                        'status':                 gh_status,
                        'workflow_status':        gh_workflow,
                        'labels':                 labels,
                        'github_url':             gi['html_url'],
                        'assignee_github_login':  assignee_login,
                        'closed_at':              gh_closed_at,
                        'resolved_at':            gh_closed_at,
                        'opened_at':              gh_created_at or tz.now(),
                        'classified_team':        classified_team,
                        'severity':               severity,
                        'is_urgent':              is_urgent,
                        'severity_reason':        severity_reason,
                        'ai_explanation':         ai_explanation,
                        'suggested_action':       suggested_action,
                        'estimated_complexity':   estimated_complexity,
                    }
                )

                if not is_new:
                    issue.team                  = team
                    issue.repository            = repository
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

                    if gh_created_at:
                        issue.opened_at = gh_created_at

                    if gh_state == 'closed':
                        issue.closed_at   = gh_closed_at or tz.now()
                        issue.resolved_at = gh_closed_at or tz.now()
                        if gh_closed_at and gh_created_at:
                            delta = (gh_closed_at - gh_created_at).total_seconds()
                            issue.resolution_time_hours = round(delta / 3600, 2)
                    else:
                        issue.closed_at             = None
                        issue.resolved_at           = None
                        issue.resolution_time_hours = None

                    issue.save()
                    updated += 1
                else:
                    if gh_closed_at and gh_created_at:
                        delta = (gh_closed_at - gh_created_at).total_seconds()
                        Issue.objects.filter(pk=issue.pk).update(
                            resolution_time_hours=round(delta / 3600, 2)
                        )
                    created += 1
            print(f"[GitHub Sync] Completed sync for '{team.name}': {created} created, {updated} updated.")
    except Exception as e:
        print(f"[GitHub Sync] Failed in background worker: {e}")


def reminder_worker_loop():
    # Delay startup to ensure database connections and app registrations are ready
    time.sleep(5)
    print("Reminder scheduler started", flush=True)
    from issues.models import Reminder
    from issues.utils import send_notification_async
    
    counter = 0
    while True:
        # Requirement 1: Add console.log (print) at the top of the reminder check function so we can see it runs every minute
        print("[Reminder Worker] Checking for due reminders...", flush=True)
        try:
            now = tz.now()
            local_now = tz.localtime(now)
            # Fetch active, untriggered reminders that are due
            due_reminders = Reminder.objects.filter(
                triggered=False,
                scheduled_time__lte=now
            ).select_related('issue', 'user')
            
            for rem in due_reminders:
                issue = rem.issue
                user = rem.user
                
                # Requirement 2: When reminder time is reached, log "REMINDER DUE - sending to user X"
                print(f"REMINDER DUE - sending to user {user.name}", flush=True)
                
                # Requirement 3: Use the standard send_notification_async for reminder
                if rem.notify_email or rem.notify_whatsapp:
                    extra = {'assignee_name': issue.assignee.name if issue.assignee else 'Unassigned'}
                    send_notification_async('reminder', issue, extra=extra)
                    print(f"[Reminder Worker] Notification dispatched via async worker", flush=True)
                else:
                    print(f"[Reminder Worker] No delivery methods requested for {user.name}", flush=True)

                # Requirement 5: After triggering, set triggered = True and save
                rem.triggered = True
                rem.save()
                
        except Exception as e:
            print(f"[Reminder Worker] Error in check loop: {e}", flush=True)
            
        # Run background GitHub sync every 60 seconds (every loop)
        try:
            sync_issues_with_github()
        except Exception as e:
            print(f"[GitHub Sync] Loop error: {e}", flush=True)
            
        counter += 1
        time.sleep(60) # run check every 60 seconds (runs every minute)

def start_reminder_worker():
    print("Reminder scheduler started", flush=True)
    t = threading.Thread(target=reminder_worker_loop, daemon=True)
    t.start()
