from django.shortcuts import render
from rest_framework import viewsets
from rest_framework.filters import SearchFilter, OrderingFilter
from .models import Categoria, Ativo, Movimentacao
from .serializers import CategoriaSerializer, AtivoSerializer, MovimentacaoSerializer

# Create your views here.

class CategoriaViewSet(viewsets.ModelViewSet):
    queryset = Categoria.objects.all()
    serializer_class = CategoriaSerializer
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['tipo', 'subtipo', 'descricao']
    ordering_fields = ['tipo', 'subtipo', 'dataCriacao', 'dataAlteracao']
    ordering = ['tipo', 'subtipo']
    pagination_class = None

class AtivoViewSet(viewsets.ModelViewSet):
    serializer_class = AtivoSerializer
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['ticker', 'nome']
    ordering_fields = ['ticker', 'nome', 'moeda', 'dataCriacao', 'dataAlteracao']
    ordering = ['ticker']

    def get_queryset(self):
        """
        This view should return a list of all ativos
        for the currently authenticated user.
        """
        return Ativo.objects.filter(usuario=self.request.user)

class MovimentacaoViewSet(viewsets.ModelViewSet):
    serializer_class = MovimentacaoSerializer
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['ativo__ticker', 'operacao']
    ordering_fields = ['data', 'operacao', 'quantidade', 'valorUnitario', 'custoTotal', 'dataCriacao']
    ordering = ['-data', '-dataCriacao']
    pagination_class = None

    def get_queryset(self):
        return Movimentacao.objects.filter(ativo__usuario=self.request.user)
