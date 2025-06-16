import { useEffect, useState, useCallback } from 'react'
import { format } from 'date-fns'
import { dividendoService, ativoService, type Dividendo, type Ativo } from '../services/api'
import { IconButton, Tooltip } from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'

export default function Dividendos() {
  const [dividendos, setDividendos] = useState<Dividendo[]>([])
  const [ativos, setAtivos] = useState<Ativo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingDividendo, setEditingDividendo] = useState<Dividendo | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [pageSize] = useState(10) // Match backend PAGE_SIZE
  
  // Filter state
  const [yearFilter, setYearFilter] = useState<number | ''>('')
  const [tickerFilter, setTickerFilter] = useState('')
  
  const [formData, setFormData] = useState({
    ativo: '',
    data: format(new Date(), 'yyyy-MM-dd'),
    valor: ''
  })

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

  // Get unique tickers from ativos for filter dropdown
  const getAvailableTickers = (): string[] => {
    if (!ativos || ativos.length === 0) return []
    
    const uniqueTickers = [...new Set(ativos.map(ativo => ativo.ticker))]
    return uniqueTickers.sort()
  }

  const loadDividendos = useCallback(async (page: number = 1, resetPage: boolean = false) => {
    setLoading(true)
    try {
      const year = yearFilter === '' ? undefined : yearFilter
      const ticker = tickerFilter === '' ? undefined : tickerFilter
      
      const response = await dividendoService.getAll(page, pageSize, year, ticker)
      
      setDividendos(response.data.results)
      setTotalCount(response.data.count)
      setTotalPages(Math.ceil(response.data.count / pageSize))
      
      if (resetPage) {
        setCurrentPage(1)
      } else {
        setCurrentPage(page)
      }
    } catch (error) {
      console.error('Error loading dividendos:', error)
      setError('Erro ao carregar dividendos')
    } finally {
      setLoading(false)
    }
  }, [yearFilter, tickerFilter, pageSize])

  const loadAtivos = useCallback(async () => {
    try {
      const response = await ativoService.getAll()
      setAtivos(Array.isArray(response.data) ? response.data : response.data.results)
      console.log('All ativos:', Array.isArray(response.data) ? response.data : response.data.results)
    } catch (error) {
      console.error('Error loading ativos:', error)
      setError('Erro ao carregar ativos')
    }
  }, [])

  useEffect(() => {
    loadAtivos()
    loadDividendos(1, true)
  }, [loadAtivos, loadDividendos])

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      loadDividendos(newPage)
    }
  }

  const handleFilterChange = () => {
    loadDividendos(1, true) // Reset to page 1 when filters change
  }

  const clearFilters = () => {
    setYearFilter('')
    setTickerFilter('')
    // loadDividendos will be called by useEffect when state changes
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const payload = {
        ...formData,
        valor: Number(formData.valor),
        ativo: Number(formData.ativo)
      }

      if (editingDividendo) {
        await dividendoService.update(editingDividendo.id, payload)
      } else {
        await dividendoService.create(payload)
      }

      setIsModalOpen(false)
      setEditingDividendo(null)
      setFormData({
        ativo: '',
        data: format(new Date(), 'yyyy-MM-dd'),
        valor: ''
      })
      
      // Reload current page
      loadDividendos(currentPage)
    } catch (error) {
      console.error('Error saving dividendo:', error)
      setError('Erro ao salvar dividendo')
    }
  }

  const handleEdit = (dividendo: Dividendo) => {
    setEditingDividendo(dividendo)
    setFormData({
      ativo: String(dividendo.ativo),
      data: dividendo.data,
      valor: String(dividendo.valor)
    })
    setIsModalOpen(true)
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm('Tem certeza que deseja excluir este dividendo?')) {
      return
    }

    try {
      await dividendoService.delete(id)
      loadDividendos(currentPage)
    } catch (error) {
      console.error('Error deleting dividendo:', error)
      setError('Erro ao excluir dividendo')
    }
  }

  const handleImportExcel = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    setError('')

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await dividendoService.getAll() // Import via API call
      // Note: The import function would be called here, but we need to handle it differently
      // For now, I'll use the raw API call approach
      const token = localStorage.getItem('accessToken')
      const importResponse = await fetch('http://localhost:8000/api/dividendos/import_excel/', {
        method: 'POST',
        body: formData,
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        credentials: 'include',
      })
      
      const data = await importResponse.json()
      if (importResponse.ok) {
        alert(data.message || 'Dividendos importados com sucesso!')
        loadDividendos(1, true)
      } else {
        alert(data.error || 'Erro ao importar dividendos.')
      }
    } catch (error: any) {
      console.error('Error importing Excel:', error)
      const errorMessage = 'Erro ao importar arquivo Excel'
      setError(errorMessage)
      alert(errorMessage)
    } finally {
      setIsImporting(false)
      // Reset file input
      event.target.value = ''
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-red-500 text-center">
        {error}
      </div>
    )
  }

  return (
    <div className="bg-gray-50 min-h-screen -mt-8 -mx-4 px-4 py-8 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="sm:flex sm:items-center">
          <div className="sm:flex-auto">
            <h1 className="text-xl font-semibold text-gray-900">Dividendos</h1>
            <p className="mt-2 text-sm text-gray-700">
              Lista de dividendos recebidos dos seus ativos.
            </p>
          </div>
          <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none space-x-3">
            <label className="inline-flex items-center rounded-md bg-green-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-green-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 cursor-pointer">
              {isImporting ? 'Importando...' : 'Importar Dividendos (XLSX)'}
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleImportExcel}
                className="hidden"
                disabled={isImporting}
              />
            </label>
            <button
              type="button"
              onClick={() => {
                setIsModalOpen(true)
                setEditingDividendo(null)
                setFormData({
                  ativo: '',
                  data: format(new Date(), 'yyyy-MM-dd'),
                  valor: ''
                })
              }}
              className="inline-flex items-center justify-center rounded-md border border-transparent bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 sm:w-auto"
            >
              Adicionar Dividendo
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-8 flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label htmlFor="ticker" className="block text-sm font-medium text-gray-700">
              Filtrar por Ticker
            </label>
            <select
              id="ticker"
              value={tickerFilter}
              onChange={(e) => setTickerFilter(e.target.value)}
              className="h-10 block w-full px-3 rounded-md border-gray-300 bg-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm text-gray-800"
            >
              <option value="">Todos os tickers</option>
              {getAvailableTickers().map((ticker) => (
                <option key={ticker} value={ticker}>
                  {ticker}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            <label htmlFor="dataInicio" className="block text-sm font-medium text-gray-700">
              Data Início
            </label>
            <input
              type="date"
              id="dataInicio"
              value={yearFilter === '' ? '' : yearFilter.toString()}
              onChange={(e) => setYearFilter(e.target.value ? Number(e.target.value) : '')}
              className="h-10 block w-full px-3 rounded-md border-gray-300 bg-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm text-gray-800"
            />
          </div>

          <div className="flex-1">
            <label htmlFor="dataFim" className="block text-sm font-medium text-gray-700">
              Data Fim
            </label>
            <input
              type="date"
              id="dataFim"
              value={yearFilter === '' ? '' : yearFilter.toString()}
              onChange={(e) => setYearFilter(e.target.value ? Number(e.target.value) : '')}
              className="h-10 block w-full px-3 rounded-md border-gray-300 bg-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm text-gray-800"
            />
          </div>
        </div>

        {/* Form */}
        {isModalOpen && (
          <div className="mt-8 bg-blue-50 shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg p-6">
            <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">
              {editingDividendo ? 'Editar Dividendo' : 'Novo Dividendo'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="ativo" className="block text-sm font-medium text-gray-700">
                    Ativo
                  </label>
                  <select
                    id="ativo"
                    name="ativo"
                    value={formData.ativo}
                    onChange={(e) => setFormData({ ...formData, ativo: e.target.value })}
                    className="h-10 block w-full px-3 rounded-md border-gray-300 bg-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm text-gray-800"
                    required
                  >
                    <option value="">Selecione um ativo</option>
                    {ativos && ativos.length > 0 && ativos.map((ativo) => (
                      <option key={ativo.id} value={ativo.id}>
                        {ativo.ticker} - {ativo.nome} ({ativo.moeda})
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
                    name="data"
                    id="data"
                    value={formData.data}
                    onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                    className="h-10 block w-full px-3 rounded-md border-gray-300 bg-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm text-gray-800"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="valor" className="block text-sm font-medium text-gray-700">
                    Valor {formData.ativo && `(${getAtivoCurrency(Number(formData.ativo))})`}
                  </label>
                  <input
                    type="number"
                    name="valor"
                    id="valor"
                    step="0.01"
                    value={formData.valor}
                    onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                    className="h-10 block w-full px-3 rounded-md border-gray-300 bg-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm text-gray-800"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false)
                    setEditingDividendo(null)
                    setFormData({
                      ativo: '',
                      data: format(new Date(), 'yyyy-MM-dd'),
                      valor: ''
                    })
                  }}
                  className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center rounded-md border border-transparent bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                >
                  {editingDividendo ? 'Salvar' : 'Adicionar'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Grid */}
        <div className="mt-8 flex flex-col">
          <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
              <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                        Ativo
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Data
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">
                        Valor
                      </th>
                      <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                        <span className="sr-only">Ações</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {Array.isArray(dividendos) && dividendos.length > 0 ? (
                      dividendos.map((dividendo) => {
                        const ativo = ativos.find(a => a.id === dividendo.ativo);
                        return (
                          <tr key={dividendo.id}>
                            <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-primary-600 sm:pl-6">
                              <div className="flex items-center">
                                {ativo && (
                                  <img 
                                    src={ativo.icone_url_display || 'https://cdn-icons-png.flaticon.com/512/2830/2830284.png'} 
                                    alt={`${ativo.ticker} icon`}
                                    className="h-6 w-6 rounded-full mr-2 object-cover bg-gray-100"
                                    onError={(e) => {
                                      e.currentTarget.src = 'https://cdn-icons-png.flaticon.com/512/2830/2830284.png';
                                      e.currentTarget.onerror = null;
                                    }}
                                  />
                                )}
                                <span>{dividendo.ativo_display}</span>
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                              {format(new Date(dividendo.data), 'dd/MM/yyyy')}
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm text-right text-gray-500">
                              {formatCurrency(dividendo.valor, dividendo.ativo)}
                            </td>
                            <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                              <Tooltip title="Editar">
                                <IconButton
                                  onClick={() => handleEdit(dividendo)}
                                  size="small"
                                  className="text-primary-600 hover:text-primary-900"
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Excluir">
                                <IconButton
                                  onClick={() => dividendo.id && handleDelete(dividendo.id)}
                                  size="small"
                                  className="text-red-600 hover:text-red-900"
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-sm text-gray-500">
                          Nenhum dividendo encontrado
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
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
                  de <span className="font-medium">{totalCount}</span> dividendos
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
                      key={`dividendos-page-${page}`}
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