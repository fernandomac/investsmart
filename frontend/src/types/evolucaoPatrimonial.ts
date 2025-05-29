export interface EvolucaoPatrimonial {
    id: number;
    ativo: number;
    ativo_ticker: string;
    ativo_nome: string;
    categoria_nome: string;
    moeda: string;
    data: string;
    preco_atual: string;
    quantidade: string;
    valor_total: string;
    custo_total: string;
}

export interface EvolucaoPatrimonialData {
    data: string;
    valor_total: number;
    custo_total: number;
    por_categoria: {
        [key: string]: number;
    };
    por_ativo: {
        [key: string]: number;
    };
} 