export type Moeda = 'BRL' | 'USD' | 'EUR' | 'GBP'

export interface Ativo {
  id: number
  ticker: string
  nome: string
  moeda: Moeda
  categoria: number
  categoria_display: string
  peso: number
  dataVencimento: string | null
  anotacao: string
  dataCriacao: string
  dataAlteracao: string
} 