from django.db import models
from django.conf import settings
from django.utils import timezone
from decimal import Decimal, ROUND_HALF_UP
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.core.validators import MinValueValidator
import yfinance as yf
import logging
from typing import Optional, Tuple

logger = logging.getLogger(__name__)

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

    tipo = models.CharField(max_length=50)
    subtipo = models.CharField(max_length=50)
    descricao = models.TextField(blank=True)
    dataCriacao = models.DateTimeField(auto_now_add=True)
    dataAlteracao = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Categoria'
        verbose_name_plural = 'Categorias'
        unique_together = ('tipo', 'subtipo')

    def __str__(self):
        return f"{self.tipo} - {self.subtipo}"

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
    categoria = models.ForeignKey(Categoria, on_delete=models.CASCADE)
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='ativos')
    peso = models.DecimalField(max_digits=5, decimal_places=2, default=0, help_text='Porcentagem desejada do total (0-100)')
    quantidade = models.DecimalField(max_digits=15, decimal_places=6, default=0, help_text='Quantidade atual do ativo')
    preco_medio = models.DecimalField(max_digits=15, decimal_places=6, default=0, help_text='Preço médio atual do ativo')
    dataVencimento = models.DateField(null=True, blank=True, help_text='Data de vencimento para investimentos de renda fixa')
    anotacao = models.TextField(blank=True, help_text='Anotações gerais sobre o ativo')
    icone_url = models.URLField(blank=True, null=True, help_text='URL do ícone do ativo')
    icone_url = models.URLField(blank=True, null=True, help_text='URL do ícone do ativo')
    dataCriacao = models.DateTimeField(auto_now_add=True)
    dataAlteracao = models.DateTimeField(auto_now=True)
    valor_atual = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    rendimento = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    is_preco_estimado = models.BooleanField(default=False)

    class Meta:
        verbose_name = 'Ativo'
        verbose_name_plural = 'Ativos'
        unique_together = ['ticker', 'usuario']

    def __str__(self):
        return f"{self.ticker} - {self.nome}"
    
    def get_icon_url(self):
        """Get icon URL with fallback to category default"""
        if self.icone_url:
            return self.icone_url
        
        # Default icons based on category
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
        
        return category_icons.get(self.categoria.subtipo, 'https://cdn-icons-png.flaticon.com/512/2830/2830284.png')

    def update_quantidade_preco_medio(self):
        """
        Atualiza a quantidade e o preço médio do ativo com base nas movimentações.
        """
        movs = self.movimentacao_set.order_by('data', 'dataCriacao')
        quantidade = Decimal('0')
        total_custo = Decimal('0')
        for mov in movs:
            if mov.operacao == 'COMPRA':
                total_custo += mov.quantidade * mov.valorUnitario + mov.taxa
                quantidade += mov.quantidade
            elif mov.operacao == 'VENDA':
                if quantidade > 0:
                    # Proporcionalmente reduz o custo
                    proporcao = mov.quantidade / quantidade if quantidade > 0 else 0
                    total_custo -= total_custo * proporcao
                quantidade -= mov.quantidade
            elif mov.operacao == 'BONIFICACAO':
                quantidade += mov.quantidade
            elif mov.operacao == 'GRUPAMENTO':
                quantidade += mov.quantidade
            elif mov.operacao == 'DESDOBRAMENTO':
                quantidade += mov.quantidade
        self.quantidade = quantidade
        if quantidade > 0:
            self.preco_medio = (total_custo / quantidade).quantize(Decimal('0.000001'), rounding=ROUND_HALF_UP)
        else:
            self.preco_medio = Decimal('0')
        self.save(update_fields=['quantidade', 'preco_medio'])

    def get_current_price(self):
        """Get current price using the price service"""
        from .services import get_current_price
        return get_current_price(self.ticker, self.moeda)

    def update_valor_atual(self):
        """Update current value using cached price"""
        try:
            preco_atual, is_estimado = self.get_current_price()
            self.valor_atual = self.quantidade * preco_atual
            self.is_preco_estimado = is_estimado
            self.save(update_fields=['valor_atual', 'is_preco_estimado'])
        except Exception as e:
            logger.error(f"Error updating valor_atual for {self.ticker}: {str(e)}")

    @property
    def total_investido(self) -> Decimal:
        """Calculate total invested amount"""
        if self.quantidade and self.preco_medio:
            return (self.quantidade * self.preco_medio).quantize(Decimal('0.01'))
        return Decimal('0.00')

    @property
    def rendimento_percentual(self) -> Decimal:
        """Calculate current yield percentage"""
        if self.total_investido > 0:
            return ((self.rendimento / self.total_investido) * 100).quantize(Decimal('0.01'))
        return Decimal('0.00')

    @property
    def preco_atual(self) -> Decimal:
        """Get current price per unit"""
        price, _ = self.get_current_price()
        return price

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
        self.ativo.update_quantidade_preco_medio()

    def __str__(self):
        return f"{self.ativo.ticker} - {self.get_operacao_display()} - {self.data}"

    def delete(self, *args, **kwargs):
        ativo = self.ativo
        super().delete(*args, **kwargs)
        ativo.update_quantidade_preco_medio()

    class Meta:
        ordering = ['-data', '-dataCriacao']

