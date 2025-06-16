from rest_framework import serializers
from .models import Categoria, Ativo, Movimentacao, Dividendo, EvolucaoPatrimonial, Snapshot

class CategoriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Categoria
        fields = ['id', 'tipo', 'subtipo', 'descricao', 'dataCriacao', 'dataAlteracao']
        read_only_fields = ['dataCriacao', 'dataAlteracao']

class AtivoSerializer(serializers.ModelSerializer):
    usuario = serializers.HiddenField(default=serializers.CurrentUserDefault())
    categoria_nome = serializers.CharField(source='categoria.descricao', read_only=True)
    categoria_tipo = serializers.CharField(source='categoria.tipo', read_only=True)
    categoria_subtipo = serializers.CharField(source='categoria.subtipo', read_only=True)
    categoria_display = serializers.SerializerMethodField()
    total_investido = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    valor_atual = serializers.DecimalField(max_digits=15, decimal_places=2)
    rendimento = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    rendimento_percentual = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    preco_atual = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    is_preco_estimado = serializers.BooleanField(read_only=True)
    moeda_nome = serializers.CharField(source='get_moeda_display', read_only=True)

    class Meta:
        model = Ativo
        fields = ['id', 'usuario', 'nome', 'ticker', 'categoria', 'categoria_nome', 'categoria_tipo', 'categoria_subtipo',
                 'categoria_display', 'quantidade', 'preco_medio', 'total_investido', 'valor_atual', 'rendimento', 'rendimento_percentual',
                 'preco_atual', 'is_preco_estimado', 'moeda', 'moeda_nome', 'icone_url', 'dataCriacao', 'dataAlteracao',
                 'dataVencimento', 'anotacao', 'peso']
        read_only_fields = ['dataCriacao', 'dataAlteracao']

    def get_categoria_display(self, obj):
        return f"{obj.categoria.tipo} - {obj.categoria.subtipo}"
    
    def get_icone_url_display(self, obj):
        return obj.get_icon_url()

    def validate_peso(self, value):
        """
        Validate that peso is between 0 and 100
        """
        if value < 0 or value > 100:
            raise serializers.ValidationError("O peso deve estar entre 0 e 100.")
        return value

    def update(self, instance, validated_data):
        # If valor_atual is being updated, set is_preco_estimado to False
        if 'valor_atual' in validated_data:
            instance.is_preco_estimado = False
        return super().update(instance, validated_data)

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
    
    # Monthly display fields
    mes_ano_display = serializers.ReadOnlyField()
    mes_ano_extenso = serializers.ReadOnlyField()
    year_month_key = serializers.ReadOnlyField()
    
    # Analysis fields
    lucro_prejuizo = serializers.ReadOnlyField()
    percentual_lucro_prejuizo = serializers.ReadOnlyField()

    class Meta:
        model = EvolucaoPatrimonial
        fields = ['id', 'ativo', 'ativo_ticker', 'ativo_nome', 'categoria_nome', 'moeda',
                 'data', 'preco_atual', 'quantidade', 'valor_total', 'custo_total', 'dividendos_mes',
                 'mes_ano_display', 'mes_ano_extenso', 'year_month_key',
                 'lucro_prejuizo', 'percentual_lucro_prejuizo']
        read_only_fields = ['valor_total', 'custo_total', 'dividendos_mes']

    def validate(self, data):
        """
        Validate that preco_atual and quantidade are positive numbers.
        """
        if 'preco_atual' in data and data['preco_atual'] < 0:
            raise serializers.ValidationError("Preço atual deve ser positivo")
        
        if 'quantidade' in data and data['quantidade'] < 0:
            raise serializers.ValidationError("Quantidade deve ser positiva")
        
        # Ensure data is always first day of month for monthly snapshots
        if 'data' in data:
            data['data'] = data['data'].replace(day=1)
            
        return data

class SnapshotSerializer(serializers.ModelSerializer):
    ativo_nome = serializers.CharField(source='ativo.nome', read_only=True)
    ativo_ticker = serializers.CharField(source='ativo.ticker', read_only=True)
    moeda = serializers.CharField(source='ativo.moeda', read_only=True)

    class Meta:
        model = Snapshot
        fields = [
            'id', 'ativo', 'ativo_nome', 'ativo_ticker', 'data',
            'preco', 'quantidade', 'valor_total', 'is_preco_estimado',
            'moeda', 'dataCriacao', 'dataAlteracao'
        ]
        read_only_fields = ['dataCriacao', 'dataAlteracao']
