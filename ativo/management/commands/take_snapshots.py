from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import date
from ativo.services import create_snapshots_for_all_assets

class Command(BaseCommand):
    help = 'Takes monthly snapshots of all assets current values (always on first day of month)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--year',
            type=int,
            help='Year for the monthly snapshot (default: current year)',
        )
        parser.add_argument(
            '--month',
            type=int,
            help='Month for the monthly snapshot (default: current month)',
        )
        parser.add_argument(
            '--year-month',
            type=str,
            help='Year and month in YYYY-MM format (ex: 2025-06)',
        )

    def handle(self, *args, **options):
        try:
            # Determine the snapshot date
            if options.get('year_month'):
                # Parse YYYY-MM format
                year_month = options['year_month']
                try:
                    year, month = map(int, year_month.split('-'))
                    snapshot_date = date(year, month, 1)
                except ValueError:
                    self.stdout.write(
                        self.style.ERROR('Invalid year-month format. Use YYYY-MM (ex: 2025-06)')
                    )
                    return
            elif options.get('year') or options.get('month'):
                # Use provided year/month or current values
                today = date.today()
                year = options.get('year', today.year)
                month = options.get('month', today.month)
                snapshot_date = date(year, month, 1)
            else:
                # Use current date (will be converted to first day of month)
                snapshot_date = date.today()
            
            # Convert to first day of month (just to be explicit)
            monthly_date = snapshot_date.replace(day=1)
            
            self.stdout.write(
                f'Creating monthly snapshots for {monthly_date.strftime("%B %Y")}...'
            )
            
            create_snapshots_for_all_assets(snapshot_date)
            
            self.stdout.write(
                self.style.SUCCESS(
                    f'Successfully created monthly snapshots for {monthly_date.strftime("%B %Y")}'
                )
            )
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Error creating monthly snapshots: {str(e)}')
            ) 