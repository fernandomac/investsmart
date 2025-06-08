from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from ativo.models import Ativo, Movimentacao
from decimal import Decimal

User = get_user_model()

class Command(BaseCommand):
    help = 'Show portfolio summary for a specific user'

    def add_arguments(self, parser):
        parser.add_argument(
            '--user-email',
            type=str,
            required=True,
            help='Email of the user to show portfolio for',
        )

    def handle(self, *args, **options):
        user_email = options['user_email']
        
        try:
            user = User.objects.get(email=user_email)
        except User.DoesNotExist:
            self.stdout.write(
                self.style.ERROR(f'User not found: {user_email}')
            )
            return
        
        self.stdout.write(f'📊 Final Portfolio for {user.email}:')
        self.stdout.write(f'Total Assets: {user.ativos.count()}')
        self.stdout.write('')
        
        self.stdout.write('🏢 Assets with Company Names:')
        for ativo in user.ativos.all().order_by('ticker'):
            self.stdout.write(f'  - {ativo.ticker}: {ativo.nome}')
        
        self.stdout.write('')
        
        movs = Movimentacao.objects.filter(ativo__usuario=user)
        self.stdout.write(f'📈 Total Transactions: {movs.count()}')
        self.stdout.write('')
        
        self.stdout.write('💼 Portfolio Summary by Asset:')
        for ativo in user.ativos.all().order_by('ticker'):
            asset_movs = movs.filter(ativo=ativo)
            compras = asset_movs.filter(operacao='COMPRA')
            vendas = asset_movs.filter(operacao='VENDA')
            
            qty_compra = sum(m.quantidade for m in compras)
            qty_venda = sum(m.quantidade for m in vendas)
            net_qty = qty_compra - qty_venda
            
            self.stdout.write(f'  {ativo.ticker}: {net_qty} shares (Buy: {qty_compra}, Sell: {qty_venda}) - {asset_movs.count()} transactions')
        
        self.stdout.write('')
        self.stdout.write('✅ Portfolio summary complete!') 