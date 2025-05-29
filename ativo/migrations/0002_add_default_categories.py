from django.db import migrations

def create_default_categories(apps, schema_editor):
    Categoria = apps.get_model('ativo', 'Categoria')
    
    # Define all categories
    categories = [
        # Renda Fixa
        {'tipo': 'RENDA_FIXA', 'subtipo': 'TESOURO_DIRETO', 'descricao': 'Títulos públicos federais'},
        {'tipo': 'RENDA_FIXA', 'subtipo': 'CDB', 'descricao': 'Certificado de Depósito Bancário'},
        {'tipo': 'RENDA_FIXA', 'subtipo': 'LCI_LCA', 'descricao': 'Letra de Crédito Imobiliário/Agronegócio'},
        {'tipo': 'RENDA_FIXA', 'subtipo': 'DEBENTURES', 'descricao': 'Títulos de dívida corporativa'},
        {'tipo': 'RENDA_FIXA', 'subtipo': 'CRI_CRA', 'descricao': 'Certificados de Recebíveis Imobiliários/Agronegócio'},
        {'tipo': 'RENDA_FIXA', 'subtipo': 'POUPANCA', 'descricao': 'Caderneta de Poupança'},
        
        # Renda Variável
        {'tipo': 'RENDA_VARIAVEL', 'subtipo': 'ACOES', 'descricao': 'Ações de empresas listadas'},
        {'tipo': 'RENDA_VARIAVEL', 'subtipo': 'FII', 'descricao': 'Fundos de Investimento Imobiliário'},
        {'tipo': 'RENDA_VARIAVEL', 'subtipo': 'ETFS', 'descricao': 'Exchange Traded Funds'},
        {'tipo': 'RENDA_VARIAVEL', 'subtipo': 'BDRS', 'descricao': 'Brazilian Depositary Receipts'},
        {'tipo': 'RENDA_VARIAVEL', 'subtipo': 'CRIPTO', 'descricao': 'Criptomoedas'},
        
        # Fundos de Investimento
        {'tipo': 'FUNDOS', 'subtipo': 'FUNDO_RF', 'descricao': 'Fundos de Renda Fixa'},
        {'tipo': 'FUNDOS', 'subtipo': 'FUNDO_MULTI', 'descricao': 'Fundos Multimercado'},
        {'tipo': 'FUNDOS', 'subtipo': 'FUNDO_ACOES', 'descricao': 'Fundos de Ações'},
        {'tipo': 'FUNDOS', 'subtipo': 'FUNDO_CAMBIAL', 'descricao': 'Fundos Cambiais'},
        {'tipo': 'FUNDOS', 'subtipo': 'FUNDO_IMOB', 'descricao': 'Fundos Imobiliários'},
        {'tipo': 'FUNDOS', 'subtipo': 'PREVIDENCIA', 'descricao': 'Previdência Privada'},
        
        # Investimentos no Exterior
        {'tipo': 'EXTERIOR', 'subtipo': 'ETF_INTER', 'descricao': 'ETFs Internacionais'},
        {'tipo': 'EXTERIOR', 'subtipo': 'ACOES_INTER', 'descricao': 'Ações Globais'},
        {'tipo': 'EXTERIOR', 'subtipo': 'FUNDOS_INTER', 'descricao': 'Fundos Globais'},
        {'tipo': 'EXTERIOR', 'subtipo': 'REITS', 'descricao': 'Real Estate Investment Trusts'},
    ]
    
    # Create all categories
    for category in categories:
        Categoria.objects.create(**category)

def remove_default_categories(apps, schema_editor):
    Categoria = apps.get_model('ativo', 'Categoria')
    Categoria.objects.all().delete()

class Migration(migrations.Migration):
    dependencies = [
        ('ativo', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(create_default_categories, remove_default_categories),
    ] 