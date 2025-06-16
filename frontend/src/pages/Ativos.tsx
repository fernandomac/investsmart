import { useEffect, useState, useCallback, useRef, memo } from 'react'
import type { Ativo, Categoria } from '../services/api'
import { ativoService, categoriaService } from '../services/api'
import { format } from 'date-fns'
import { Tooltip } from '@mui/material'
import { Table, TableHead, TableBody, TableRow, TableCell } from '@mui/material'
import { IconButton } from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import WarningIcon from '@mui/icons-material/Warning'
import SearchIcon from '@mui/icons-material/Search'
import FilterListIcon from '@mui/icons-material/FilterList'
import RefreshIcon from '@mui/icons-material/Refresh'
import { debounce } from 'lodash'

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
  const [pageSize] = useState(10)
  const [totalPeso, setTotalPeso] = useState(0)
  const [pesoWarning, setPesoWarning] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    ticker: '',
    nome: '',
    moeda: '',
    categoria: '',
    peso: '0',
    dataVencimento: '',
    anotacao: '',
    valor_atual: '0',
    icone_url: '',
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
    return ativos.filter(ativo => {
      const matchesCurrency = ativo.moeda === currencyFilter
      const matchesTicker = !tickerFilter || ativo.ticker.toLowerCase().includes(tickerFilter.toLowerCase())
      return matchesCurrency && matchesTicker
    })
  }

  const getAvailableCurrencies = () => {
    const currencies = Array.from(new Set(ativos.map(ativo => ativo.moeda)))
    return currencies.sort()
  }

  const getCurrencyLabel = (currency: string) => {
    const option = MOEDA_OPTIONS.find(opt => opt.value === currency)
    return option ? option.label : currency
  }

  const calculateTotalPeso = useCallback((filteredAtivos: Ativo[]) => {
    const total = filteredAtivos.reduce((sum, ativo) => sum + Number(ativo.peso || 0), 0)
    setTotalPeso(total)
    
    if (total !== 100) {
      setPesoWarning(`O peso total (${total.toFixed(2)}%) deve ser igual a 100%`)
    } else {
      setPesoWarning(null)
    }
  }, [])

  const calculateCurrentPeso = (ativo: Ativo, filteredAtivos: Ativo[]) => {
    // Filter ativos by the same currency as the current ativo
    const ativosSameCurrency = filteredAtivos.filter(a => a.moeda === ativo.moeda)
    const totalValorAtual = ativosSameCurrency.reduce((sum, a) => sum + Number(a.valor_atual || 0), 0)
    
    if (totalValorAtual === 0) return 0
    
    const currentPeso = (Number(ativo.valor_atual || 0) / totalValorAtual) * 100
    return isNaN(currentPeso) ? 0 : currentPeso
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [ativosResponse, categoriasResponse] = await Promise.all([
        ativoService.getAll(1, 1000, tickerFilter), // Fetch all ativos
        categoriaService.getAll()
      ])
      
      // Get all ativos by making multiple requests if needed
      let allAtivos = ativosResponse.data.results
      let nextPage = ativosResponse.data.next
      
      while (nextPage) {
        const pageMatch = nextPage.match(/page=(\d+)/)
        const page = pageMatch ? parseInt(pageMatch[1]) : 1
        const nextResponse = await ativoService.getAll(page, 1000, tickerFilter)
        allAtivos = [...allAtivos, ...nextResponse.data.results]
        nextPage = nextResponse.data.next
      }
      
      setAtivos(allAtivos)
      setCurrentPage(1) // Reset to first page when data changes
      
      setCategorias(categoriasResponse.data)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }, [tickerFilter])

  useEffect(() => {
    fetchData()
  }, []) // Only fetch on initial load

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage)
    }
  }

  const handleRefresh = () => {
    fetchData()
  }

  // Calculate paginated ativos
  const filteredAtivos = getFilteredAtivos()
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, filteredAtivos.length)
  const paginatedAtivos = filteredAtivos.slice(startIndex, endIndex)
  const totalPages = Math.max(1, Math.ceil(filteredAtivos.length / pageSize))

  // Reset to first page if current page is out of bounds
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1)
    }
  }, [currentPage, totalPages])

  // Update total peso whenever filtered ativos change
  useEffect(() => {
    calculateTotalPeso(filteredAtivos)
  }, [filteredAtivos, calculateTotalPeso])

  const handleEdit = (ativo: Ativo) => {
    setEditingAtivo(ativo)
    setFormData({
      ticker: ativo.ticker,
      nome: ativo.nome,
      moeda: ativo.moeda,
      categoria: ativo.categoria.toString(),
      peso: ativo.peso.toString(),
      dataVencimento: ativo.dataVencimento || '',
      anotacao: ativo.anotacao || '',
      valor_atual: ativo.valor_atual.toString(),
      icone_url: ativo.icone_url || '',
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
        valor_atual: parseFloat(formData.valor_atual),
        icone_url: formData.icone_url || null,
      }

      let response;
      if (editingAtivo) {
        response = await ativoService.update(editingAtivo.id, data)
      } else {
        response = await ativoService.create(data)
      }
      
      // Update the ativo in the list with the response data
      if (editingAtivo) {
        setAtivos(prevAtivos => 
          prevAtivos.map(ativo => 
            ativo.id === editingAtivo.id ? response.data : ativo
          )
        )
      }
      
      await fetchData()
      setShowForm(false)
      setFormData({ ticker: '', nome: '', moeda: '', categoria: '', peso: '0', dataVencimento: '', anotacao: '', valor_atual: '0', icone_url: '' })
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

  // Determine status color
  const getPesoStatusColor = (total: number) => {
    if (total === 100) return 'text-green-600'
    if (total < 100) return 'text-yellow-600'
    return 'text-red-600'
  }

  // Helper for pagination page numbers
  const getPageNumbers = () => {
    const pages = []
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i)
    }
    return pages
  }

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
    fetchData()
  }

  const handleUpdatePrice = async (ativo: Ativo) => {
    try {
      await ativoService.updatePrice(ativo.id)
      await fetchData()
    } catch (error) {
      console.error('Error updating price:', error)
      alert('Erro ao atualizar preço. Por favor, tente novamente.')
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setFormData({ 
      ticker: '', 
      nome: '', 
      moeda: '', 
      categoria: '', 
      peso: '0', 
      dataVencimento: '', 
      anotacao: '', 
      valor_atual: '0',
      icone_url: '',
    })
    setEditingAtivo(null)
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
          <div className="mt-2 text-sm">
            {pesoWarning ? (
              <span className="text-red-600">{pesoWarning}</span>
            ) : (
              <span className="text-gray-600">Peso Total: {totalPeso.toFixed(2)}%</span>
            )}
          </div>
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
                valor_atual: '0',
                icone_url: '',
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
              {getCurrencyLabel(currency)}
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
                <div className="space-y-2">
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
                    type="number"
                    step="0.01"
                    value={formData.valor_atual}
                    onChange={(e) => setFormData({...formData, valor_atual: e.target.value})}
                    placeholder="Valor Atual"
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
                <div>
                  <div className="flex items-center gap-2">
                    {formData.icone_url && (
                        <img 
                          src={formData.icone_url} 
                          alt="Ícone" 
                          className="h-6 w-6 object-contain"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                          }}
                        />
                      )}
                    <input
                        type="url"
                        value={formData.icone_url}
                        onChange={(e) => setFormData({...formData, icone_url: e.target.value})}
                        placeholder="URL do ícone"
                        className="h-10 flex-1 px-3 rounded-md border-gray-300 bg-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm text-gray-800 placeholder-gray-500"
                      />
                  </div>
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
                  onClick={handleCancel}
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
                  {paginatedAtivos.map((ativo) => (
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
                          <div style={{ fontSize: '0.75rem', color: 'gray', marginTop: 2 }}>
                            {calculateCurrentPeso(ativo, filteredAtivos).toFixed(2)}%
                          </div>
                        </div>
                      </TableCell>
                      <TableCell align="right">
                        <IconButton onClick={() => handleUpdatePrice(ativo)}>
                          <RefreshIcon />
                        </IconButton>
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
        {filteredAtivos.length > 0 && (
          <div className="mt-4 flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
            <div className="flex flex-1 justify-between sm:hidden">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Próximo
              </button>
            </div>
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Mostrando <span className="font-medium">{startIndex + 1}</span> a{' '}
                  <span className="font-medium">{endIndex}</span>{' '}
                  de <span className="font-medium">{filteredAtivos.length}</span> ativos
                </p>
              </div>
              <div>
                <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    style={{
                      backgroundColor: 'transparent',
                      color: '#374151',
                      border: '1px solid #e5e7eb',
                      padding: '0.5rem 0.75rem',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      position: 'relative',
                      borderTopLeftRadius: '0.375rem',
                      borderBottomLeftRadius: '0.375rem',
                    }}
                    className="relative inline-flex items-center hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                  >
                    <span className="sr-only">Anterior</span>
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                    </svg>
                  </button>
                  {getPageNumbers().map((page) => (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      style={{
                        backgroundColor: page === currentPage ? '#f3f4f6' : 'transparent',
                        color: page === currentPage ? '#1f2937' : '#374151',
                        border: '1px solid #e5e7eb',
                        padding: '0.5rem 1rem',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        position: 'relative',
                        zIndex: page === currentPage ? 10 : 1,
                      }}
                      className="relative inline-flex items-center hover:bg-gray-50 focus:z-20 focus:outline-offset-0"
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    style={{
                      backgroundColor: 'transparent',
                      color: '#374151',
                      border: '1px solid #e5e7eb',
                      padding: '0.5rem 0.75rem',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      position: 'relative',
                      borderTopRightRadius: '0.375rem',
                      borderBottomRightRadius: '0.375rem',
                    }}
                    className="relative inline-flex items-center hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
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