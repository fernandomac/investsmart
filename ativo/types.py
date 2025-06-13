from decimal import Decimal
from typing import TypedDict, Optional

class PrecoInfo(TypedDict):
    preco: Decimal
    moeda: str
    ultima_atualizacao: str
    fonte: str

class AtivoInfo(TypedDict):
    ticker: str
    nome: str
    tipo: str
    moeda: str
    preco_atual: Optional[Decimal]
    variacao_dia: Optional[Decimal]
    variacao_mes: Optional[Decimal]
    variacao_ano: Optional[Decimal]
    variacao_12m: Optional[Decimal]
    variacao_24m: Optional[Decimal]
    variacao_36m: Optional[Decimal]
    variacao_48m: Optional[Decimal]
    variacao_60m: Optional[Decimal]
    variacao_todas: Optional[Decimal]
    ultima_atualizacao: Optional[str]
    fonte: Optional[str] 