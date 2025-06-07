import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import api from '../services/api'
import type { Movimentacao, MovimentacaoFormData, Operacao } from '../types/movimentacao'
import type { Ativo } from '../types/ativo'

const OPERACAO_OPTIONS = [
  { value: 'COMPRA', label: 'Compra' },
  { value: 'VENDA', label: 'Venda' },
  { value: 'BONIFICACAO', label: 'Bonificação' },
  { value: 'GRUPAMENTO', label: 'Grupamento' },
  { value: 'DESDOBRAMENTO', label: 'Desdobramento' },
]

export default function Movimentacoes() {
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([])
  const [ativos, setAtivos] = useState<Ativo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState<MovimentacaoFormData>({
    ativo: 0,
    data: format(new Date(), 'yyyy-MM-dd'),
    operacao: 'COMPRA',
    quantidade: 0,
    valorUnitario: 0,
    taxa: 0,
  })
  const [editingMovimentacao, setEditingMovimentacao] = useState<Movimentacao | null>(null)

  // Helper function to get ativo currency
  const getAtivoCurrency = (ativoId: number): string => {
    const ativo = ativos.find(a => a.id === ativoId)
    return ativo?.moeda || 'BRL'
  }

  // Helper function to get currency symbol
  const getCurrencySymbol = (currency: string): string => {
    const symbols: { [key: string]: string } = {
      'BRL': 'R$',
      'USD': 'US$',
      'EUR': '€',
      'GBP': '£'
    }
    return symbols[currency] || currency
  }

  // Helper function to format currency based on ativo's currency
  const formatCurrency = (value: number | string, ativoId: number): string => {
    // Ensure value is a number
    const numValue = typeof value === 'string' ? parseFloat(value) : value
    
    if (isNaN(numValue)) {
      return 'R$ 0,00'
    }
    
    if (!ativos || ativos.length === 0) {
      return `R$ ${numValue.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`
    }
    
    const currency = getAtivoCurrency(ativoId)
    const symbol = getCurrencySymbol(currency)
    
    // Format number with appropriate decimal places and separators
    const formattedNumber = numValue.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
    
    return `${symbol} ${formattedNumber}`
  }

  const loadMovimentacoes = useCallback(async () => {
    try {
      const response = await api.get('/movimentacoes/')
      if (response.data && typeof response.data === 'object') {
        // If response.data is an object with results property (DRF pagination)
        const movimentacoes = Array.isArray(response.data.results) ? response.data.results : 
                            Array.isArray(response.data) ? response.data : []
        setMovimentacoes(movimentacoes)
      } else {
        setMovimentacoes([])
      }
    } catch (error) {
      console.error('Error loading movimentacoes:', error)
      setError('Erro ao carregar movimentações')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loadAtivos = useCallback(async () => {
    try {
      const response = await api.get('/ativos/')
      if (response.data && typeof response.data === 'object') {
        // If response.data is an object with results property (DRF pagination)
        const ativos = Array.isArray(response.data.results) ? response.data.results : 
                      Array.isArray(response.data) ? response.data : []
        setAtivos(ativos)
      } else {
        setAtivos([])
      }
    } catch (error) {
      console.error('Error loading ativos:', error)
      setError('Erro ao carregar ativos')
    }
  }, [])

  useEffect(() => {
    loadMovimentacoes()
    loadAtivos()
  }, [loadMovimentacoes, loadAtivos])

  const handleEdit = (movimentacao: Movimentacao) => {
    setEditingMovimentacao(movimentacao)
    setFormData({
      ativo: movimentacao.ativo,
      data: format(new Date(movimentacao.data), 'yyyy-MM-dd'),
      operacao: movimentacao.operacao,
      quantidade: movimentacao.quantidade,
      valorUnitario: movimentacao.valorUnitario,
      taxa: movimentacao.taxa,
    })
    setShowForm(true)
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm('Tem certeza que deseja excluir esta movimentação?')) {
      return
    }
    try {
      await api.delete(`/movimentacoes/${id}/`)
      loadMovimentacoes()
    } catch (error) {
      setError('Erro ao excluir movimentação')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingMovimentacao) {
        await api.put(`/movimentacoes/${editingMovimentacao.id}/`, formData)
      } else {
        await api.post('/movimentacoes/', formData)
      }
      loadMovimentacoes()
      setShowForm(false)
      setFormData({
        ativo: 0,
        data: format(new Date(), 'yyyy-MM-dd'),
        operacao: 'COMPRA',
        quantidade: 0,
        valorUnitario: 0,
        taxa: 0,
      })
      setEditingMovimentacao(null)
    } catch (error) {
      setError('Erro ao salvar movimentação')
    }
  }

  if (isLoading) return <div>Carregando...</div>
  if (error) return <div className="text-red-500">{error}</div>

  return (
    <div className="bg-gray-50 min-h-screen -mt-8 -mx-4 px-4 py-8 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-800">Movimentações</h1>
          <p className="mt-2 text-sm text-gray-600">
            Lista de todas as movimentações dos seus ativos
          </p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <button
            type="button"
            onClick={() => {
              setEditingMovimentacao(null)
              setFormData({
                ativo: 0,
                data: format(new Date(), 'yyyy-MM-dd'),
                operacao: 'COMPRA',
                quantidade: 0,
                valorUnitario: 0,
                taxa: 0,
              })
              setShowForm(true)
            }}
            className="rounded-md bg-primary-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
          >
            Adicionar Movimentação
          </button>
        </div>
      </div>

      {showForm && (
        <div className="mt-8 bg-white shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="ativo" className="block text-sm font-medium text-gray-700">
                  Ativo
                </label>
                <select
                  id="ativo"
                  value={formData.ativo || ''}
                  onChange={(e) => setFormData({ ...formData, ativo: Number(e.target.value) })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  required
                >
                  <option value="">Selecione um ativo</option>
                  {ativos && ativos.length > 0 ? (
                    ativos.map((ativo) => (
                      <option key={ativo.id} value={ativo.id}>
                        {ativo.ticker} - {ativo.nome} ({ativo.moeda})
                      </option>
                    ))
                  ) : (
                    <option value="" disabled>Carregando ativos...</option>
                  )}
                </select>
              </div>

              <div>
                <label htmlFor="operacao" className="block text-sm font-medium text-gray-700">
                  Operação
                </label>
                <select
                  id="operacao"
                  value={formData.operacao}
                  onChange={(e) => setFormData({ ...formData, operacao: e.target.value as Operacao })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  required
                >
                  {OPERACAO_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="data" className="block text-sm font-medium text-gray-700">
                  Data
                </label>
                <input
                  type="date"
                  id="data"
                  value={formData.data}
                  onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  required
                />
              </div>

              <div>
                <label htmlFor="quantidade" className="block text-sm font-medium text-gray-700">
                  Quantidade
                </label>
                <input
                  type="number"
                  id="quantidade"
                  step="0.000001"
                  value={formData.quantidade || ''}
                  onChange={(e) => setFormData({ ...formData, quantidade: Number(e.target.value) })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  required
                />
              </div>

              <div>
                <label htmlFor="valorUnitario" className="block text-sm font-medium text-gray-700">
                  Valor Unitário {formData.ativo && `(${getAtivoCurrency(formData.ativo)})`}
                </label>
                <input
                  type="number"
                  id="valorUnitario"
                  step="0.01"
                  value={formData.valorUnitario || ''}
                  onChange={(e) => setFormData({ ...formData, valorUnitario: Number(e.target.value) })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  required
                />
              </div>

              <div>
                <label htmlFor="taxa" className="block text-sm font-medium text-gray-700">
                  Taxa {formData.ativo && `(${getAtivoCurrency(formData.ativo)})`}
                </label>
                <input
                  type="number"
                  id="taxa"
                  step="0.01"
                  value={formData.taxa || ''}
                  onChange={(e) => setFormData({ ...formData, taxa: Number(e.target.value) })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
              >
                {editingMovimentacao ? 'Salvar' : 'Adicionar'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="mt-8 flow-root">
        <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                      Ativo
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Data
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Operação
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">
                      Quantidade
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">
                      Valor Unitário
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">
                      Taxa
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">
                      Custo Total
                    </th>
                    <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {Array.isArray(movimentacoes) && movimentacoes.length > 0 ? (
                    movimentacoes.map((movimentacao) => (
                      <tr key={movimentacao.id}>
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-primary-600 sm:pl-6">
                          {movimentacao.ativo_display}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {format(new Date(movimentacao.data), 'dd/MM/yyyy')}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {movimentacao.operacao_display}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-right text-gray-500">
                          {movimentacao.quantidade.toLocaleString('pt-BR', { minimumFractionDigits: 6 })}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-right text-gray-500">
                          {formatCurrency(movimentacao.valorUnitario, movimentacao.ativo)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-right text-gray-500">
                          {formatCurrency(movimentacao.taxa, movimentacao.ativo)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-right text-gray-500">
                          {formatCurrency(movimentacao.custoTotal, movimentacao.ativo)}
                        </td>
                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                          <button
                            onClick={() => handleEdit(movimentacao)}
                            className="text-primary-600 hover:text-primary-900 bg-transparent mr-4"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDelete(movimentacao.id)}
                            className="text-red-600 hover:text-red-900 bg-transparent"
                          >
                            Excluir
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-4 text-center text-sm text-gray-500">
                        Nenhuma movimentação encontrada
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 