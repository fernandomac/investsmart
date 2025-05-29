from rest_framework.routers import DefaultRouter
from django.urls import path, include
from .views import CategoriaViewSet, AtivoViewSet, MovimentacaoViewSet

router = DefaultRouter()
router.register(r'categorias', CategoriaViewSet)
router.register(r'ativos', AtivoViewSet, basename='ativo')
router.register(r'movimentacoes', MovimentacaoViewSet, basename='movimentacao')

urlpatterns = [
    path('', include(router.urls)),
]
