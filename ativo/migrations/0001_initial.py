# Generated by Django 5.2.1 on 2025-05-28 11:01

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='Categoria',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('tipo', models.CharField(choices=[('RENDA_FIXA', 'Renda Fixa'), ('RENDA_VARIAVEL', 'Renda Variável'), ('FUNDOS', 'Fundos de Investimento'), ('EXTERIOR', 'Investimentos no Exterior')], max_length=20)),
                ('subtipo', models.CharField(choices=[('TESOURO_DIRETO', 'Tesouro Direto'), ('CDB', 'CDB'), ('LCI_LCA', 'LCI/LCA'), ('DEBENTURES', 'Debêntures'), ('CRI_CRA', 'CRI/CRA'), ('POUPANCA', 'Poupança'), ('ACOES', 'Ações'), ('FII', 'FII'), ('ETFS', 'ETFs'), ('BDRS', 'BDRs'), ('CRIPTO', 'Criptomoedas'), ('FUNDO_RF', 'Fundos de Renda Fixa'), ('FUNDO_MULTI', 'Fundos Multimercado'), ('FUNDO_ACOES', 'Fundos de Ações'), ('FUNDO_CAMBIAL', 'Fundos Cambiais'), ('FUNDO_IMOB', 'Fundos Imobiliários'), ('PREVIDENCIA', 'Previdência Privada'), ('ETF_INTER', 'ETFs Internacionais'), ('ACOES_INTER', 'Ações Globais'), ('FUNDOS_INTER', 'Fundos Globais'), ('REITS', 'REITs')], max_length=20)),
                ('descricao', models.TextField(blank=True)),
                ('dataCriacao', models.DateTimeField(auto_now_add=True)),
                ('dataAlteracao', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Categoria',
                'verbose_name_plural': 'Categorias',
            },
        ),
        migrations.CreateModel(
            name='Ativo',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('ticker', models.CharField(max_length=20, unique=True)),
                ('nome', models.CharField(max_length=200)),
                ('moeda', models.CharField(choices=[('BRL', 'Real'), ('USD', 'Dólar Americano'), ('EUR', 'Euro'), ('GBP', 'Libra Esterlina')], default='BRL', max_length=3)),
                ('dataCriacao', models.DateTimeField(auto_now_add=True)),
                ('dataAlteracao', models.DateTimeField(auto_now=True)),
                ('categoria', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to='ativo.categoria')),
            ],
            options={
                'verbose_name': 'Ativo',
                'verbose_name_plural': 'Ativos',
            },
        ),
    ]
