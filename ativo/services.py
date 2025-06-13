import yfinance as yf
from datetime import date
from decimal import Decimal
from django.db import transaction
from .models import Ativo, EvolucaoPatrimonial, Movimentacao, Dividendo
from .price_service import get_current_price
from .icon_service import fetch_ativo_icon
import pandas as pd
import os

def calculate_monthly_dividends(ativo: Ativo, snapshot_date: date) -> Decimal:
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

def calculate_current_quantity(ativo: Ativo) -> Decimal:
    """Calculate the current quantity of an asset based on movements."""
    movements = Movimentacao.objects.filter(ativo=ativo).order_by('data', 'dataCriacao')
    
    quantity = Decimal('0.00')
    
    print(f"Calculating quantity for {ativo.ticker}...")
    print(f"Found {movements.count()} movements")
    
    for movement in movements:
        if movement.operacao == 'COMPRA':
            quantity += movement.quantidade
            print(f"  COMPRA: +{movement.quantidade} = {quantity}")
        elif movement.operacao == 'VENDA':
            quantity -= movement.quantidade
            print(f"  VENDA: -{movement.quantidade} = {quantity}")
        elif movement.operacao == 'BONIFICACAO':
            quantity += movement.quantidade
            print(f"  BONIFICACAO: +{movement.quantidade} = {quantity}")
        elif movement.operacao == 'GRUPAMENTO':
            # In a grupamento, the quantity decreases but value per share increases
            # quantity = quantity / grupamento_ratio (e.g., 10:1 means divide by 10)
            # For now, we'll just add the quantity (which could be negative)
            quantity += movement.quantidade
            print(f"  GRUPAMENTO: {movement.quantidade:+} = {quantity}")
        elif movement.operacao == 'DESDOBRAMENTO':
            # In a desdobramento, the quantity increases but value per share decreases
            # quantity = quantity * desdobramento_ratio (e.g., 1:2 means multiply by 2)
            # For now, we'll just add the quantity
            quantity += movement.quantidade
            print(f"  DESDOBRAMENTO: +{movement.quantidade} = {quantity}")
    
    print(f"Final quantity for {ativo.ticker}: {quantity}")
    
    return quantity

def calculate_current_cost(ativo: Ativo) -> Decimal:
    """Calculate the current total cost of an asset based on movements."""
    movements = Movimentacao.objects.filter(ativo=ativo).order_by('data', 'dataCriacao')
    
    total_cost = Decimal('0.00')
    
    for movement in movements:
        if movement.operacao == 'COMPRA':
            total_cost += movement.custoTotal
        elif movement.operacao == 'VENDA':
            # For sales, we need to calculate the proportional cost reduction
            # This is simplified - in reality, you might want to use FIFO, LIFO, or average cost
            if movement.custoTotal > 0:
                total_cost -= movement.custoTotal
        # For other operations (bonificação, grupamento, desdobramento), 
        # we typically don't adjust the cost basis, but this depends on your accounting method
    
    return max(total_cost, Decimal('0.00'))  # Ensure non-negative

@transaction.atomic
def create_snapshot(ativo: Ativo, snapshot_date: date = None) -> EvolucaoPatrimonial:
    """Create a monthly snapshot of the current asset value (always first day of month)."""
    if snapshot_date is None:
        snapshot_date = date.today()
    
    # Convert to first day of the month for monthly snapshots
    monthly_date = snapshot_date.replace(day=1)
        
    try:
        # Get current price
        current_price = get_current_price(ativo)
        print(f"Fetched price for {ativo.ticker}: {current_price}")
        
        # Get current quantity
        quantidade = calculate_current_quantity(ativo)
        print(f"Calculated quantity for {ativo.ticker}: {quantidade}")
        
        # Only create snapshot if quantidade > 0
        if quantidade <= 0:
            print(f"Skipping monthly snapshot for {ativo.ticker} - quantidade <= 0")
            return None
        
        # Calculate total cost
        custo_total = calculate_current_cost(ativo)
        print(f"Calculated cost for {ativo.ticker}: {custo_total}")
        
        # Calculate monthly dividends
        dividendos_mes = calculate_monthly_dividends(ativo, monthly_date)
        print(f"Calculated monthly dividends for {ativo.ticker}: {dividendos_mes}")
        
        # Calculate total value
        valor_total = current_price * quantidade
        print(f"Will create monthly snapshot for {ativo.ticker} ({monthly_date.strftime('%m/%Y')}) with price={current_price}, quantidade={quantidade}, valor_total={valor_total}, dividendos={dividendos_mes}")
        
        # Create or update monthly snapshot (using first day of month)
        snapshot, created = EvolucaoPatrimonial.objects.update_or_create(
            ativo=ativo,
            data=monthly_date,
            defaults={
                'preco_atual': current_price.quantize(Decimal('0.01')),
                'quantidade': quantidade.quantize(Decimal('0.000001')),
                'valor_total': valor_total.quantize(Decimal('0.01')),
                'custo_total': custo_total,
                'dividendos_mes': dividendos_mes
            }
        )
        
        if created:
            print(f"Created new monthly snapshot for {ativo.ticker} ({monthly_date.strftime('%m/%Y')}) with ID {snapshot.id}")
        else:
            print(f"Updated monthly snapshot for {ativo.ticker} ({monthly_date.strftime('%m/%Y')}) with ID {snapshot.id}")
        
        # Verify the save
        snapshot.refresh_from_db()
        print(f"Verified snapshot: price={snapshot.preco_atual}, quantidade={snapshot.quantidade}, total={snapshot.valor_total}, dividendos={snapshot.dividendos_mes}")
        
        return snapshot
    except Exception as e:
        print(f"Error creating monthly snapshot for {ativo.ticker}: {str(e)}")
        raise

