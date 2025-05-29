from rest_framework import serializers
from .models import Categoria, Ativo, Movimentacao, Dividendo, EvolucaoPatrimonial

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

class DividendoSerializer(serializers.ModelSerializer):
    ativo_display = serializers.SerializerMethodField()

    class Meta:
        model = Dividendo
        fields = ['id', 'ativo', 'ativo_display', 'data', 'valor', 'dataCriacao', 'dataAlteracao']
        read_only_fields = ['dataCriacao', 'dataAlteracao']

    def get_ativo_display(self, obj):
        return str(obj.ativo)

    def validate_ativo(self, value):
        """
        Check if the ativo belongs to the current user
        """
        if value.usuario != self.context['request'].user:
            raise serializers.ValidationError("You can only create dividends for your own assets.")
        return value

class EvolucaoPatrimonialSerializer(serializers.ModelSerializer):
    ativo_ticker = serializers.CharField(source='ativo.ticker', read_only=True)
    ativo_nome = serializers.CharField(source='ativo.nome', read_only=True)
    categoria_nome = serializers.CharField(source='ativo.categoria_display', read_only=True)
    moeda = serializers.CharField(source='ativo.moeda', read_only=True)

    class Meta:
        model = EvolucaoPatrimonial
        fields = ['id', 'ativo', 'ativo_ticker', 'ativo_nome', 'categoria_nome', 'moeda',
                 'data', 'preco_atual', 'quantidade', 'valor_total', 'custo_total']
        read_only_fields = ['valor_total', 'custo_total']

    def validate(self, data):
        """
        Validate that preco_atual and quantidade are positive numbers.
        """
        if 'preco_atual' in data and data['preco_atual'] <= 0:
            raise serializers.ValidationError({'preco_atual': 'O preço atual deve ser maior que zero.'})
        
        if 'quantidade' in data and data['quantidade'] < 0:
            raise serializers.ValidationError({'quantidade': 'A quantidade não pode ser negativa.'})
        
        return data
