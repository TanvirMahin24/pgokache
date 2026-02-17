from django.apps import AppConfig
import os
import sys


class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core'

    def ready(self):
        if os.getenv('DJANGO_RUN_SCHEDULER', '1') != '1':
            return
        blocked_cmds = {'makemigrations', 'migrate', 'collectstatic', 'test', 'shell'}
        if any(cmd in sys.argv for cmd in blocked_cmds):
            return
        from .scheduler import start_scheduler

        start_scheduler()
