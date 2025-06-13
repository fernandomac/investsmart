import { useEffect, useState, useCallback, useRef, memo } from 'react'
import type { Ativo, Categoria } from '../services/api'
import { ativoService, categoriaService } from '../services/api'
import { format } from 'date-fns'
import { Tooltip } from '@mui/material'
import { Table, TableHead, TableBody, TableRow, TableCell } from '@mui/material'
import { IconButton } from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import WarningIcon from '@mui/icons-material/Warning'
import SearchIcon from '@mui/icons-material/Search'
import CloseIcon from '@mui/icons-material/Close'
import FilterListIcon from '@mui/icons-material/FilterList'

const formatCurrency = (value: number, currency: string = 'BRL') => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency
  }).format(value);
};

// Separate TickerFilter component
const TickerFilter = memo(({ onFilterChange }: { onFilterChange: (value: string) => void }) => {
  const handleChange = useCallback(
    debounce((value: string) => {
      onFilterChange(value)
    }, 300),
    [onFilterChange]
  )

  return (
    <div className="w-full sm:w-auto">
      <label htmlFor="ticker-filter" className="block text-sm font-medium text-gray-700 mb-2">
        Filtrar por Ticker
      </label>
      <div className="relative rounded-md shadow-sm">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <SearchIcon className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          id="ticker-filter"
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Digite o ticker..."
          className="block w-full pl-10 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
        />
      </div>
    </div>
  )
})

TickerFilter.displayName = 'TickerFilter'

