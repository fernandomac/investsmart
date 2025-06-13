from rest_framework.routers import DefaultRouter
from django.urls import path, include
from .views import (CategoriaViewSet, AtivoViewSet, MovimentacaoViewSet,
                   DividendoViewSet, EvolucaoPatrimonialViewSet, SnapshotViewSet)

router = DefaultRouter()
router.register(r'categorias', CategoriaViewSet)
router.register(r'ativos', AtivoViewSet, basename='ativo')
router.register(r'movimentacoes', MovimentacaoViewSet, basename='movimentacao')
router.register(r'dividendos', DividendoViewSet, basename='dividendo')
router.register(r'evolucao-patrimonial', EvolucaoPatrimonialViewSet, basename='evolucao-patrimonial')
router.register(r'snapshots', SnapshotViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
