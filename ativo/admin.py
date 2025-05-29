from django.contrib import admin
from .models import Categoria, Ativo, Movimentacao

@admin.register(Categoria)
class CategoriaAdmin(admin.ModelAdmin):
    list_display = ['tipo', 'subtipo', 'descricao', 'dataCriacao', 'dataAlteracao']
    list_filter = ['tipo', 'subtipo']
    search_fields = ['tipo', 'subtipo', 'descricao']
    ordering = ['tipo', 'subtipo']

@admin.register(Ativo)
class AtivoAdmin(admin.ModelAdmin):
    list_display = ['ticker', 'nome', 'moeda', 'categoria', 'usuario', 'dataCriacao', 'dataAlteracao']
    list_filter = ['moeda', 'categoria', 'usuario']
    search_fields = ['ticker', 'nome']
    ordering = ['ticker']

@admin.register(Movimentacao)
class MovimentacaoAdmin(admin.ModelAdmin):
    list_display = ['ativo', 'data', 'operacao', 'quantidade', 'valorUnitario', 'taxa', 'custoTotal']
    list_filter = ['operacao', 'data', 'ativo__usuario']
    search_fields = ['ativo__ticker', 'ativo__nome']
    ordering = ['-data', '-dataCriacao']
    readonly_fields = ['custoTotal']
