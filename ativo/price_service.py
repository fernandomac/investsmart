from decimal import Decimal
import yfinance as yf
from django.utils import timezone
import logging
from typing import Tuple

logger = logging.getLogger(__name__)

def get_current_price(ticker: str, moeda: str = 'BRL') -> Tuple[Decimal, bool]:
    """
    Get current price for a ticker, using cache if available.
    Returns (price, is_estimado) tuple.
    """
    from .models import PrecoCache  # Import here to avoid circular import

    # Try to get from cache first
    cached_price, is_estimado = PrecoCache.get_cached_price(ticker, moeda)
    if cached_price is not None:
        return cached_price, is_estimado

    try:
        # If not in cache or expired, fetch from yfinance
        stock = yf.Ticker(ticker)
        info = stock.info

        # Get price based on currency
        if moeda == 'BRL':
            price = info.get('regularMarketPrice') or info.get('currentPrice')
        else:
            # For other currencies, try to get the price in that currency
            price = info.get(f'regularMarketPrice_{moeda}') or info.get(f'currentPrice_{moeda}')

        if price is None:
            # If price not found in the desired currency, try to convert from USD
            usd_price = info.get('regularMarketPrice') or info.get('currentPrice')
            if usd_price is not None:
                # TODO: Implement currency conversion
                # For now, just use USD price and mark as estimated
                price = usd_price
                is_estimado = True
            else:
                raise ValueError(f"Could not find price for {ticker}")

        # Convert to Decimal and update cache
        price_decimal = Decimal(str(price))
        PrecoCache.update_cache(ticker, moeda, price_decimal, is_estimado)
        return price_decimal, is_estimado

    except Exception as e:
        logger.error(f"Error fetching price for {ticker}: {str(e)}")
        # If there's an error, try to get the last known price from cache
        cached_price, is_estimado = PrecoCache.get_cached_price(ticker, moeda)
        if cached_price is not None:
            return cached_price, True  # Mark as estimated since we're using old data
        raise 