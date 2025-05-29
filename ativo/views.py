from django.shortcuts import render
from rest_framework import viewsets, status
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Categoria, Ativo, Movimentacao, Dividendo, EvolucaoPatrimonial
from .serializers import CategoriaSerializer, AtivoSerializer, MovimentacaoSerializer, DividendoSerializer, EvolucaoPatrimonialSerializer
from .services import create_snapshot, create_snapshots_for_all_assets
from datetime import date

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

class DividendoViewSet(viewsets.ModelViewSet):
    serializer_class = DividendoSerializer
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['ativo__ticker']
    ordering_fields = ['data', 'valor', 'dataCriacao']
    ordering = ['-data', '-dataCriacao']
    pagination_class = None

    def get_queryset(self):
        return Dividendo.objects.filter(ativo__usuario=self.request.user)

class EvolucaoPatrimonialViewSet(viewsets.ModelViewSet):
    queryset = EvolucaoPatrimonial.objects.all()
    serializer_class = EvolucaoPatrimonialSerializer
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['ativo__ticker']
    ordering_fields = ['data', 'valor_total']
    ordering = ['-data']
    pagination_class = None
    
    def get_queryset(self):
        return EvolucaoPatrimonial.objects.filter(ativo__usuario=self.request.user)
    
    @action(detail=False, methods=['post'])
    def create_snapshots(self, request):
        """Create snapshots for all assets."""
        try:
            snapshot_date = date.today()
            if 'data' in request.data:
                snapshot_date = date.fromisoformat(request.data['data'])
            
            create_snapshots_for_all_assets(snapshot_date, request.user)
            return Response({'status': 'Snapshots created successfully'})
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