class Dividendo(models.Model):
    ativo = models.ForeignKey(Ativo, on_delete=models.PROTECT)
    data = models.DateField()
    valor = models.DecimalField(max_digits=15, decimal_places=2)
    dataCriacao = models.DateTimeField(auto_now_add=True)
    dataAlteracao = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.ativo.ticker} - {self.data} - {self.valor}"

    class Meta:
        ordering = ['-data', '-dataCriacao']
        verbose_name = 'Dividendo'
        verbose_name_plural = 'Dividendos'

class EvolucaoPatrimonial(models.Model):
    ativo = models.ForeignKey('Ativo', on_delete=models.CASCADE)
    data = models.DateField()
    preco_atual = models.DecimalField(max_digits=10, decimal_places=2)
    quantidade = models.DecimalField(max_digits=10, decimal_places=6)
    valor_total = models.DecimalField(max_digits=10, decimal_places=2)
    custo_total = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    dividendos_mes = models.DecimalField(max_digits=10, decimal_places=2, default=0, help_text="Total de dividendos recebidos neste mês para este ativo")
    
    class Meta:
        ordering = ['-data', 'ativo__ticker']
        unique_together = ['ativo', 'data']
        
    def __str__(self):
        return f"{self.ativo.ticker} - {self.mes_ano_display}"

    def save(self, *args, **kwargs):
        # Always calculate valor_total based on current price and quantity
        self.valor_total = self.preco_atual * self.quantidade
        super().save(*args, **kwargs)
    
    @property
    def mes_ano_display(self):
        """Display month/year in MM/YYYY format"""
        return self.data.strftime('%m/%Y')
    
    @property 
    def mes_ano_extenso(self):
        """Display month/year in full format (e.g., 'Janeiro 2025')"""
        return self.data.strftime('%B %Y')
    
    @property
    def year_month_key(self):
        """Return YYYY-MM key for grouping and filtering"""
        return self.data.strftime('%Y-%m')
    
    @property
    def lucro_prejuizo(self):
        """Calculate profit/loss compared to cost"""
        return self.valor_total - self.custo_total
    
    @property
    def percentual_lucro_prejuizo(self):
        """Calculate profit/loss percentage"""
        if self.custo_total > 0:
            return ((self.valor_total - self.custo_total) / self.custo_total) * 100
        return 0
    
    @classmethod
    def get_monthly_summary(cls, user=None):
        """Get summary of monthly snapshots grouped by month"""
        from django.db.models import Sum, Count
        
        queryset = cls.objects.all()
        if user:
            queryset = queryset.filter(ativo__usuario=user)
            
        return queryset.values(
            'data__year', 'data__month'
        ).annotate(
            total_valor=Sum('valor_total'),
            total_custo=Sum('custo_total'),
            count_ativos=Count('ativo', distinct=True)
        ).order_by('-data__year', '-data__month')

@receiver(post_save, sender=Movimentacao)
def update_ativo_on_movimentacao_save(sender, instance, **kwargs):
    instance.ativo.update_quantidade_preco_medio()

@receiver(post_delete, sender=Movimentacao)
def update_ativo_on_movimentacao_delete(sender, instance, **kwargs):
    instance.ativo.update_quantidade_preco_medio()

class Snapshot(models.Model):
    ativo = models.ForeignKey(Ativo, on_delete=models.CASCADE)
    data = models.DateField()
    preco = models.DecimalField(max_digits=15, decimal_places=2)
    quantidade = models.DecimalField(max_digits=15, decimal_places=2)
    valor_total = models.DecimalField(max_digits=15, decimal_places=2)
    is_preco_estimado = models.BooleanField(default=False)
    dataCriacao = models.DateTimeField(auto_now_add=True)
    dataAlteracao = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-data', '-dataCriacao']
        unique_together = ['ativo', 'data']

    def __str__(self):
        return f"{self.ativo.ticker} - {self.data} - {self.valor_total}"

class PrecoCache(models.Model):
    ticker = models.CharField(max_length=20)
    moeda = models.CharField(max_length=3)
    preco = models.DecimalField(max_digits=15, decimal_places=2)
    is_estimado = models.BooleanField(default=False)
    data_atualizacao = models.DateTimeField(auto_now=True)
    data_criacao = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['ticker', 'moeda']
        indexes = [
            models.Index(fields=['ticker', 'moeda']),
            models.Index(fields=['data_atualizacao']),
        ]

    def __str__(self):
        return f"{self.ticker} - {self.preco} ({self.moeda})"

    @classmethod
    def get_cached_price(cls, ticker: str, moeda: str) -> Tuple[Optional[Decimal], bool]:
        """Get cached price if it exists and is less than 24 hours old"""
        try:
            cache = cls.objects.get(ticker=ticker, moeda=moeda)
            if (timezone.now() - cache.data_atualizacao).total_seconds() < 24 * 3600:
                return cache.preco, cache.is_estimado
        except cls.DoesNotExist:
            pass
        return None, False

    @classmethod
    def update_cache(cls, ticker: str, moeda: str, preco: Decimal, is_estimado: bool):
        """Update or create price cache entry"""
        cls.objects.update_or_create(
            ticker=ticker,
            moeda=moeda,
            defaults={
                'preco': preco,
                'is_estimado': is_estimado
            }
        )
