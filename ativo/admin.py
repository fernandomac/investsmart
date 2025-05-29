from django.contrib import admin
from .models import Categoria, Ativo

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