function Ativos() {
  const [ativos, setAtivos] = useState<Ativo[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [currencyFilter, setCurrencyFilter] = useState<string>('BRL')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingAtivo, setEditingAtivo] = useState<Ativo | null>(null)
  const [priceFetchError, setPriceFetchError] = useState<{[key: string]: boolean}>({})
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [pageSize] = useState(10) // Match backend PAGE_SIZE
  const [allAtivos, setAllAtivos] = useState<Ativo[]>([]) // For peso calculation across all pages
  
  const [formData, setFormData] = useState({
    ticker: '',
    nome: '',
    moeda: '',
    categoria: '',
    peso: '0',
    dataVencimento: '',
    anotacao: '',
  })

  const [tickerFilter, setTickerFilter] = useState('')
  const filterInputRef = useRef<HTMLInputElement>(null)

  const MOEDA_OPTIONS = [
    { value: 'BRL', label: 'Real (BRL)' },
    { value: 'USD', label: 'Dólar (USD)' },
    { value: 'EUR', label: 'Euro (EUR)' },
    { value: 'GBP', label: 'Libra (GBP)' },
  ]

  const getFilteredAtivos = () => {
    return ativos.filter(ativo => ativo.moeda === currencyFilter)
  }

  const getAvailableCurrencies = () => {
    const currencies = Array.from(new Set(allAtivos.map(ativo => ativo.moeda)))
    return currencies.sort()
  }

  const getAllFilteredAtivos = () => {
    return allAtivos.filter(ativo => ativo.moeda === currencyFilter)
  }

  const getCurrencyDisplayName = (currency: string) => {
    const currencyNames: { [key: string]: string } = {
      'BRL': 'Real (BRL)',
      'USD': 'Dólar (USD)',
      'EUR': 'Euro (EUR)',
      'GBP': 'Libra (GBP)'
    }
    return currencyNames[currency] || currency
  }

  const fetchAllAtivos = useCallback(async () => {
    try {
      const response = await ativoService.getAll(1, 1000, tickerFilter)
      setAllAtivos(response.data.results)
      
      if (response.data.results.length > 0) {
        const availableCurrencies = Array.from(new Set(response.data.results.map(ativo => ativo.moeda)))
        if (!availableCurrencies.includes('BRL') && availableCurrencies.length > 0) {
          setCurrencyFilter(availableCurrencies[0] as string)
        }
      }
    } catch (error) {
      console.error('Error fetching all ativos:', error)
    }
  }, [tickerFilter])

  const fetchData = useCallback(async (page: number = 1) => {
    setLoading(true)
    try {
      const [ativosResponse, categoriasResponse] = await Promise.all([
        ativoService.getAll(page, pageSize, tickerFilter),
        categoriaService.getAll()
      ])
      
      setAtivos(ativosResponse.data.results)
      setTotalCount(ativosResponse.data.count)
      setTotalPages(Math.ceil(ativosResponse.data.count / pageSize))
      setCurrentPage(page)
      
      setCategorias(categoriasResponse.data)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }, [pageSize, tickerFilter])

  useEffect(() => {
    fetchAllAtivos()
    fetchData(1)
  }, []) // Only fetch on initial load

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      fetchData(newPage)
    }
  }

  const handleRefresh = () => {
    fetchAllAtivos()
    fetchData(currentPage)
  }

  const handleEdit = (ativo: Ativo) => {
    setEditingAtivo(ativo)
    setFormData({
      ticker: ativo.ticker,
      nome: ativo.nome,
      moeda: ativo.moeda,
      categoria: String(ativo.categoria),
      peso: String(ativo.peso || 0),
      dataVencimento: ativo.dataVencimento || '',
      anotacao: ativo.anotacao || '',
    })
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      // Make sure all required fields are filled
      if (!formData.ticker || !formData.nome || !formData.moeda || !formData.categoria) {
        alert('Todos os campos são obrigatórios')
        return
      }

      // Format the data according to the API expectations
      const data = {
        ticker: formData.ticker.toUpperCase(), // Ensure ticker is uppercase
        nome: formData.nome,
        moeda: formData.moeda,
        categoria: parseInt(formData.categoria),
        peso: parseFloat(formData.peso),
        dataVencimento: formData.dataVencimento || null,
        anotacao: formData.anotacao,
      }

      if (editingAtivo) {
        await ativoService.update(editingAtivo.id, data)
      } else {
        await ativoService.create(data)
      }
      
      await Promise.all([
        fetchAllAtivos(), // Refresh all ativos for peso calculation
        fetchData(currentPage) // Refresh current page data
      ])
      setShowForm(false)
      setFormData({ ticker: '', nome: '', moeda: '', categoria: '', peso: '0', dataVencimento: '', anotacao: '' })
      setEditingAtivo(null)
    } catch (error: any) {
      console.error('Erro ao salvar ativo:', error)
      if (error.response?.data) {
        // Show the specific error message from the backend
        const errorMessage = typeof error.response.data === 'object' 
          ? Object.values(error.response.data).join('\n')
          : error.response.data.toString()
        alert(`Erro ao salvar ativo: ${errorMessage}`)
      } else {
        alert('Erro ao salvar ativo. Por favor, tente novamente.')
      }
    }
  }

  // Calculate total peso for the selected currency across all ativos (not just current page)
  const filteredAtivos = getFilteredAtivos()
  const allFilteredAtivos = getAllFilteredAtivos()
  const totalPeso = allFilteredAtivos.reduce((sum, ativo) => sum + Number(ativo.peso || 0), 0)
  
  // Determine status color
  const getPesoStatusColor = (total: number) => {
    if (total === 100) return 'text-green-600'
    if (total < 100) return 'text-yellow-600'
    return 'text-red-600'
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

  const calculateTotalInvestido = (ativo: Ativo) => {
    return ativo.quantidade * ativo.preco_medio
  }

  const calculateRendimento = (ativo: Ativo) => {
    const totalInvestido = calculateTotalInvestido(ativo)
    return ativo.valor_atual - totalInvestido
  }

  const calculateRendimentoPercentual = (ativo: Ativo) => {
    const totalInvestido = calculateTotalInvestido(ativo)
    if (totalInvestido === 0) return 0
    return ((ativo.valor_atual - totalInvestido) / totalInvestido) * 100
  }

  const getValorAtualDisplay = (ativo: Ativo) => {
    if (ativo.is_preco_estimado) {
      return (
        <Tooltip title="Valor estimado - não foi possível obter o preço atual">
          <span style={{ color: '#ffa726' }}>
            {formatCurrency(ativo.valor_atual, ativo.moeda)} *
          </span>
        </Tooltip>
      );
    }
    return formatCurrency(ativo.valor_atual, ativo.moeda);
  }

  const getRendimentoDisplay = (ativo: Ativo) => {
    const rendimento = calculateRendimento(ativo)
    const rendimentoPercentual = calculateRendimentoPercentual(ativo)
    const color = rendimento >= 0 ? '#4caf50' : '#f44336'
    
    return (
      <div>
        <div style={{ color }}>{formatCurrency(rendimento, ativo.moeda)}</div>
        <div style={{ color, fontSize: '0.8em' }}>
          ({rendimentoPercentual.toFixed(2)}%)
        </div>
      </div>
    )
  }

  const handleTickerFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTickerFilter(e.target.value)
  }

  const handleFilter = () => {
    fetchAllAtivos()
    fetchData(1)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="bg-gray-50 min-h-screen -mt-8 -mx-4 px-4 py-8 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-800">Ativos</h1>
          <p className="mt-2 text-sm text-gray-600">
            Lista de todos os seus ativos de investimento.
          </p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none flex gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            className="rounded-md bg-gray-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-600"
          >
            Atualizar
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingAtivo(null)
              setFormData({
                ticker: '',
                nome: '',
                moeda: 'BRL',
                categoria: '',
                peso: '0',
                dataVencimento: '',
                anotacao: '',
              })
              setShowForm(true)
            }}
            className="rounded-md bg-primary-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
          >
            Adicionar Ativo
          </button>
        </div>
      </div>

      {/* Filters Section */}
      <div className="mt-6 flex items-center justify-end gap-4">
        <select
          id="currency-filter"
          value={currencyFilter}
          onChange={(e) => setCurrencyFilter(e.target.value)}
          className="h-10 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
        >
          {getAvailableCurrencies().map(currency => (
            <option key={currency} value={currency}>
              {getCurrencyDisplayName(currency)}
            </option>
          ))}
        </select>

        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <SearchIcon className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            id="ticker-filter"
            value={tickerFilter}
            onChange={handleTickerFilterChange}
            placeholder="Filtrar por ticker..."
            className="h-10 block w-full pl-10 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
          />
        </div>

        <button
          onClick={handleFilter}
          className="h-10 inline-flex items-center px-4 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          <FilterListIcon className="h-5 w-5 mr-2" />
          Filtrar
        </button>
      </div>

      {/* Form Section */}
      {showForm && (
        <div className="mt-6 bg-blue-50 shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">
              {editingAtivo ? 'Editar Ativo' : 'Adicionar Ativo'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <input
                    type="text"
                    value={formData.ticker}
                    onChange={(e) => setFormData({...formData, ticker: e.target.value})}
                    placeholder="Ticker"
                    className="h-10 block w-full px-3 rounded-md border-gray-300 bg-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm text-gray-800 placeholder-gray-500"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    value={formData.nome}
                    onChange={(e) => setFormData({...formData, nome: e.target.value})}
                    placeholder="Nome"
                    className="h-10 block w-full px-3 rounded-md border-gray-300 bg-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm text-gray-800 placeholder-gray-500"
                  />
                </div>
                <div>
                  <select
                    value={formData.moeda}
                    onChange={(e) => setFormData({...formData, moeda: e.target.value})}
                    className="h-10 block w-full px-3 rounded-md border-gray-300 bg-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm text-gray-800"
                  >
                    <option value="" className="text-gray-500">Selecione a moeda</option>
                    {MOEDA_OPTIONS.map(option => (
                      <option key={option.value} value={option.value} className="text-gray-800">
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <select
                    value={formData.categoria}
                    onChange={(e) => setFormData({...formData, categoria: e.target.value})}
                    className="h-10 block w-full px-3 rounded-md border-gray-300 bg-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm text-gray-800"
                  >
                    <option value="" className="text-gray-500">Selecione a categoria</option>
                    {categorias.map(categoria => (
                      <option key={categoria.id} value={categoria.id} className="text-gray-800">
                        {categoria.tipo} - {categoria.subtipo}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.peso}
                    onChange={(e) => setFormData({...formData, peso: e.target.value})}
                    placeholder="Peso (%)"
                    className="h-10 block w-full px-3 rounded-md border-gray-300 bg-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm text-gray-800 placeholder-gray-500"
                  />
                </div>
                <div>
                  <input
                    type="date"
                    value={formData.dataVencimento}
                    onChange={(e) => setFormData({...formData, dataVencimento: e.target.value})}
                    className="h-10 block w-full px-3 rounded-md border-gray-300 bg-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm text-gray-800"
                  />
                </div>
                <div className="sm:col-span-2">
                  <textarea
                    value={formData.anotacao}
                    onChange={(e) => setFormData({...formData, anotacao: e.target.value})}
                    placeholder="Anotação"
                    rows={3}
                    className="block w-full px-3 py-2 rounded-md border-gray-300 bg-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm text-gray-800 placeholder-gray-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setFormData({ ticker: '', nome: '', moeda: '', categoria: '', peso: '0', dataVencimento: '', anotacao: '' })
                    setEditingAtivo(null)
                  }}
                  className="h-10 inline-flex items-center px-4 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="h-10 inline-flex items-center px-4 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  {editingAtivo ? 'Salvar' : 'Adicionar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="mt-8 flow-root">
        <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Ticker</TableCell>
                    <TableCell>Categoria</TableCell>
                    <TableCell>Quantidade</TableCell>
                    <TableCell>Preço Médio</TableCell>
                    <TableCell>Total Investido</TableCell>
                    <TableCell>Valor Atual</TableCell>
                    <TableCell>Rendimento</TableCell>
                    <TableCell>Peso (%)</TableCell>
                    <TableCell>Ações</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredAtivos.map((ativo) => (
                    <TableRow key={ativo.id}>
                      <TableCell>
                        <div>
                          <div style={{ fontWeight: 'bold' }}>{ativo.ticker}</div>
                          {ativo.nome && (
                            <div style={{ fontSize: '0.8em', color: 'gray' }}>{ativo.nome}</div>
                          )}
                          {ativo.dataVencimento && (
                            <div style={{ fontSize: '0.8em', color: 'gray' }}>
                              {format(new Date(ativo.dataVencimento), 'dd/MM/yyyy')}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{ativo.categoria_display || '-'}</TableCell>
                      <TableCell>{ativo.quantidade.toLocaleString('pt-BR', { minimumFractionDigits: 6 })}</TableCell>
                      <TableCell>{formatCurrency(ativo.preco_medio)}</TableCell>
                      <TableCell>{formatCurrency(calculateTotalInvestido(ativo))}</TableCell>
                      <TableCell>
                        <div>
                          {formatCurrency(ativo.valor_atual)}
                          {ativo.is_preco_estimado && (
                            <Tooltip title="Preço estimado">
                              <WarningIcon color="warning" fontSize="small" style={{ marginLeft: 4 }} />
                            </Tooltip>
                          )}
                          <div style={{ fontSize: '0.75rem', color: 'gray', marginTop: 2 }}>
                            {formatCurrency(ativo.preco_atual)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <span style={{ color: ativo.rendimento >= 0 ? 'green' : 'red' }}>
                            {getRendimentoDisplay(ativo)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div style={{ color: getPesoStatusColor(Number(ativo.peso || 0)) }}>
                          {Number(ativo.peso || 0).toFixed(2)}%
                        </div>
                      </TableCell>
                      <TableCell align="right">
                        <IconButton onClick={() => handleEdit(ativo)}>
                          <EditIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
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
                  de <span className="font-medium">{totalCount}</span> ativos
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
                      key={`page-${page}`}
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

export default Ativos 