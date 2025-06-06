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
    
    // Monthly display fields
    mes_ano_display: string;
    mes_ano_extenso: string;
    year_month_key: string;
    
    // Analysis fields
    lucro_prejuizo: string;
    percentual_lucro_prejuizo: string;
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

export interface MonthlyGroup {
    year_month_key: string;
    mes_ano_display: string;
    mes_ano_extenso: string;
    total_valor: number;
    total_custo: number;
    total_lucro_prejuizo: number;
    count_ativos: number;
    ativos: EvolucaoPatrimonial[];
    isExpanded: boolean;
} 