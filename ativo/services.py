import yfinance as yf
from datetime import date
from decimal import Decimal
from django.db import transaction
from .models import Ativo, EvolucaoPatrimonial, Movimentacao

def get_current_price(ativo: Ativo) -> Decimal:
    """
    Fetch current price for a given asset.
    For variable income assets (stocks, ETFs, BDRs, etc), fetches from yfinance.
    For fixed income assets, returns the average cost per unit.
    """
    try:
        # For fixed income assets, calculate the average cost per unit
        if ativo.categoria.tipo == 'RENDA_FIXA':
            movimentacoes = Movimentacao.objects.filter(ativo=ativo)
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
        
        # For variable income assets, fetch from yfinance
        yahoo_ticker = ativo.ticker
        if ativo.moeda == 'BRL':
            # Brazilian stocks on B3
            yahoo_ticker = f"{ativo.ticker}.SA"
        elif ativo.moeda == 'GBP':
            # London Stock Exchange
            yahoo_ticker = f"{ativo.ticker}.L"
        
        stock = yf.Ticker(yahoo_ticker)
        current_price = stock.info.get('regularMarketPrice')
        
        if current_price is None:
            # Try without suffix as fallback
            if yahoo_ticker != ativo.ticker:
                stock = yf.Ticker(ativo.ticker)
                current_price = stock.info.get('regularMarketPrice')
            
            if current_price is None:
                raise ValueError(f"Could not fetch price for {yahoo_ticker} or {ativo.ticker}")
                
        return Decimal(str(current_price))
    except Exception as e:
        print(f"Error fetching price for {ativo.ticker}: {str(e)}")
        return Decimal('0.00')

def calculate_current_quantity(ativo: Ativo) -> Decimal:
    """Calculate current quantity of an asset based on all movements."""
    movimentacoes = Movimentacao.objects.filter(ativo=ativo)
    quantidade = Decimal('0.00')
    
    print(f"Calculating quantity for {ativo.ticker}...")
    print(f"Found {movimentacoes.count()} movements")
    
    for mov in movimentacoes:
        if mov.operacao == 'COMPRA':
            quantidade += mov.quantidade
            print(f"  COMPRA: +{mov.quantidade} = {quantidade}")
        elif mov.operacao == 'VENDA':
            quantidade -= mov.quantidade
            print(f"  VENDA: -{mov.quantidade} = {quantidade}")
        elif mov.operacao in ['GRUPAMENTO', 'DESDOBRAMENTO']:
            quantidade = mov.quantidade
            print(f"  {mov.operacao}: ={mov.quantidade}")
            
    print(f"Final quantity for {ativo.ticker}: {quantidade}")
    return quantidade

def calculate_current_cost(ativo: Ativo) -> Decimal:
    """Calculate the total cost of current holdings."""
    movimentacoes = Movimentacao.objects.filter(ativo=ativo)
    total_custo = Decimal('0.00')
    total_quantidade = Decimal('0.00')
    
    for mov in movimentacoes:
        if mov.operacao == 'COMPRA':
            total_custo += mov.custoTotal
            total_quantidade += mov.quantidade
        elif mov.operacao == 'VENDA':
            # For sales, reduce cost proportionally
            if total_quantidade > 0:
                custo_por_unidade = total_custo / total_quantidade
                total_custo -= custo_por_unidade * mov.quantidade
            total_quantidade -= mov.quantidade
    
    return total_custo.quantize(Decimal('0.01'))

@transaction.atomic
def create_snapshot(ativo: Ativo, snapshot_date: date = None) -> EvolucaoPatrimonial:
    """Create a snapshot of the current asset value."""
    if snapshot_date is None:
        snapshot_date = date.today()
        
    try:
        # Get current price
        current_price = get_current_price(ativo)
        print(f"Fetched price for {ativo.ticker}: {current_price}")
        
        # Get current quantity
        quantidade = calculate_current_quantity(ativo)
        print(f"Calculated quantity for {ativo.ticker}: {quantidade}")
        
        # Calculate total cost
        custo_total = calculate_current_cost(ativo)
        print(f"Calculated cost for {ativo.ticker}: {custo_total}")
        
        # Skip if both price and quantity are 0
        if current_price == Decimal('0.00') and quantidade == Decimal('0.00'):
            print(f"Skipping snapshot for {ativo.ticker} - no price or quantity")
            return None
        
        # Calculate total value
        valor_total = current_price * quantidade
        print(f"Will create snapshot for {ativo.ticker} with price={current_price}, quantidade={quantidade}, valor_total={valor_total}")
        
        # Create or update snapshot with explicit save
        snapshot, created = EvolucaoPatrimonial.objects.update_or_create(
            ativo=ativo,
            data=snapshot_date,
            defaults={
                'preco_atual': current_price.quantize(Decimal('0.01')),
                'quantidade': quantidade.quantize(Decimal('0.000001')),
                'valor_total': valor_total.quantize(Decimal('0.01')),
                'custo_total': custo_total
            }
        )
        
        if created:
            print(f"Created new snapshot for {ativo.ticker} with ID {snapshot.id}")
        else:
            print(f"Updated snapshot for {ativo.ticker} with ID {snapshot.id}")
        
        # Verify the save
        snapshot.refresh_from_db()
        print(f"Verified snapshot: price={snapshot.preco_atual}, quantidade={snapshot.quantidade}, total={snapshot.valor_total}")
        
        return snapshot
    except Exception as e:
        print(f"Error creating snapshot for {ativo.ticker}: {str(e)}")
        raise

def create_snapshots_for_all_assets(snapshot_date: date = None, user = None):
    """Create snapshots for all active assets."""
    queryset = Ativo.objects.all()
    if user is not None:
        queryset = queryset.filter(usuario=user)
        
    for ativo in queryset:
        try:
            create_snapshot(ativo, snapshot_date)
        except Exception as e:
            print(f"Error creating snapshot for {ativo.ticker}: {str(e)}") 