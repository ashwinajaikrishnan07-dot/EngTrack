from django.apps import AppConfig


class IssuesConfig(AppConfig):
    name = 'issues'

    def ready(self):
        import sys
        if 'runserver' in sys.argv:
            from .reminder_worker import start_reminder_worker
            start_reminder_worker()

