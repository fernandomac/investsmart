from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import transaction
from ativo.models import Ativo, Movimentacao, Categoria
from ativo.icon_service import fetch_ativo_icon
import pandas as pd
from datetime import datetime
from decimal import Decimal
import os

User = get_user_model()

def import_movimentacoes_from_excel(file_path, user, stdout=None):
    """
    Import movimentacoes and ativos from an Excel file for a specific user.
    Returns a summary dict.
    """
    summary = {
        'created_ativos': 0,
        'created_movimentacoes': 0,
        'errors': [],
    }
    try:
        df = pd.read_excel(file_path)
        with transaction.atomic():
            for idx, row in df.iterrows():
                try:
                    # Extract data from Excel columns
                    original_ticker = str(row['Código de Negociação']).strip()
                    ticker = original_ticker
                    if ticker.endswith('F') and len(ticker) > 1:
                        ticker = ticker[:-1]
                    company_name = row.get('nome') or ticker
                    # Category logic
                    if ticker.endswith('11'):
                        category = Categoria.objects.filter(tipo='RENDA_VARIAVEL', subtipo='FII').first()
                    else:
                        category = Categoria.objects.filter(tipo='RENDA_VARIAVEL', subtipo='ACOES').first()
                    if not category:
                        raise Exception('Categoria não encontrada')
                    data_negocio = pd.to_datetime(row['Data do Negócio'], format='%d/%m/%Y').date()
                    operacao = 'COMPRA' if row['Tipo de Movimentação'] == 'Compra' else 'VENDA'
                    quantidade = Decimal(str(row['Quantidade']))
                    preco = Decimal(str(row['Preço']))
                    valor_total = Decimal(str(row['Valor']))
                    valor_calculado = quantidade * preco
                    taxa = valor_total - valor_calculado if valor_total > valor_calculado else Decimal('0')
                    ativo, ativo_created = Ativo.objects.get_or_create(
                        ticker=ticker,
                        usuario=user,
                        defaults={
                            'nome': company_name,
                            'moeda': 'BRL',
                            'categoria': category,
                            'peso': Decimal('0'),
                        }
                    )
                    if ativo_created:
                        # Fetch and set icon for new ativo
                        try:
                            icon_url = fetch_ativo_icon(ticker, company_name, category.subtipo)
                            ativo.icone_url = icon_url
                            ativo.save()
                            if stdout:
                                stdout.write(f'  Set icon for {ticker}: {icon_url}')
                        except Exception as e:
                            if stdout:
                                stdout.write(f'  Warning: Could not fetch icon for {ticker}: {str(e)}')
                        summary['created_ativos'] += 1
                    Movimentacao.objects.create(
                        ativo=ativo,
                        data=data_negocio,
                        operacao=operacao,
                        quantidade=quantidade,
                        valorUnitario=preco,
                        taxa=taxa,
                    )
                    # Update ativo's quantidade and preco_medio after creating movimentacao
                    ativo.update_quantidade_preco_medio()
                    summary['created_movimentacoes'] += 1
                except Exception as e:
                    summary['errors'].append(f'Row {idx}: {str(e)}')
                    if stdout:
                        stdout.write(f'Error processing row {idx}: {str(e)}')
                    continue
    except Exception as e:
        summary['errors'].append(str(e))
        if stdout:
            stdout.write(f'Error reading file: {str(e)}')
    return summary

