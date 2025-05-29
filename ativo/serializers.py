from rest_framework import serializers
from .models import Categoria, Ativo

class CategoriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Categoria
        fields = ['id', 'tipo', 'subtipo', 'descricao', 'dataCriacao', 'dataAlteracao']
        read_only_fields = ['dataCriacao', 'dataAlteracao']

class AtivoSerializer(serializers.ModelSerializer):
    categoria_display = serializers.SerializerMethodField()
    usuario = serializers.HiddenField(default=serializers.CurrentUserDefault())

    class Meta:
        model = Ativo
        fields = ['id', 'ticker', 'nome', 'moeda', 'categoria', 'categoria_display', 'usuario', 'dataCriacao', 'dataAlteracao']
        read_only_fields = ['dataCriacao', 'dataAlteracao']

    def get_categoria_display(self, obj):
        return str(obj.categoria)
