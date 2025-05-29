from django.db import models
from django.conf import settings

# Create your models here.

class Categoria(models.Model):
    TIPO_CHOICES = [
        ('RENDA_FIXA', 'Renda Fixa'),
        ('RENDA_VARIAVEL', 'Renda Variável'),
        ('FUNDOS', 'Fundos de Investimento'),
        ('EXTERIOR', 'Investimentos no Exterior'),
    ]

    SUBTIPO_CHOICES = [
        # Renda Fixa
        ('TESOURO_DIRETO', 'Tesouro Direto'),
        ('CDB', 'CDB'),
        ('LCI_LCA', 'LCI/LCA'),
        ('DEBENTURES', 'Debêntures'),
        ('CRI_CRA', 'CRI/CRA'),
        ('POUPANCA', 'Poupança'),
        
        # Renda Variável
        ('ACOES', 'Ações'),
        ('FII', 'FII'),
        ('ETFS', 'ETFs'),
        ('BDRS', 'BDRs'),
        ('CRIPTO', 'Criptomoedas'),
        
        # Fundos de Investimento
        ('FUNDO_RF', 'Fundos de Renda Fixa'),
        ('FUNDO_MULTI', 'Fundos Multimercado'),
        ('FUNDO_ACOES', 'Fundos de Ações'),
        ('FUNDO_CAMBIAL', 'Fundos Cambiais'),
        ('FUNDO_IMOB', 'Fundos Imobiliários'),
        ('PREVIDENCIA', 'Previdência Privada'),
        
        # Investimentos no Exterior
        ('ETF_INTER', 'ETFs Internacionais'),
        ('ACOES_INTER', 'Ações Globais'),
        ('FUNDOS_INTER', 'Fundos Globais'),
        ('REITS', 'REITs'),
    ]

    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES)
    subtipo = models.CharField(max_length=20, choices=SUBTIPO_CHOICES)
    descricao = models.TextField(blank=True)
    dataCriacao = models.DateTimeField(auto_now_add=True)
    dataAlteracao = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Categoria'
        verbose_name_plural = 'Categorias'

    def __str__(self):
        return f"{self.get_tipo_display()} - {self.get_subtipo_display()}"

class Ativo(models.Model):
    MOEDA_CHOICES = [
        ('BRL', 'Real'),
        ('USD', 'Dólar Americano'),
        ('EUR', 'Euro'),
        ('GBP', 'Libra Esterlina'),
    ]

    ticker = models.CharField(max_length=20)
    nome = models.CharField(max_length=200)
    moeda = models.CharField(max_length=3, choices=MOEDA_CHOICES, default='BRL')
    categoria = models.ForeignKey(Categoria, on_delete=models.PROTECT)
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='ativos')
    dataCriacao = models.DateTimeField(auto_now_add=True)
    dataAlteracao = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Ativo'
        verbose_name_plural = 'Ativos'
        unique_together = ['ticker', 'usuario']

    def __str__(self):
        return f"{self.ticker} - {self.nome}"

class Movimentacao(models.Model):
    OPERACAO_CHOICES = [
        ('COMPRA', 'Compra'),
        ('VENDA', 'Venda'),
        ('BONIFICACAO', 'Bonificação'),
        ('GRUPAMENTO', 'Grupamento'),
        ('DESDOBRAMENTO', 'Desdobramento'),
    ]

    ativo = models.ForeignKey(Ativo, on_delete=models.PROTECT)
    data = models.DateField()
    operacao = models.CharField(max_length=20, choices=OPERACAO_CHOICES)
    quantidade = models.DecimalField(max_digits=15, decimal_places=6)
    valorUnitario = models.DecimalField(max_digits=15, decimal_places=2)
    taxa = models.DecimalField(max_digits=15, decimal_places=2)
    custoTotal = models.DecimalField(max_digits=15, decimal_places=2)
    dataCriacao = models.DateTimeField(auto_now_add=True)
    dataAlteracao = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        # Calculate custoTotal before saving
        self.custoTotal = (self.quantidade * self.valorUnitario) + self.taxa
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.ativo.ticker} - {self.get_operacao_display()} - {self.data}"

    class Meta:
        ordering = ['-data', '-dataCriacao']