class Command(BaseCommand):
    help = 'Import ativos and movimentacoes from Excel file for a specific user'

    def add_arguments(self, parser):
        parser.add_argument(
            '--file',
            type=str,
            required=True,
            help='Path to the Excel file to import',
        )
        parser.add_argument(
            '--user-email',
            type=str,
            default='b3@teste.com',
            help='Email of the user to import data for (default: b3@teste.com)',
        )

    def get_ticker_name_mapping(self):
        """
        Mapping of Brazilian stock tickers to their company names.
        This can be extended with more tickers as needed.
        """
        return {
            # Bancos
            'BBAS3': 'Banco do Brasil S.A.',
            'ITUB4': 'Itaú Unibanco Holding S.A.',
            'BBDC4': 'Banco Bradesco S.A.',
            'SANB11': 'Banco Santander Brasil S.A.',
            'ITSA4': 'Itaúsa - Investimentos Itaú S.A.',
            
            # Energia
            'EGIE3': 'Engie Brasil Energia S.A.',
            'CPLE3': 'Copel - Companhia Paranaense de Energia',
            'TAEE3': 'Taesa - Transmissora Aliança de Energia Elétrica S.A.',
            'PETR4': 'Petróleo Brasileiro S.A. - Petrobras',
            'VALE3': 'Vale S.A.',
            
            # Indústria
            'WEGE3': 'WEG S.A.',
            'GOAU3': 'Metalúrgica Gerdau S.A.',
            'GOAU4': 'Metalúrgica Gerdau S.A.',
            'KLBN3': 'Klabin S.A.',
            'KLBN4': 'Klabin S.A.',
            'SUZB3': 'Suzano S.A.',
            'USIM5': 'Usinas Siderúrgicas de Minas Gerais S.A.',
            
            # Seguros/Previdência
            'PSSA3': 'Porto Seguro S.A.',
            
            # Logística/Transporte
            'TGMA3': 'Tegma Gestão Logística S.A.',
            'RAIL3': 'Rumo S.A.',
            
            # Varejo
            'MGLU3': 'Magazine Luiza S.A.',
            'VVAR3': 'Via S.A.',
            'LREN3': 'Lojas Renner S.A.',
            
            # Tecnologia
            'TOTS3': 'Totvs S.A.',
            'POSI3': 'Positivo Tecnologia S.A.',
            
            # Telecomunicações
            'VIVT3': 'Telefônica Brasil S.A.',
            'TIMS3': 'TIM S.A.',
            
            # Alimentação
            'BRFS3': 'BRF S.A.',
            'JBSS3': 'JBS S.A.',
            'MRFG3': 'Marfrig Global Foods S.A.',
            
            # Fundos Imobiliários (FII)
            'KNRI11': 'Kinea Renda Imobiliária Fundo de Investimento Imobiliário',
            'HGLG11': 'Cshg Logística Fundo de Investimento Imobiliário',
            'BTLG11': 'BTG Pactual Logística Fundo de Investimento Imobiliário',
            'XPML11': 'XP Malls Fundo de Investimento Imobiliário',
            'XPLG11': 'XP Log Fundo de Investimento Imobiliário',
            'CPTS11': 'Capitânia Securities Fundo de Investimento Imobiliário',
            'FGAA11': 'FGA Fundo de Investimento Imobiliário',
            'RBHY11': 'RBR Alpha High Yield Fundo de Investimento Imobiliário',
            'VGIP11': 'Valora Fundo de Investimento Imobiliário',
            'HCTR11': 'Hospital da Criança Fundo de Investimento Imobiliário',
            'IRDM11': 'Iridium Fundo de Investimento Imobiliário',
            'TECB11': 'TG Ativo Real Fundo de Investimento Imobiliário',
            'KNIP11': 'Kinea Índices de Preços Fundo de Investimento Imobiliário',
        }

    def get_company_name(self, ticker):
        """
        Get company name based on ticker. Returns the company name if found,
        otherwise returns the ticker itself.
        """
        mapping = self.get_ticker_name_mapping()
        return mapping.get(ticker, ticker)

    def is_fii(self, ticker):
        """
        Check if ticker is a FII (Fundo de Investimento Imobiliário).
        FIIs in Brazil typically end with '11'.
        """
        return ticker.endswith('11')

    def get_category_for_ticker(self, ticker):
        """
        Get the appropriate category based on ticker type.
        FIIs (ending in '11') get FII category, others get ACOES category.
        """
        if self.is_fii(ticker):
            try:
                return Categoria.objects.get(
                    tipo='RENDA_VARIAVEL',
                    subtipo='FII'
                )
            except Categoria.DoesNotExist:
                self.stdout.write(
                    self.style.WARNING(f'FII category not found, using ACOES for {ticker}')
                )
                return self.get_default_acoes_category()
        else:
            return self.get_default_acoes_category()

    def get_default_acoes_category(self):
        """
        Get the default ACOES category.
        """
        try:
            return Categoria.objects.get(
                tipo='RENDA_VARIAVEL',
                subtipo='ACOES'
            )
        except Categoria.DoesNotExist:
            raise Exception('Default category (RENDA_VARIAVEL - ACOES) not found')

    def normalize_ticker(self, ticker):
        """
        Normalize ticker by removing 'F' suffix for fractional shares.
        E.g., WEGE3F becomes WEGE3, EGIE3F becomes EGIE3
        """
        ticker = str(ticker).strip().upper()
        if ticker.endswith('F') and len(ticker) > 1:
            # Remove the 'F' suffix for fractional shares
            base_ticker = ticker[:-1]
            self.stdout.write(f'  Normalizing fractional ticker {ticker} to {base_ticker}')
            return base_ticker
        return ticker

    def handle(self, *args, **options):
        file_path = options['file']
        user_email = options['user_email']
        
        # Check if file exists
        if not os.path.exists(file_path):
            self.stdout.write(
                self.style.ERROR(f'File not found: {file_path}')
            )
            return
        
        try:
            # Get or create user
            user, created = User.objects.get_or_create(
                email=user_email,
                defaults={
                    'username': user_email.split('@')[0],
                    'first_name': 'B3',
                    'last_name': 'User',
                }
            )
            
            if created:
                self.stdout.write(
                    self.style.SUCCESS(f'Created user: {user_email}')
                )
            else:
                self.stdout.write(f'Found existing user: {user_email}')
            
            # Read Excel file
            self.stdout.write('Reading Excel file...')
            df = pd.read_excel(file_path)
            
            # Display file structure
            self.stdout.write(f'Excel columns: {list(df.columns)}')
            self.stdout.write(f'Total rows: {len(df)}')
            self.stdout.write('Sample data:')
            for idx, row in df.head(3).iterrows():
                self.stdout.write(f'  Row {idx}: {dict(row)}')
            
            # Start transaction
            with transaction.atomic():
                created_ativos = 0
                created_movimentacoes = 0
                
                # Process each row
                for idx, row in df.iterrows():
                    try:
                        # Extract data from Excel columns
                        original_ticker = str(row['Código de Negociação']).strip()
                        ticker = self.normalize_ticker(original_ticker)
                        company_name = self.get_company_name(ticker)
                        category = self.get_category_for_ticker(ticker)
                        data_negocio = pd.to_datetime(row['Data do Negócio'], format='%d/%m/%Y').date()
                        operacao = 'COMPRA' if row['Tipo de Movimentação'] == 'Compra' else 'VENDA'
                        quantidade = Decimal(str(row['Quantidade']))
                        preco = Decimal(str(row['Preço']))
                        valor_total = Decimal(str(row['Valor']))
                        
                        # Calculate taxa (fees) - assume it's the difference between calculated and actual value
                        valor_calculado = quantidade * preco
                        taxa = valor_total - valor_calculado if valor_total > valor_calculado else Decimal('0')
                        
                        category_display = f"({category.get_tipo_display()} - {category.get_subtipo_display()})"
                        self.stdout.write(f'Processing: {original_ticker} -> {ticker} {category_display} ({company_name}) - {operacao} - {quantidade} @ {preco}')
                        
                        # Get or create Ativo (using normalized ticker, company name, and appropriate category)
                        ativo, ativo_created = Ativo.objects.get_or_create(
                            ticker=ticker,
                            usuario=user,
                            defaults={
                                'nome': company_name,  # Use actual company name
                                'moeda': 'BRL',  # Default to BRL
                                'categoria': category,  # Use appropriate category (FII or ACOES)
                                'peso': Decimal('0'),
                            }
                        )
                        
                        if ativo_created:
                            created_ativos += 1
                            self.stdout.write(f'  Created ativo: {ticker} {category_display} - {company_name}')
                        
                        # Create Movimentacao
                        movimentacao = Movimentacao.objects.create(
                            ativo=ativo,
                            data=data_negocio,
                            operacao=operacao,
                            quantidade=quantidade,
                            valorUnitario=preco,
                            taxa=taxa,
                        )
                        created_movimentacoes += 1
                        
                        # Update ativo's quantidade and preco_medio after creating movimentacao
                        ativo.update_quantidade_preco_medio()
                        
                    except Exception as e:
                        self.stdout.write(
                            self.style.ERROR(f'Error processing row {idx}: {str(e)}')
                        )
                        continue
                
                self.stdout.write(
                    self.style.SUCCESS(
                        f'Successfully imported:\n'
                        f'  - {created_ativos} ativos created\n'
                        f'  - {created_movimentacoes} movimentacoes created\n'
                        f'  - For user: {user_email}'
                    )
                )
        
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Import failed: {str(e)}')
            ) 