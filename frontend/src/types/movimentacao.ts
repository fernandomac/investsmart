import { Ativo } from './ativo'

export type Operacao = 'COMPRA' | 'VENDA' | 'BONIFICACAO' | 'GRUPAMENTO' | 'DESDOBRAMENTO'

export interface Movimentacao {
  id: number
  ativo: number
  ativo_display: string
  data: string
  operacao: Operacao
  operacao_display: string
  quantidade: number
  valorUnitario: number
  taxa: number
  custoTotal: number
  dataCriacao: string
  dataAlteracao: string
}

export interface MovimentacaoFormData {
  ativo: number
  data: string
  operacao: Operacao
  quantidade: number
  valorUnitario: number
  taxa: number
} 