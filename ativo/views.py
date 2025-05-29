from django.shortcuts import render
from rest_framework import viewsets
from rest_framework.filters import SearchFilter, OrderingFilter
from .models import Categoria, Ativo
from .serializers import CategoriaSerializer, AtivoSerializer

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
