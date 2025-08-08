from django.core.management.base import BaseCommand
from ativo.models import Ativo
from ativo.services import create_snapshot

class Command(BaseCommand):
    help = 'Create a snapshot for a single ativo'

    def add_arguments(self, parser):
        parser.add_argument('ticker', type=str, help='Ticker of the ativo')

    def handle(self, *args, **options):
        ticker = options['ticker']
        try:
            ativo = Ativo.objects.get(ticker=ticker)
            snapshot = create_snapshot(ativo)
            self.stdout.write(self.style.SUCCESS(f"Snapshot created for {ticker}: {snapshot}"))
        except Ativo.DoesNotExist:
            self.stdout.write(self.style.ERROR(f"Ativo with ticker {ticker} not found"))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error creating snapshot: {str(e)}"))