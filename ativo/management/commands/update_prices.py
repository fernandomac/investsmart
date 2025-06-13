from django.core.management.base import BaseCommand
from ativo.models import Ativo
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Updates prices for all ativos'

    def handle(self, *args, **options):
        ativos = Ativo.objects.all()
        total = ativos.count()
        updated = 0
        errors = 0

        self.stdout.write(f"Starting price update for {total} ativos...")

        for ativo in ativos:
            try:
                ativo.update_valor_atual()
                updated += 1
                if updated % 10 == 0:
                    self.stdout.write(f"Updated {updated}/{total} ativos...")
            except Exception as e:
                errors += 1
                logger.error(f"Error updating {ativo.ticker}: {str(e)}")

        self.stdout.write(self.style.SUCCESS(
            f"Price update completed. Updated {updated} ativos, {errors} errors."
        )) 