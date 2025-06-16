from django.contrib import admin
from .models import Categoria, Ativo, Movimentacao, EvolucaoPatrimonial, Dividendo
from django.utils.html import format_html

@admin.register(Categoria)
class CategoriaAdmin(admin.ModelAdmin):
    list_display = ['tipo', 'subtipo', 'descricao', 'dataCriacao', 'dataAlteracao']
    list_filter = ['tipo', 'subtipo']
    search_fields = ['tipo', 'subtipo', 'descricao']
    ordering = ['tipo', 'subtipo']

@admin.register(Ativo)
class AtivoAdmin(admin.ModelAdmin):
    list_display = ['ticker', 'nome', 'moeda', 'categoria', 'peso', 'quantidade', 'preco_medio', 'valor_atual', 'dataVencimento', 'usuario', 'icone_url', 'dataCriacao', 'dataAlteracao']
    list_filter = ['moeda', 'categoria', 'usuario', 'dataVencimento']
    search_fields = ['ticker', 'nome', 'anotacao']
    ordering = ['ticker']
    readonly_fields = ['quantidade', 'preco_medio', 'dataCriacao', 'dataAlteracao']
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('ticker', 'nome', 'moeda', 'categoria', 'usuario')
        }),
        ('Investimento', {
            'fields': ('peso', 'quantidade', 'preco_medio', 'valor_atual', 'dataVencimento')
        }),
        ('Detalhes', {
            'fields': ('anotacao', 'icone_url')
        }),
        ('Informações do Sistema', {
            'fields': ('dataCriacao', 'dataAlteracao'),
            'classes': ('collapse',)
        }),
    )

@admin.register(Movimentacao)
class MovimentacaoAdmin(admin.ModelAdmin):
    list_display = ['ativo', 'data', 'operacao', 'quantidade', 'valorUnitario', 'taxa', 'custoTotal', 'dataCriacao', 'dataAlteracao']
    list_filter = ['operacao', 'data', 'ativo__usuario']
    search_fields = ['ativo__ticker', 'ativo__nome']
    ordering = ['-data', '-dataCriacao']
    readonly_fields = ['custoTotal', 'dataCriacao', 'dataAlteracao']
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('ativo', 'data', 'operacao')
        }),
        ('Valores', {
            'fields': ('quantidade', 'valorUnitario', 'taxa', 'custoTotal')
        }),
        ('Informações do Sistema', {
            'fields': ('dataCriacao', 'dataAlteracao'),
            'classes': ('collapse',)
        }),
    )

@admin.register(Dividendo)
class DividendoAdmin(admin.ModelAdmin):
    list_display = ['ativo', 'data', 'valor', 'dataCriacao', 'dataAlteracao']
    list_filter = ['data', 'ativo__usuario', 'ativo__categoria']
    search_fields = ['ativo__ticker', 'ativo__nome']
    ordering = ['-data', '-dataCriacao']
    readonly_fields = ['dataCriacao', 'dataAlteracao']
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('ativo', 'data', 'valor')
        }),
        ('Informações do Sistema', {
            'fields': ('dataCriacao', 'dataAlteracao'),
            'classes': ('collapse',)
        }),
    )

@admin.register(EvolucaoPatrimonial)
class EvolucaoPatrimonialAdmin(admin.ModelAdmin):
    list_display = ['ativo', 'mes_ano_display', 'preco_atual', 'quantidade', 'valor_total', 'dividendos_mes', 'lucro_prejuizo_display']
    list_filter = ['data', 'ativo__categoria', 'ativo__usuario']
    search_fields = ['ativo__ticker', 'ativo__nome']
    ordering = ['-data', 'ativo__ticker']
    readonly_fields = ['valor_total', 'mes_ano_extenso', 'year_month_key', 'lucro_prejuizo', 'percentual_lucro_prejuizo']
    
    def mes_ano_display(self, obj):
        """Display month/year"""
        return obj.mes_ano_display
    mes_ano_display.short_description = 'Mês/Ano'
    mes_ano_display.admin_order_field = 'data'
    
    def lucro_prejuizo_display(self, obj):
        """Display profit/loss with color coding"""
        lucro = obj.lucro_prejuizo
        if lucro > 0:
            color = 'green'
            symbol = '+'
        elif lucro < 0:
            color = 'red'
            symbol = ''
        else:
            color = 'black'
            symbol = ''
        
        return format_html(
            '<span style="color: {};">{}{}</span>',
            color,
            symbol,
            lucro
        )
    lucro_prejuizo_display.short_description = 'Lucro/Prejuízo'
    lucro_prejuizo_display.admin_order_field = 'valor_total'
    
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('ativo', 'data')
        }),
        ('Valores', {
            'fields': ('preco_atual', 'quantidade', 'valor_total', 'custo_total', 'dividendos_mes')
        }),
        ('Análise', {
            'fields': ('lucro_prejuizo', 'percentual_lucro_prejuizo'),
            'classes': ('collapse',)
        }),
        ('Informações Adicionais', {
            'fields': ('mes_ano_extenso', 'year_month_key'),
            'classes': ('collapse',)
        }),
    )
