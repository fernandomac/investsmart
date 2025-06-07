import { useEffect, useState, useCallback } from 'react'
import type { Ativo, Categoria } from '../services/api'
import { ativoService, categoriaService } from '../services/api'
import { format } from 'date-fns'

function Ativos() {
  const [ativos, setAtivos] = useState<Ativo[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [currencyFilter, setCurrencyFilter] = useState<string>('BRL')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingAtivo, setEditingAtivo] = useState<Ativo | null>(null)
  const [formData, setFormData] = useState({
    ticker: '',
    nome: '',
    moeda: '',
    categoria: '',
    peso: '0',
    dataVencimento: '',
    anotacao: '',
  })

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
    const currencies = Array.from(new Set(ativos.map(ativo => ativo.moeda)))
    return currencies.sort()
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

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [ativosResponse, categoriasResponse] = await Promise.all([
        ativoService.getAll(),
        categoriaService.getAll()
      ])
      setAtivos(ativosResponse.data.results)
      setCategorias(categoriasResponse.data)

      // Set default currency to the first available currency if BRL is not available
      if (ativosResponse.data.results.length > 0) {
        const availableCurrencies = Array.from(new Set(ativosResponse.data.results.map(ativo => ativo.moeda)))
        if (!availableCurrencies.includes('BRL') && availableCurrencies.length > 0) {
          setCurrencyFilter(availableCurrencies[0] as string)
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

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
      
      await fetchData() // Refresh data after creating/updating asset
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

  // Calculate total peso for the selected currency only
  const filteredAtivos = getFilteredAtivos()
  const totalPeso = filteredAtivos.reduce((sum, ativo) => sum + Number(ativo.peso || 0), 0)
  
  // Determine status color
  const getPesoStatusColor = (total: number) => {
    if (total === 100) return 'text-green-600'
    if (total < 100) return 'text-yellow-600'
    return 'text-red-600'
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
            onClick={fetchData}
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

      {/* Currency Filter - Separate row */}
      <div className="mt-6 flex justify-end">
        <div>
          <label htmlFor="currency-filter" className="block text-sm font-medium text-gray-700 mb-2">
            Moeda
          </label>
          <select
            id="currency-filter"
            value={currencyFilter}
            onChange={(e) => setCurrencyFilter(e.target.value)}
            className="rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm min-w-[180px]"
          >
            {getAvailableCurrencies().map(currency => (
              <option key={currency} value={currency}>
                {getCurrencyDisplayName(currency)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="ticker" className="block text-sm font-medium text-gray-700">
                    Ticker
                  </label>
                  <input
                    type="text"
                    name="ticker"
                    id="ticker"
                    value={formData.ticker}
                    onChange={(e) => setFormData({ ...formData, ticker: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="nome" className="block text-sm font-medium text-gray-700">
                    Nome
                  </label>
                  <input
                    type="text"
                    name="nome"
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="moeda" className="block text-sm font-medium text-gray-700">
                    Moeda
                  </label>
                  <select
                    name="moeda"
                    id="moeda"
                    value={formData.moeda}
                    onChange={(e) => setFormData({ ...formData, moeda: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    required
                  >
                    <option value="">Selecione uma moeda</option>
                    {MOEDA_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="categoria" className="block text-sm font-medium text-gray-700">
                    Categoria
                  </label>
                  <select
                    name="categoria"
                    id="categoria"
                    value={formData.categoria}
                    onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    required
                  >
                    <option value="">Selecione uma categoria</option>
                    {categorias.map(categoria => (
                      <option key={categoria.id} value={categoria.id}>
                        {categoria.tipo} - {categoria.subtipo}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="peso" className="block text-sm font-medium text-gray-700">
                    Peso (%)
                  </label>
                  <input
                    type="number"
                    name="peso"
                    id="peso"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.peso}
                    onChange={(e) => setFormData({ ...formData, peso: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                  <p className="mt-1 text-sm text-gray-500">Percentual desejado na carteira (por moeda)</p>
                </div>

                <div>
                  <label htmlFor="dataVencimento" className="block text-sm font-medium text-gray-700">
                    Data de Vencimento (opcional)
                  </label>
                  <input
                    type="date"
                    name="dataVencimento"
                    id="dataVencimento"
                    value={formData.dataVencimento}
                    onChange={(e) => setFormData({ ...formData, dataVencimento: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="anotacao" className="block text-sm font-medium text-gray-700">
                    Anotações
                  </label>
                  <textarea
                    name="anotacao"
                    id="anotacao"
                    value={formData.anotacao}
                    onChange={(e) => setFormData({ ...formData, anotacao: e.target.value })}
                    rows={3}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                  <p className="mt-1 text-sm text-gray-500">Anotações gerais sobre o ativo</p>
                </div>

                <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                  <button
                    type="submit"
                    className="inline-flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 sm:col-start-2"
                  >
                    {editingAtivo ? 'Salvar' : 'Adicionar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-1 sm:mt-0"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
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
                      Ticker
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Nome
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Categoria
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Moeda
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">
                      Peso ({currencyFilter}) (%)
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Vencimento
                    </th>
                    <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {filteredAtivos.length > 0 ? (
                    <>
                      {filteredAtivos.map((ativo) => (
                        <tr key={ativo.id}>
                          <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-primary-600 sm:pl-6">
                            {ativo.ticker}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {ativo.nome}
                            {ativo.anotacao && (
                              <p className="text-xs text-gray-400 mt-1">{ativo.anotacao}</p>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {ativo.categoria_display || '-'}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{ativo.moeda}</td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-right text-gray-500">
                            {Number(ativo.peso || 0).toFixed(2)}%
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {ativo.dataVencimento ? format(new Date(ativo.dataVencimento), 'dd/MM/yyyy') : '-'}
                          </td>
                          <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                            <button
                              type="button"
                              onClick={() => handleEdit(ativo)}
                              className="text-primary-600 hover:text-primary-900"
                            >
                              Editar
                            </button>
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-gray-50">
                        <td colSpan={4} className="py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                          Total ({currencyFilter})
                        </td>
                        <td className={`whitespace-nowrap px-3 py-4 text-sm text-right font-medium ${getPesoStatusColor(totalPeso)}`}>
                          {totalPeso.toFixed(2)}%
                          {totalPeso !== 100 && (
                            <p className="text-xs mt-1">
                              {totalPeso < 100 
                                ? `Faltam ${(100 - totalPeso).toFixed(2)}%`
                                : `Excesso de ${(totalPeso - 100).toFixed(2)}%`}
                            </p>
                          )}
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    </>
                  ) : (
                    <tr>
                      <td colSpan={7} className="text-center py-4 text-sm text-gray-500">
                        Nenhum ativo encontrado para {getCurrencyDisplayName(currencyFilter)}
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

export default Ativos 