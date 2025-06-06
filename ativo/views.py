from django.shortcuts import render
from rest_framework import viewsets, status
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Categoria, Ativo, Movimentacao, Dividendo, EvolucaoPatrimonial
from .serializers import CategoriaSerializer, AtivoSerializer, MovimentacaoSerializer, DividendoSerializer, EvolucaoPatrimonialSerializer
from .services import create_snapshot, create_snapshots_for_all_assets
from datetime import date
from django.db import models

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
        """Create monthly snapshots for all assets."""
        try:
            snapshot_date = date.today()
            if 'data' in request.data:
                snapshot_date = date.fromisoformat(request.data['data'])
            
            create_snapshots_for_all_assets(snapshot_date, request.user)
            monthly_date = snapshot_date.replace(day=1)
            return Response({
                'message': f'Monthly snapshots created successfully for {monthly_date.strftime("%m/%Y")}'
            })
        except Exception as e:
            return Response({'error': str(e)}, status=400)
    
    @action(detail=False, methods=['post'])
    def create_monthly_snapshot(self, request):
        """Create snapshot for a specific month (YYYY-MM format)."""
        try:
            year_month = request.data.get('year_month')  # Expected format: "2025-06"
            if not year_month:
                return Response({'error': 'year_month parameter required (format: YYYY-MM)'}, status=400)
            
            # Parse year and month
            year, month = map(int, year_month.split('-'))
            snapshot_date = date(year, month, 1)
            
            create_snapshots_for_all_assets(snapshot_date, request.user)
            return Response({
                'message': f'Monthly snapshots created successfully for {snapshot_date.strftime("%m/%Y")}'
            })
        except ValueError:
            return Response({'error': 'Invalid year_month format. Use YYYY-MM'}, status=400)
        except Exception as e:
            return Response({'error': str(e)}, status=400)
    
    @action(detail=False, methods=['get'])
    def monthly_summary(self, request):
        """Get summary of monthly snapshots grouped by month."""
        try:
            snapshots = self.get_queryset().values(
                'data__year', 'data__month'
            ).annotate(
                total_valor=models.Sum('valor_total'),
                total_custo=models.Sum('custo_total'),
                count_ativos=models.Count('ativo', distinct=True)
            ).order_by('-data__year', '-data__month')
            
            # Format the response
            summary = []
            for item in snapshots:
                year = item['data__year']
                month = item['data__month']
                monthly_date = date(year, month, 1)
                
                summary.append({
                    'year_month': f"{year}-{month:02d}",
                    'display': monthly_date.strftime("%m/%Y"),
                    'date': monthly_date.isoformat(),
                    'total_valor': float(item['total_valor'] or 0),
                    'total_custo': float(item['total_custo'] or 0),
                    'count_ativos': item['count_ativos'],
                    'lucro_prejuizo': float((item['total_valor'] or 0) - (item['total_custo'] or 0))
                })
            
            return Response(summary)
        except Exception as e:
            return Response({'error': str(e)}, status=400)
