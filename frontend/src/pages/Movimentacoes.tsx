import { useState, useEffect, useCallback, useRef } from 'react'
import { format } from 'date-fns'
import { movimentacaoService, ativoService, type Movimentacao, type Ativo } from '../services/api'
import type { MovimentacaoFormData, Operacao } from '../types/movimentacao'
import { Table, TableHead, TableBody, TableRow, TableCell } from '@mui/material'
import { IconButton } from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'


const OPERACAO_OPTIONS = [
  { value: 'COMPRA', label: 'Compra' },
  { value: 'VENDA', label: 'Venda' },
  { value: 'BONIFICACAO', label: 'Bonificação' },
  { value: 'GRUPAMENTO', label: 'Grupamento' },
  { value: 'DESDOBRAMENTO', label: 'Desdobramento' },
]

const formatCurrency = (value: number, currency: string = 'BRL') => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency
  }).format(value);
};

export default function Movimentacoes() {
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([])
  const [ativos, setAtivos] = useState<Ativo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [pageSize] = useState(10) // Match backend PAGE_SIZE
  
  // Filter state
  const [yearFilter, setYearFilter] = useState<number | ''>('')
  const [tickerFilter, setTickerFilter] = useState('')
  const [appliedFilters, setAppliedFilters] = useState({
    year: '' as string | number,
    ticker: ''
  })
  
  const [formData, setFormData] = useState<MovimentacaoFormData>({
    ativo: 0,
    data: format(new Date(), 'yyyy-MM-dd'),
    operacao: 'COMPRA',
    quantidade: 0,
    valorUnitario: 0,
    taxa: 0,
  })
  const [editingMovimentacao, setEditingMovimentacao] = useState<Movimentacao | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [importing, setImporting] = useState(false)

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

  // Get available years for filter (2020 to current year + 1)
  const getAvailableYears = (): number[] => {
    const currentYear = new Date().getFullYear()
    const startYear = 2020
    const endYear = currentYear + 1
    const years = []
    for (let year = endYear; year >= startYear; year--) {
      years.push(year)
    }
    return years
  }

  const loadMovimentacoes = useCallback(async (page: number = 1, resetPage: boolean = false) => {
    setIsLoading(true)
    try {
      const year = yearFilter === '' ? undefined : yearFilter
      const ticker = tickerFilter === '' ? undefined : tickerFilter
      
      const response = await movimentacaoService.getAll(page, pageSize, year, ticker)
      
      setMovimentacoes(response.data.results)
      setTotalCount(response.data.count)
      setTotalPages(Math.ceil(response.data.count / pageSize))
      
      if (resetPage) {
        setCurrentPage(1)
      } else {
        setCurrentPage(page)
      }
    } catch (error) {
      console.error('Error loading movimentacoes:', error)
      setError('Erro ao carregar movimentações')
    } finally {
      setIsLoading(false)
    }
  }, [yearFilter, tickerFilter, pageSize])

  const loadAtivos = async () => {
    try {
      const response = await ativoService.getAll()
      const ativos = Array.isArray(response.data) ? response.data : response.data.results
      setAtivos(ativos)
    } catch (error) {
      console.error('Error loading ativos:', error)
      setError('Erro ao carregar ativos')
    }
  }

  // Load initial data
  useEffect(() => {
    loadMovimentacoes(1)
    loadAtivos()
  }, [])

  const handleFilterChange = () => {
    setAppliedFilters({
      year: yearFilter,
      ticker: tickerFilter
    })
    loadMovimentacoes(1, true)
  }

  const clearFilters = () => {
    setYearFilter('')
    setTickerFilter('')
    setAppliedFilters({
      year: '',
      ticker: ''
    })
    loadMovimentacoes(1, true)
  }

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage)
      loadMovimentacoes(newPage)
    }
  }

  const handleEdit = (movimentacao: Movimentacao) => {
    setEditingMovimentacao(movimentacao)
    setFormData({
      ativo: movimentacao.ativo,
      data: format(new Date(movimentacao.data), 'yyyy-MM-dd'),
      operacao: movimentacao.operacao as Operacao,
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
      await movimentacaoService.delete(id)
      loadMovimentacoes(currentPage)
    } catch (error) {
      setError('Erro ao excluir movimentação')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingMovimentacao) {
        await movimentacaoService.update(editingMovimentacao.id, formData)
      } else {
        await movimentacaoService.create(formData)
      }
      loadMovimentacoes(currentPage)
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

  // Helper for pagination page numbers
  const getPageNumbers = () => {
    const pages = [];
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, start + 4);
    if (end - start < 4) {
      start = Math.max(1, end - 4);
    }
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };



  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const token = localStorage.getItem('accessToken')
      const response = await fetch('http://localhost:8000/api/movimentacoes/import_excel/', {
        method: 'POST',
        body: formData,
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        credentials: 'include',
      })
      const data = await response.json()
      if (response.ok) {
        alert(data.message || 'Movimentações importadas com sucesso!')
        loadMovimentacoes(1, true)
      } else {
        alert(data.error || 'Erro ao importar movimentações.')
      }
    } catch (err) {
      alert('Erro ao importar movimentações.')
    } finally {
      setImporting(false)
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
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none space-x-3">
          <label className="inline-flex items-center rounded-md bg-green-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-green-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 cursor-pointer">
            {importing ? 'Importando...' : 'Importar Movimentações (XLSX)'}
            <input
              type="file"
              accept=".xlsx"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              disabled={importing}
            />
          </label>
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

      {/* Filters */}
      <div className="mt-6 bg-white shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div>
            <select
              id="year-filter"
              value={yearFilter}
              onChange={(e) => {
                const value = e.target.value === '' ? '' : parseInt(e.target.value)
                setYearFilter(value)
              }}
              className="h-10 block w-full px-3 rounded-md border-gray-300 bg-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm text-gray-800"
            >
              <option value="">Todos os anos</option>
              {getAvailableYears().map(year => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div>
            <input
              type="text"
              id="ticker-filter"
              value={tickerFilter}
              onChange={(e) => setTickerFilter(e.target.value)}
              placeholder="Digite o ticker..."
              className="h-10 block w-full px-3 rounded-md border-gray-300 bg-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm text-gray-800 placeholder-gray-500"
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={handleFilterChange}
              className="h-10 w-full rounded-md bg-primary-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
            >
              Filtrar
            </button>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={clearFilters}
              className="h-10 w-full rounded-md bg-gray-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-600"
            >
              Limpar Filtros
            </button>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="mt-8 bg-white shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg p-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">
            {editingMovimentacao ? 'Editar Movimentação' : 'Adicionar Movimentação'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <select
                  id="ativo"
                  value={formData.ativo || ''}
                  onChange={(e) => setFormData({ ...formData, ativo: Number(e.target.value) })}
                  className="h-10 block w-full px-3 rounded-md border-gray-300 bg-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm text-gray-800"
                  required
                  style={{ maxHeight: 'none' }}
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
                <select
                  id="operacao"
                  value={formData.operacao}
                  onChange={(e) => setFormData({ ...formData, operacao: e.target.value as Operacao })}
                  className="h-10 block w-full px-3 rounded-md border-gray-300 bg-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm text-gray-800"
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
                <input
                  type="date"
                  id="data"
                  value={formData.data}
                  onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                  className="h-10 block w-full px-3 rounded-md border-gray-300 bg-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm text-gray-800"
                  required
                />
              </div>

              <div>
                <input
                  type="number"
                  id="quantidade"
                  step="0.000001"
                  value={formData.quantidade || ''}
                  onChange={(e) => setFormData({ ...formData, quantidade: Number(e.target.value) })}
                  placeholder="Quantidade"
                  className="h-10 block w-full px-3 rounded-md border-gray-300 bg-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm text-gray-800 placeholder-gray-500"
                  required
                />
              </div>

              <div>
                <input
                  type="number"
                  id="valorUnitario"
                  step="0.01"
                  value={formData.valorUnitario || ''}
                  onChange={(e) => setFormData({ ...formData, valorUnitario: Number(e.target.value) })}
                  placeholder={`Valor Unitário ${formData.ativo ? `(${getAtivoCurrency(formData.ativo)})` : ''}`}
                  className="h-10 block w-full px-3 rounded-md border-gray-300 bg-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm text-gray-800 placeholder-gray-500"
                  required
                />
              </div>

              <div>
                <input
                  type="number"
                  id="taxa"
                  step="0.01"
                  value={formData.taxa || ''}
                  onChange={(e) => setFormData({ ...formData, taxa: Number(e.target.value) })}
                  placeholder={`Taxa ${formData.ativo ? `(${getAtivoCurrency(formData.ativo)})` : ''}`}
                  className="h-10 block w-full px-3 rounded-md border-gray-300 bg-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm text-gray-800 placeholder-gray-500"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-4">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="h-10 inline-flex items-center px-4 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="h-10 inline-flex items-center px-4 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
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
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Ativo</TableCell>
                    <TableCell>Data</TableCell>
                    <TableCell>Operação</TableCell>
                    <TableCell align="right">Quantidade</TableCell>
                    <TableCell align="right">Valor Unitário</TableCell>
                    <TableCell align="right">Taxa</TableCell>
                    <TableCell align="right">Custo Total</TableCell>
                    <TableCell align="right">Ações</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Array.isArray(movimentacoes) && movimentacoes.length > 0 ? (
                    movimentacoes.map((movimentacao) => {
                      const ativo = ativos.find(a => a.id === movimentacao.ativo);
                      return (
                        <TableRow key={movimentacao.id}>
                          <TableCell>
                            <div className="flex items-center">
                              {ativo && (
                                <img 
                                  src={ativo.icone_url || 'https://cdn-icons-png.flaticon.com/512/2830/2830284.png'} 
                                  alt={`${ativo.ticker} icon`}
                                  className="h-6 w-6 rounded-full mr-2 object-cover"
                                  onError={(e) => {
                                    e.currentTarget.src = 'https://cdn-icons-png.flaticon.com/512/2830/2830284.png';
                                  }}
                                />
                              )}
                              <div>
                                <div style={{ fontWeight: 'bold' }}>{movimentacao.ativo_display}</div>
                                {ativo && (
                                  <div style={{ fontSize: '0.8em', color: 'gray' }}>{ativo.moeda}</div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{format(new Date(movimentacao.data), 'dd/MM/yyyy')}</TableCell>
                          <TableCell>{movimentacao.operacao_display}</TableCell>
                          <TableCell align="right">{movimentacao.quantidade.toLocaleString('pt-BR', { minimumFractionDigits: 6 })}</TableCell>
                          <TableCell align="right">{formatCurrency(movimentacao.valorUnitario, ativo?.moeda)}</TableCell>
                          <TableCell align="right">{formatCurrency(movimentacao.taxa, ativo?.moeda)}</TableCell>
                          <TableCell align="right">{formatCurrency(movimentacao.custoTotal, ativo?.moeda)}</TableCell>
                          <TableCell align="right">
                            <IconButton onClick={() => handleEdit(movimentacao)}>
                              <EditIcon />
                            </IconButton>
                            <IconButton onClick={() => handleDelete(movimentacao.id)}>
                              <DeleteIcon />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} align="center">
                        Nenhuma movimentação encontrada
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Próximo
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Mostrando <span className="font-medium">{(currentPage - 1) * pageSize + 1}</span> a{' '}
                  <span className="font-medium">
                    {Math.min(currentPage * pageSize, totalCount)}
                  </span>{' '}
                  de <span className="font-medium">{totalCount}</span> movimentações
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="sr-only">Anterior</span>
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                    </svg>
                  </button>
                  
                  {/* Page Numbers */}
                  {getPageNumbers().map(page => (
                    <button
                      key={`movimentacoes-page-${page}`}
                      onClick={() => handlePageChange(page)}
                      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                        page === currentPage
                          ? 'z-10 bg-primary-50 border-primary-500 text-primary-600'
                          : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="sr-only">Próximo</span>
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                    </svg>
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 