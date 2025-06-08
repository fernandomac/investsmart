from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import transaction
from ativo.models import Ativo, Movimentacao, Dividendo, EvolucaoPatrimonial
from decimal import Decimal
from datetime import date, datetime
import yfinance as yf
import pandas as pd
from dateutil.relativedelta import relativedelta

User = get_user_model()

class Command(BaseCommand):
    help = 'Create historical monthly snapshots starting from 2025-01-01 with historical prices'

    def add_arguments(self, parser):
        parser.add_argument(
            '--user-email',
            type=str,
            default='b3@teste.com',
            help='Email of the user to create snapshots for (default: b3@teste.com)',
        )
        parser.add_argument(
            '--start-date',
            type=str,
            default='2025-01-01',
            help='Start date in YYYY-MM-DD format (default: 2025-01-01)',
        )
        parser.add_argument(
            '--end-date',
            type=str,
            help='End date in YYYY-MM-DD format (default: current month)',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview what snapshots would be created without actually creating them',
        )

    def get_historical_price(self, ativo: Ativo, target_date: date) -> Decimal:
        """
        Fetch historical price for a given asset on a specific date.
        For variable income assets, fetches from yfinance.
        For fixed income assets, returns the average cost per unit up to that date.
        """
        try:
            # For fixed income assets, calculate the average cost per unit up to target date
            if ativo.categoria.tipo == 'RENDA_FIXA':
                movimentacoes = Movimentacao.objects.filter(
                    ativo=ativo,
                    data__lte=target_date
                ).order_by('data', 'dataCriacao')
                
                total_custo = Decimal('0.00')
                total_quantidade = Decimal('0.00')
                
                for mov in movimentacoes:
                    if mov.operacao == 'COMPRA':
                        total_custo += mov.custoTotal
                        total_quantidade += mov.quantidade
                    elif mov.operacao == 'VENDA':
                        total_custo -= mov.custoTotal
                        total_quantidade -= mov.quantidade
                
                # Return the average cost per unit, or 0 if no quantity
                if total_quantidade > 0:
                    return (total_custo / total_quantidade).quantize(Decimal('0.01'))
                return Decimal('0.00')
            
            # For variable income assets, fetch historical data from yfinance
            yahoo_ticker = ativo.ticker
            if ativo.moeda == 'BRL':
                # Brazilian stocks on B3
                yahoo_ticker = f"{ativo.ticker}.SA"
            elif ativo.moeda == 'GBP':
                # London Stock Exchange
                yahoo_ticker = f"{ativo.ticker}.L"
            
            # Get historical data for a range around the target date
            start_date = target_date - relativedelta(days=10)  # 10 days before
            end_date = target_date + relativedelta(days=5)     # 5 days after
            
            stock = yf.Ticker(yahoo_ticker)
            hist = stock.history(start=start_date, end=end_date)
            
            if hist.empty:
                self.stdout.write(f"  No historical data found for {yahoo_ticker}")
                # Try without suffix as fallback
                if yahoo_ticker != ativo.ticker:
                    stock = yf.Ticker(ativo.ticker)
                    hist = stock.history(start=start_date, end=end_date)
                
                if hist.empty:
                    self.stdout.write(f"  No historical data found for {ativo.ticker} either")
                    return Decimal('0.00')
            
            # Find the closest date to our target date
            hist.index = pd.to_datetime(hist.index).date
            available_dates = list(hist.index)
            
            # Find the closest date on or before the target date
            valid_dates = [d for d in available_dates if d <= target_date]
            
            if not valid_dates:
                # If no date on or before, take the first available date after
                valid_dates = [min(available_dates)]
            
            closest_date = max(valid_dates)  # Most recent date on or before target
            
            price = hist.loc[closest_date, 'Close']
            self.stdout.write(f"  Historical price for {ativo.ticker} on {target_date} (using {closest_date}): {price}")
            
            return Decimal(str(price))
            
        except Exception as e:
            self.stdout.write(f"  Error fetching historical price for {ativo.ticker} on {target_date}: {str(e)}")
            return Decimal('0.00')

    def calculate_quantity_at_date(self, ativo: Ativo, target_date: date) -> Decimal:
        """Calculate the quantity of an asset based on movements up to a specific date."""
        movements = Movimentacao.objects.filter(
            ativo=ativo,
            data__lte=target_date
        ).order_by('data', 'dataCriacao')
        
        quantity = Decimal('0.00')
        
        for movement in movements:
            if movement.operacao == 'COMPRA':
                quantity += movement.quantidade
            elif movement.operacao == 'VENDA':
                quantity -= movement.quantidade
            elif movement.operacao == 'BONIFICACAO':
                quantity += movement.quantidade
            elif movement.operacao == 'GRUPAMENTO':
                quantity += movement.quantidade
            elif movement.operacao == 'DESDOBRAMENTO':
                quantity += movement.quantidade
        
        return quantity

    def calculate_cost_at_date(self, ativo: Ativo, target_date: date) -> Decimal:
        """Calculate the total cost of an asset based on movements up to a specific date."""
        movements = Movimentacao.objects.filter(
            ativo=ativo,
            data__lte=target_date
        ).order_by('data', 'dataCriacao')
        
        total_cost = Decimal('0.00')
        
        for movement in movements:
            if movement.operacao == 'COMPRA':
                total_cost += movement.custoTotal
            elif movement.operacao == 'VENDA':
                if movement.custoTotal > 0:
                    total_cost -= movement.custoTotal
        
        return max(total_cost, Decimal('0.00'))

    def calculate_monthly_dividends(self, ativo: Ativo, snapshot_date: date) -> Decimal:
        """Calculate total dividends for an asset in a specific month."""
        year = snapshot_date.year
        month = snapshot_date.month
        
        # Get all dividends for this asset in the specified month
        monthly_dividends = Dividendo.objects.filter(
            ativo=ativo,
            data__year=year,
            data__month=month
        )
        
        total_dividends = sum(dividend.valor for dividend in monthly_dividends)
        return Decimal(str(total_dividends))

    def create_historical_snapshot(self, ativo: Ativo, snapshot_date: date, dry_run: bool = False):
        """Create a historical snapshot for a specific date."""
        # Convert to first day of the month for monthly snapshots
        monthly_date = snapshot_date.replace(day=1)
        
        try:
            # Get historical price
            historical_price = self.get_historical_price(ativo, snapshot_date)
            
            # Get quantity as of that date
            quantidade = self.calculate_quantity_at_date(ativo, snapshot_date)
            
            # Get cost as of that date
            custo_total = self.calculate_cost_at_date(ativo, snapshot_date)
            
            # Calculate monthly dividends
            dividendos_mes = self.calculate_monthly_dividends(ativo, monthly_date)
            
            # Skip if both price and quantity are 0
            if historical_price == Decimal('0.00') and quantidade == Decimal('0.00'):
                self.stdout.write(f"  Skipping {ativo.ticker} - no price or quantity")
                return None
            
            # Calculate total value
            valor_total = historical_price * quantidade
            
            snapshot_info = {
                'ticker': ativo.ticker,
                'date': monthly_date.strftime('%m/%Y'),
                'price': float(historical_price),
                'quantity': float(quantidade),
                'total_value': float(valor_total),
                'cost': float(custo_total),
                'dividends': float(dividendos_mes)
            }
            
            if dry_run:
                self.stdout.write(f"  [DRY RUN] Would create: {snapshot_info}")
                return snapshot_info
            
            # Create or update historical snapshot
            snapshot, created = EvolucaoPatrimonial.objects.update_or_create(
                ativo=ativo,
                data=monthly_date,
                defaults={
                    'preco_atual': historical_price.quantize(Decimal('0.01')),
                    'quantidade': quantidade.quantize(Decimal('0.000001')),
                    'valor_total': valor_total.quantize(Decimal('0.01')),
                    'custo_total': custo_total,
                    'dividendos_mes': dividendos_mes
                }
            )
            
            action = "Created" if created else "Updated"
            self.stdout.write(f"  {action} snapshot: {snapshot_info}")
            
            return snapshot
            
        except Exception as e:
            self.stdout.write(f"  Error creating snapshot for {ativo.ticker}: {str(e)}")
            return None

    def handle(self, *args, **options):
        user_email = options['user_email']
        start_date_str = options['start_date']
        end_date_str = options.get('end_date')
        dry_run = options['dry_run']
        
        try:
            # Get user
            user = User.objects.get(email=user_email)
            self.stdout.write(f'Creating historical snapshots for user: {user_email}')
            
            # Parse dates
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
            
            if end_date_str:
                end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
            else:
                end_date = date.today()
            
            # Ensure we use the first day of each month
            start_date = start_date.replace(day=1)
            end_date = end_date.replace(day=1)
            
            self.stdout.write(f'Date range: {start_date} to {end_date}')
            
            if dry_run:
                self.stdout.write(self.style.WARNING('DRY RUN MODE - No snapshots will be created'))
            
            # Get all assets for the user
            ativos = Ativo.objects.filter(usuario=user)
            self.stdout.write(f'Found {ativos.count()} assets for user')
            
            # Generate list of months to process
            current_date = start_date
            months_to_process = []
            
            while current_date <= end_date:
                months_to_process.append(current_date)
                current_date = current_date + relativedelta(months=1)
            
            self.stdout.write(f'Will process {len(months_to_process)} months: {[d.strftime("%m/%Y") for d in months_to_process]}')
            
            total_snapshots = 0
            
            # Process each month
            for month_date in months_to_process:
                self.stdout.write(f'\n📅 Processing {month_date.strftime("%B %Y")}...')
                
                month_snapshots = 0
                
                # For each asset, check if it had any movements by this date
                for ativo in ativos:
                    # Check if asset had any movements by this date
                    movements_count = Movimentacao.objects.filter(
                        ativo=ativo,
                        data__lte=month_date
                    ).count()
                    
                    if movements_count == 0:
                        continue  # Skip assets with no movements yet
                    
                    self.stdout.write(f'  Processing {ativo.ticker}...')
                    
                    snapshot = self.create_historical_snapshot(ativo, month_date, dry_run)
                    if snapshot:
                        month_snapshots += 1
                
                self.stdout.write(f'  ✅ {month_date.strftime("%B %Y")}: {month_snapshots} snapshots processed')
                total_snapshots += month_snapshots
            
            mode_text = " (DRY RUN)" if dry_run else ""
            self.stdout.write(
                self.style.SUCCESS(
                    f'\n🎉 Historical snapshots complete{mode_text}!\n'
                    f'Total snapshots processed: {total_snapshots}\n'
                    f'Months processed: {len(months_to_process)}\n'
                    f'User: {user_email}'
                )
            )
            
        except User.DoesNotExist:
            self.stdout.write(
                self.style.ERROR(f'User not found: {user_email}')
            )
        except ValueError as e:
            self.stdout.write(
                self.style.ERROR(f'Invalid date format: {str(e)}')
            )
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Error creating historical snapshots: {str(e)}')
            ) 