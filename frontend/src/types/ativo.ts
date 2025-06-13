export type Moeda = 'BRL' | 'USD' | 'EUR' | 'GBP'

export interface Ativo {
  id: number
  ticker: string
  nome: string
  categoria: number
  categoria_display?: string
  categoria_nome: string
  categoria_tipo: string
  categoria_subtipo: string
  moeda: string
  quantidade: number
  preco_medio: number
  total_investido: number
  valor_atual: number
  rendimento: number
  rendimento_percentual: number
  preco_atual: number
  is_preco_estimado: boolean
  dataVencimento?: string
  anotacao?: string
  icone_url?: string
  icone_url_display?: string
  usuario: number
  dataCriacao: string
  dataAlteracao: string
  peso: number
} 