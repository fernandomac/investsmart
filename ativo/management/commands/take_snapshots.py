from django.core.management.base import BaseCommand
from django.utils import timezone
from ativo.services import create_snapshots_for_all_assets

class Command(BaseCommand):
    help = 'Takes a snapshot of all assets current values'

    def handle(self, *args, **options):
        try:
            create_snapshots_for_all_assets()
            self.stdout.write(self.style.SUCCESS('Successfully created snapshots'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error creating snapshots: {str(e)}')) 