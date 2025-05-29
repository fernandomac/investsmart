from rest_framework import serializers
from .models import Categoria, Ativo, Movimentacao

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

class MovimentacaoSerializer(serializers.ModelSerializer):
    ativo_display = serializers.SerializerMethodField()
    operacao_display = serializers.SerializerMethodField()

    class Meta:
        model = Movimentacao
        fields = ['id', 'ativo', 'ativo_display', 'data', 'operacao', 'operacao_display', 
                 'quantidade', 'valorUnitario', 'taxa', 'custoTotal', 'dataCriacao', 'dataAlteracao']
        read_only_fields = ['custoTotal', 'dataCriacao', 'dataAlteracao']

    def get_ativo_display(self, obj):
        return str(obj.ativo)

    def get_operacao_display(self, obj):
        return obj.get_operacao_display()

    def validate_ativo(self, value):
        """
        Check if the ativo belongs to the current user
        """
        if value.usuario != self.context['request'].user:
            raise serializers.ValidationError("You can only create transactions for your own assets.")
        return value
