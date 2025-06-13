import requests
import re
from urllib.parse import urljoin, urlparse
from typing import Optional

def search_company_icon(ticker: str, company_name: str) -> Optional[str]:
    """
    Search for company icon using multiple strategies.
    Returns the icon URL if found, None otherwise.
    """
    
    # Strategy 1: Try Logo.dev API (free tier)
    try:
        logo_dev_url = f"https://img.logo.dev/{ticker.lower()}.com?token=pk_X-1ZO13ESEOdEyVKzKNfzQ"
        response = requests.head(logo_dev_url, timeout=5)
        if response.status_code == 200:
            return logo_dev_url
    except:
        pass
    
    # Strategy 2: Try Clearbit Logo API (free tier)
    try:
        # Extract domain from company name or use ticker
        domain_candidates = [
            f"{ticker.lower()}.com",
            f"{ticker.lower()}.com.br",
            f"{company_name.lower().replace(' ', '').replace('.', '')}.com",
        ]
        
        for domain in domain_candidates:
            clearbit_url = f"https://logo.clearbit.com/{domain}"
            response = requests.head(clearbit_url, timeout=5)
            if response.status_code == 200:
                return clearbit_url
    except:
        pass
    
    # Strategy 3: Try Brandfetch API (free tier)
    try:
        brandfetch_url = f"https://api.brandfetch.io/v2/brands/{ticker.lower()}.com"
        response = requests.get(brandfetch_url, timeout=5)
        if response.status_code == 200:
            data = response.json()
            if 'logos' in data and len(data['logos']) > 0:
                return data['logos'][0]['image']
    except:
        pass
    
    # Strategy 4: Try Yahoo Finance favicon
    try:
        yahoo_icon = f"https://s.yimg.com/cv/apiv2/social/images/yahoo_default_logo.png"
        # This is a fallback - in practice you'd want to scrape Yahoo Finance for the actual logo
        return None  # Skip this for now as it's not reliable
    except:
        pass
    
    return None

def get_brazilian_stock_icon(ticker: str) -> Optional[str]:
    """
    Get icon for Brazilian stocks using known mappings.
    """
    
    # Known Brazilian stock icons (you can expand this list)
    brazilian_icons = {
        'BBAS3': 'https://logoeps.com/wp-content/uploads/2013/03/banco-do-brasil-vector-logo.png',
        'ITUB4': 'https://logoeps.com/wp-content/uploads/2013/03/itau-vector-logo.png',
        'BBDC4': 'https://logoeps.com/wp-content/uploads/2013/03/bradesco-vector-logo.png',
        'PETR4': 'https://logoeps.com/wp-content/uploads/2013/03/petrobras-vector-logo.png',
        'VALE3': 'https://logoeps.com/wp-content/uploads/2013/03/vale-vector-logo.png',
        'WEGE3': 'https://logoeps.com/wp-content/uploads/2013/03/weg-vector-logo.png',
        'MGLU3': 'https://logoeps.com/wp-content/uploads/2013/03/magazine-luiza-vector-logo.png',
        'ABEV3': 'https://logoeps.com/wp-content/uploads/2013/03/ambev-vector-logo.png',
        'JBSS3': 'https://logoeps.com/wp-content/uploads/2013/03/jbs-vector-logo.png',
        'BRFS3': 'https://logoeps.com/wp-content/uploads/2013/03/brf-vector-logo.png',
    }
    
    return brazilian_icons.get(ticker.upper())

def fetch_ativo_icon(ticker: str, company_name: str, categoria_subtipo: str) -> str:
    """
    Main function to fetch ativo icon with multiple fallback strategies.
    Always returns a valid icon URL.
    """
    
    # Strategy 1: Try Brazilian stock icons first
    if ticker.endswith('3') or ticker.endswith('4') or ticker.endswith('11'):
        brazilian_icon = get_brazilian_stock_icon(ticker)
        if brazilian_icon:
            return brazilian_icon
    
    # Strategy 2: Try general company icon search
    company_icon = search_company_icon(ticker, company_name)
    if company_icon:
        return company_icon
    
    # Strategy 3: Fallback to category default icons
    category_icons = {
        # Renda Variável
        'ACOES': 'https://cdn-icons-png.flaticon.com/512/2830/2830284.png',  # Stock chart
        'FII': 'https://cdn-icons-png.flaticon.com/512/1077/1077976.png',   # Building
        'ETFS': 'https://cdn-icons-png.flaticon.com/512/2830/2830284.png',  # Stock chart
        'BDRS': 'https://cdn-icons-png.flaticon.com/512/2830/2830284.png',  # Stock chart
        'CRIPTO': 'https://cdn-icons-png.flaticon.com/512/5968/5968260.png', # Bitcoin
        
        # Renda Fixa
        'TESOURO_DIRETO': 'https://cdn-icons-png.flaticon.com/512/1077/1077114.png', # Government
        'CDB': 'https://cdn-icons-png.flaticon.com/512/1077/1077976.png',    # Bank
        'LCI_LCA': 'https://cdn-icons-png.flaticon.com/512/1077/1077976.png', # Bank
        'DEBENTURES': 'https://cdn-icons-png.flaticon.com/512/2830/2830284.png', # Chart
        'CRI_CRA': 'https://cdn-icons-png.flaticon.com/512/1077/1077976.png', # Building
        'POUPANCA': 'https://cdn-icons-png.flaticon.com/512/1077/1077976.png', # Bank
        
        # Fundos
        'FUNDO_RF': 'https://cdn-icons-png.flaticon.com/512/2830/2830284.png', # Chart
        'FUNDO_MULTI': 'https://cdn-icons-png.flaticon.com/512/2830/2830284.png', # Chart
        'FUNDO_ACOES': 'https://cdn-icons-png.flaticon.com/512/2830/2830284.png', # Chart
        'FUNDO_CAMBIAL': 'https://cdn-icons-png.flaticon.com/512/2830/2830284.png', # Chart
        'FUNDO_IMOB': 'https://cdn-icons-png.flaticon.com/512/1077/1077976.png', # Building
        'PREVIDENCIA': 'https://cdn-icons-png.flaticon.com/512/1077/1077114.png', # Shield
        
        # Exterior
        'ETF_INTER': 'https://cdn-icons-png.flaticon.com/512/2830/2830284.png', # Chart
        'ACOES_INTER': 'https://cdn-icons-png.flaticon.com/512/2830/2830284.png', # Chart
        'FUNDOS_INTER': 'https://cdn-icons-png.flaticon.com/512/2830/2830284.png', # Chart
        'REITS': 'https://cdn-icons-png.flaticon.com/512/1077/1077976.png', # Building
    }
    
    return category_icons.get(categoria_subtipo, 'https://cdn-icons-png.flaticon.com/512/2830/2830284.png') 