import { useEffect, useState, useCallback } from 'react'
import type { Ativo, Categoria, TipoCategoria, SubtipoCategoria } from '../services/api'
import { ativoService, categoriaService } from '../services/api'

function Ativos() {
  const [ativos, setAtivos] = useState<Ativo[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingAtivo, setEditingAtivo] = useState<Ativo | null>(null)
  const [formData, setFormData] = useState({
    ticker: '',
    nome: '',
    moeda: '',
    categoria: '',
  })

  const MOEDA_OPTIONS = [
    { value: 'BRL', label: 'Real (BRL)' },
    { value: 'USD', label: 'Dólar (USD)' },
    { value: 'EUR', label: 'Euro (EUR)' },
    { value: 'GBP', label: 'Libra (GBP)' },
  ]

  const TIPO_DISPLAY: Record<TipoCategoria, string> = {
    'RENDA_FIXA': 'Renda Fixa',
    'RENDA_VARIAVEL': 'Renda Variável',
    'FUNDOS': 'Fundos de Investimento',
    'EXTERIOR': 'Investimentos no Exterior'
  };

  const SUBTIPO_DISPLAY: Record<SubtipoCategoria, string> = {
    'TESOURO_DIRETO': 'Tesouro Direto',
    'CDB': 'CDB',
    'LCI_LCA': 'LCI/LCA',
    'DEBENTURES': 'Debêntures',
    'CRI_CRA': 'CRI/CRA',
    'POUPANCA': 'Poupança',
    'ACOES': 'Ações',
    'FII': 'FII',
    'ETFS': 'ETFs',
    'BDRS': 'BDRs',
    'CRIPTO': 'Criptomoedas',
    'FUNDO_RF': 'Fundos de Renda Fixa',
    'FUNDO_MULTI': 'Fundos Multimercado',
    'FUNDO_ACOES': 'Fundos de Ações',
    'FUNDO_CAMBIAL': 'Fundos Cambiais',
    'FUNDO_IMOB': 'Fundos Imobiliários',
    'PREVIDENCIA': 'Previdência Privada',
    'ETF_INTER': 'ETFs Internacionais',
    'ACOES_INTER': 'Ações Globais',
    'FUNDOS_INTER': 'Fundos Globais',
    'REITS': 'REITs'
  };

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [ativosResponse, categoriasResponse] = await Promise.all([
        ativoService.getAll(),
        categoriaService.getAll()
      ])
      setAtivos(ativosResponse.data.results)
      setCategorias(categoriasResponse.data)
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
      categoria: ativo.categoria.toString(),
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
        categoria: parseInt(formData.categoria)
      }

      if (editingAtivo) {
        await ativoService.update(editingAtivo.id, data)
      } else {
        await ativoService.create(data)
      }
      
      await fetchData() // Refresh data after creating/updating asset
      setShowForm(false)
      setFormData({ ticker: '', nome: '', moeda: '', categoria: '' })
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="bg-gray-50 min-h-screen -mt-8 -mx-4 px-4 py-8 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="sm:flex sm:items-center">
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
            onClick={() => setShowForm(true)}
            className="rounded-md bg-primary-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
          >
            Adicionar Ativo
          </button>
        </div>
      </div>

      {showForm && (
        <div className="mt-8">
          <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-lg shadow">
            <div>
              <label htmlFor="ticker" className="block text-sm font-medium text-gray-700">
                Ticker
              </label>
              <input
                type="text"
                id="ticker"
                name="ticker"
                value={formData.ticker}
                onChange={(e) => setFormData({ ...formData, ticker: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
                disabled={editingAtivo !== null}
              />
            </div>

            <div>
              <label htmlFor="nome" className="block text-sm font-medium text-gray-700">
                Nome
              </label>
              <input
                type="text"
                id="nome"
                name="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              />
            </div>

            <div>
              <label htmlFor="categoria" className="block text-sm font-medium text-gray-700">
                Categoria
              </label>
              <select
                id="categoria"
                name="categoria"
                value={formData.categoria}
                onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              >
                <option value="">Selecione uma categoria</option>
                {Object.keys(TIPO_DISPLAY).map((tipo) => (
                  <optgroup key={tipo} label={TIPO_DISPLAY[tipo as TipoCategoria]}>
                    {categorias
                      .filter(cat => cat.tipo === tipo)
                      .map((categoria) => (
                        <option key={categoria.id} value={categoria.id}>
                          {categoria.descricao}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="moeda" className="block text-sm font-medium text-gray-700">
                Moeda
              </label>
              <select
                id="moeda"
                name="moeda"
                value={formData.moeda}
                onChange={(e) => setFormData({ ...formData, moeda: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              >
                <option value="">Selecione uma moeda</option>
                {MOEDA_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  setEditingAtivo(null)
                  setFormData({ ticker: '', nome: '', moeda: '', categoria: '' })
                }}
                className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                {editingAtivo ? 'Atualizar' : 'Salvar'}
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
                    <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {ativos.length > 0 ? (
                    ativos.map((ativo) => (
                      <tr key={ativo.id}>
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-primary-600 sm:pl-6">
                          {ativo.ticker}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{ativo.nome}</td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {(ativo as any).categoria_display || '-'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{ativo.moeda}</td>
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
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="text-center py-4 text-sm text-gray-500">
                        Nenhum ativo encontrado
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