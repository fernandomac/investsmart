import yfinance as yf
from decimal import Decimal
from .models import Ativo, Movimentacao

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