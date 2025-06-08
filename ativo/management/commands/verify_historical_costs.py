from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from ativo.models import EvolucaoPatrimonial

User = get_user_model()

class Command(BaseCommand):
    help = 'Verify historical costs in snapshots'

    def add_arguments(self, parser):
        parser.add_argument(
            '--user-email',
            type=str,
            default='b3@teste.com',
            help='Email of the user to verify',
        )
        parser.add_argument(
            '--ticker',
            type=str,
            help='Specific ticker to check (optional)',
        )

    def handle(self, *args, **options):
        user_email = options['user_email']
        ticker = options.get('ticker')
        
        try:
            user = User.objects.get(email=user_email)
            
            snapshots = EvolucaoPatrimonial.objects.filter(ativo__usuario=user).order_by('data', 'ativo__ticker')
            
            if ticker:
                snapshots = snapshots.filter(ativo__ticker=ticker)
                self.stdout.write(f'📊 Historical costs for {ticker} ({user_email}):')
            else:
                self.stdout.write(f'📊 Historical costs verification for {user_email}:')
            
            self.stdout.write('')
            
            # Group by month and show cost evolution
            months = snapshots.values_list('data', flat=True).distinct().order_by('data')
            
            for month in months:
                month_snapshots = snapshots.filter(data=month).order_by('ativo__ticker')
                self.stdout.write(f'📅 {month.strftime("%B %Y")}:')
                
                for snapshot in month_snapshots:
                    if ticker or snapshot.ativo.ticker in ['KNRI11', 'BBAS3', 'WEGE3']:  # Show key examples
                        self.stdout.write(
                            f'  {snapshot.ativo.ticker}: '
                            f'{snapshot.quantidade} shares @ R$ {snapshot.preco_atual} = '
                            f'R$ {snapshot.valor_total:.2f} '
                            f'(Cost: R$ {snapshot.custo_total:.2f})'
                        )
                
                self.stdout.write('')
            
            # Summary by ticker if not filtered
            if not ticker:
                self.stdout.write('🔍 Cost Evolution Summary for Key Assets:')
                self.stdout.write('')
                
                key_tickers = ['KNRI11', 'BBAS3', 'WEGE3']
                for key_ticker in key_tickers:
                    ticker_snapshots = snapshots.filter(ativo__ticker=key_ticker).order_by('data')
                    if ticker_snapshots.exists():
                        self.stdout.write(f'📈 {key_ticker} Cost Evolution:')
                        for snapshot in ticker_snapshots:
                            self.stdout.write(
                                f'  {snapshot.data.strftime("%m/%Y")}: R$ {snapshot.custo_total:.2f}'
                            )
                        self.stdout.write('')
            
            self.stdout.write('✅ Historical costs verification complete!')
            
        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'User not found: {user_email}')) 