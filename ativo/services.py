import yfinance as yf
from datetime import date, datetime, timedelta
from decimal import Decimal
from django.db import transaction
from .models import Ativo, EvolucaoPatrimonial, Movimentacao, Dividendo, Snapshot, PrecoCache
from .icon_service import fetch_ativo_icon
import pandas as pd
import os
from django.utils import timezone
import logging
from typing import Tuple, Optional, List, Dict, Any
import requests
from django.db.models import Sum, F, ExpressionWrapper, FloatField, Case, When, Value
from django.db.models.functions import Coalesce
from .types import PrecoInfo, AtivoInfo
from django.db.utils import OperationalError
import time

logger = logging.getLogger(__name__)

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

def create_snapshot(ativo: Ativo) -> Snapshot:
    """Create a snapshot of the current state of an asset"""
    try:
        current_price, is_estimated = ativo.get_current_price()
        snapshot, created = Snapshot.objects.update_or_create(
            ativo=ativo,
            data=timezone.now().date(),
            defaults={
                'preco': current_price,
                'quantidade': ativo.quantidade,
                'valor_total': ativo.valor_atual,
                'is_preco_estimado': is_estimated
            }
        )
        # Create an EvolucaoPatrimonial instance with the snapshot data
        EvolucaoPatrimonial.objects.create(
            ativo=ativo,
            data=snapshot.data,
            preco_atual=snapshot.preco,
            quantidade=snapshot.quantidade,
            valor_total=snapshot.valor_total,
            custo_total=calculate_current_cost(ativo),
            dividendos_mes=0  # This will be calculated later if needed
        )
        logger.info(f"Snapshot created: {snapshot}")
        return snapshot
    except Exception as e:
        logger.error(f"Error creating snapshot for {ativo.ticker}: {str(e)}")
        raise

def create_snapshots_for_all_assets(snapshot_date=None, user=None):
    """Create snapshots for all assets for a given date and user (optional)."""
    if snapshot_date is None:
        snapshot_date = timezone.now().date()
    if user:
        ativos = Ativo.objects.filter(usuario=user)
    else:
        ativos = Ativo.objects.all()
    for ativo in ativos:
        try:
            create_snapshot(ativo)
        except Exception as e:
            logger.error(f"Error creating snapshot for {ativo.ticker}: {str(e)}")
            continue

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

def get_current_price(ticker: str, moeda: str = 'BRL') -> Tuple[Decimal, bool]:
    """Obtém o preço atual de um ativo."""
    try:
        # Tenta obter do cache primeiro
        cache = PrecoCache.objects.filter(
            ticker=ticker,
            moeda=moeda,
            data_atualizacao__gte=timezone.now() - timedelta(minutes=60)
        ).first()
        
        if cache:
            return cache.preco, cache.is_estimado
            
        # Se não estiver em cache, busca do Yahoo Finance
        if moeda == 'BRL':
            ticker = f"{ticker}.SA"
            
        stock = yf.Ticker(ticker)
        info = stock.info
        
        if not info or 'regularMarketPrice' not in info:
            return Decimal('0'), True  # Preço estimado se não conseguir obter
            
        preco = Decimal(str(info['regularMarketPrice']))
        
        # Tenta atualizar o cache com retries
        max_retries = 3
        retry_delay = 0.1  # 100ms
        
        for attempt in range(max_retries):
            try:
                with transaction.atomic():
                    PrecoCache.objects.update_or_create(
                        ticker=ticker.replace('.SA', ''),
                        moeda=moeda,
                        defaults={
                            'preco': preco,
                            'is_estimado': False  # Preço real do Yahoo Finance
                        }
                    )
                break
            except OperationalError as e:
                if attempt == max_retries - 1:  # Last attempt
                    print(f"Erro ao atualizar cache para {ticker} após {max_retries} tentativas: {str(e)}")
                    return preco, False  # Return the price anyway, even if cache update failed
                time.sleep(retry_delay)
                retry_delay *= 2  # Exponential backoff
        
        return preco, False  # Preço real do Yahoo Finance
        
    except Exception as e:
        print(f"Erro ao obter preço de {ticker}: {str(e)}")
        return Decimal('0'), True  # Preço estimado em caso de erro 