def create_snapshots_for_all_assets(snapshot_date: date = None, user = None):
    """Create monthly snapshots for all active assets with quantidade > 0."""
    if snapshot_date is None:
        snapshot_date = date.today()
    
    # Convert to first day of the month
    monthly_date = snapshot_date.replace(day=1)
    
    queryset = Ativo.objects.all()
    if user is not None:
        queryset = queryset.filter(usuario=user)
    
    print(f"Creating monthly snapshots for {monthly_date.strftime('%m/%Y')}")
        
    for ativo in queryset:
        try:
            quantidade = calculate_current_quantity(ativo)
            if quantidade > 0:
                create_snapshot(ativo, snapshot_date)
            else:
                print(f"Skipping snapshot for {ativo.ticker} - quantidade <= 0")
        except Exception as e:
            print(f"Error creating monthly snapshot for {ativo.ticker}: {str(e)}")

def import_dividendos_from_excel(file_path, user, stdout=None):
    """
    Import dividendos from an Excel file for a specific user.
    Returns a summary dict.
    """
    summary = {
        'created_dividendos': 0,
        'errors': [],
    }
    
    try:
        df = pd.read_excel(file_path)
        
        with transaction.atomic():
            for idx, row in df.iterrows():
                try:
                    # Extract ticker from 'Produto' column (format: "BBAS3 - BANCO DO BRASIL S/A")
                    produto = str(row['Produto']).strip()
                    ticker = produto.split(' - ')[0].strip() if ' - ' in produto else produto.strip()
                    
                    # Handle ticker normalization (remove 'F' suffix if present)
                    if ticker.endswith('F') and len(ticker) > 1:
                        ticker = ticker[:-1]
                    
                    # Parse date from 'Pagamento' column
                    data_pagamento = pd.to_datetime(row['Pagamento'], format='%d/%m/%Y').date()
                    
                    # Parse valor from 'Valor líquido' column
                    valor_liquido = str(row['Valor líquido']).replace(',', '.')
                    valor = Decimal(valor_liquido)
                    
                    # Find the ativo for this user
                    try:
                        ativo = Ativo.objects.get(ticker=ticker, usuario=user)
                    except Ativo.DoesNotExist:
                        summary['errors'].append(f'Row {idx + 1}: Ativo {ticker} não encontrado para o usuário')
                        if stdout:
                            stdout.write(f'Error: Ativo {ticker} not found for user')
                        continue
                    
                    # Create dividendo
                    dividendo, created = Dividendo.objects.get_or_create(
                        ativo=ativo,
                        data=data_pagamento,
                        valor=valor
                    )
                    
                    if created:
                        summary['created_dividendos'] += 1
                        if stdout:
                            stdout.write(f'Created dividendo: {ticker} - {data_pagamento} - {valor}')
                    else:
                        if stdout:
                            stdout.write(f'Dividendo already exists: {ticker} - {data_pagamento} - {valor}')
                    
                except Exception as e:
                    summary['errors'].append(f'Row {idx + 1}: {str(e)}')
                    if stdout:
                        stdout.write(f'Error processing row {idx + 1}: {str(e)}')
                    continue
    
    except Exception as e:
        summary['errors'].append(str(e))
        if stdout:
            stdout.write(f'Error reading file: {str(e)}')
    
    return summary 