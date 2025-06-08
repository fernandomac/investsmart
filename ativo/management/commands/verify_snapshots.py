from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from ativo.models import EvolucaoPatrimonial

User = get_user_model()

class Command(BaseCommand):
    help = 'Verify historical snapshots for a user'

    def add_arguments(self, parser):
        parser.add_argument(
            '--user-email',
            type=str,
            default='b3@teste.com',
            help='Email of the user to verify snapshots for',
        )

    def handle(self, *args, **options):
        user_email = options['user_email']
        
        try:
            user = User.objects.get(email=user_email)
            snapshots = EvolucaoPatrimonial.objects.filter(ativo__usuario=user).order_by('data', 'ativo__ticker')
            
            self.stdout.write(f'📊 Total snapshots for {user_email}: {snapshots.count()}')
            self.stdout.write('')
            
            # Group by month
            months = snapshots.values_list('data', flat=True).distinct().order_by('data')
            self.stdout.write(f'📅 Months covered: {len(months)}')
            
            for month in months:
                month_snapshots = snapshots.filter(data=month)
                self.stdout.write(f'  {month.strftime("%m/%Y")}: {month_snapshots.count()} snapshots')
            
            self.stdout.write('')
            self.stdout.write('🏢 KNRI11 Portfolio Evolution:')
            
            knri_snapshots = snapshots.filter(ativo__ticker='KNRI11').order_by('data')
            for snap in knri_snapshots:
                self.stdout.write(
                    f'  {snap.data.strftime("%m/%Y")}: {snap.quantidade} shares @ '
                    f'R$ {snap.preco_atual} = R$ {snap.valor_total:.2f}'
                )
            
            self.stdout.write('')
            self.stdout.write('📈 Sample June 2025 Portfolio Values:')
            
            june_snapshots = snapshots.filter(data__year=2025, data__month=6).order_by('-valor_total')[:5]
            for snap in june_snapshots:
                self.stdout.write(
                    f'  {snap.ativo.ticker}: {snap.quantidade} shares @ '
                    f'R$ {snap.preco_atual} = R$ {snap.valor_total:.2f}'
                )
            
            self.stdout.write('')
            self.stdout.write('✅ Historical snapshots verification complete!')
            
        except User.DoesNotExist:
            self.stdout.write(
                self.style.ERROR(f'User not found: {user_email}')
            ) 