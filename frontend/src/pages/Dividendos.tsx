import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import api from '../services/api'
import type { Dividendo } from '../types/dividendo'
import type { Ativo } from '../types/ativo'

export default function Dividendos() {
  const [dividendos, setDividendos] = useState<Dividendo[]>([])
  const [ativos, setAtivos] = useState<Ativo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingDividendo, setEditingDividendo] = useState<Dividendo | null>(null)
  const [formData, setFormData] = useState({
    ativo: '',
    data: format(new Date(), 'yyyy-MM-dd'),
    valor: ''
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [dividendosResponse, ativosResponse] = await Promise.all([
        api.get('/dividendos/'),
        api.get('/ativos/')
      ])
      
      // Ensure we have arrays, even if empty
      const dividendosData = Array.isArray(dividendosResponse.data) ? dividendosResponse.data : []
      const ativosData = Array.isArray(ativosResponse.data) ? ativosResponse.data : (ativosResponse.data?.results || [])
      
      setDividendos(dividendosData)
      setAtivos(ativosData)
      setLoading(false)
    } catch (error) {
      console.error('Error fetching data:', error)
      setError('Erro ao carregar dados')
      setLoading(false)
      // Initialize with empty arrays on error
      setDividendos([])
      setAtivos([])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const payload = {
        ...formData,
        valor: Number(formData.valor),
        ativo: Number(formData.ativo)
      }

      if (editingDividendo) {
        await api.put(`/dividendos/${editingDividendo.id}/`, payload)
      } else {
        await api.post('/dividendos/', payload)
      }

      setIsModalOpen(false)
      setEditingDividendo(null)
      setFormData({
        ativo: '',
        data: format(new Date(), 'yyyy-MM-dd'),
        valor: ''
      })
      fetchData()
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
      await api.delete(`/dividendos/${id}/`)
      fetchData()
    } catch (error) {
      console.error('Error deleting dividendo:', error)
      setError('Erro ao excluir dividendo')
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
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-800">Dividendos</h1>
          <p className="mt-2 text-sm text-gray-600">
            Gerencie os dividendos recebidos dos seus ativos.
          </p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <button
            type="button"
            onClick={() => {
              setEditingDividendo(null)
              setFormData({
                ativo: '',
                data: format(new Date(), 'yyyy-MM-dd'),
                valor: ''
              })
              setIsModalOpen(true)
            }}
            className="rounded-md bg-primary-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
          >
            Adicionar Dividendo
          </button>
        </div>
      </div>

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
                    <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">
                      Valor
                    </th>
                    <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {dividendos.map((dividendo) => (
                    <tr key={dividendo.id}>
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-primary-600 sm:pl-6">
                        {dividendo.ativo_display}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {format(new Date(dividendo.data), 'dd/MM/yyyy')}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-right text-gray-500">
                        {dividendo.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        <button
                          onClick={() => handleEdit(dividendo)}
                          className="text-primary-600 hover:text-primary-900 bg-transparent mr-4"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => dividendo.id && handleDelete(dividendo.id)}
                          className="text-red-600 hover:text-red-900 bg-transparent"
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>

            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <form onSubmit={handleSubmit}>
                <div>
                  <div className="mt-3 text-center sm:mt-0 sm:text-left">
                    <h3 className="text-lg font-medium text-gray-900">
                      {editingDividendo ? 'Editar Dividendo' : 'Novo Dividendo'}
                    </h3>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                  <div className="sm:col-span-6">
                    <label htmlFor="ativo" className="block text-sm font-medium text-gray-700">
                      Ativo
                    </label>
                    <div className="mt-1">
                      <select
                        id="ativo"
                        name="ativo"
                        value={formData.ativo}
                        onChange={(e) => setFormData({ ...formData, ativo: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                        required
                      >
                        <option value="">Selecione um ativo</option>
                        {ativos && ativos.length > 0 && ativos.map((ativo) => (
                          <option key={ativo.id} value={ativo.id}>
                            {ativo.ticker} - {ativo.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="sm:col-span-3">
                    <label htmlFor="data" className="block text-sm font-medium text-gray-700">
                      Data
                    </label>
                    <div className="mt-1">
                      <input
                        type="date"
                        name="data"
                        id="data"
                        value={formData.data}
                        onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                        required
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-3">
                    <label htmlFor="valor" className="block text-sm font-medium text-gray-700">
                      Valor
                    </label>
                    <div className="mt-1">
                      <input
                        type="number"
                        name="valor"
                        id="valor"
                        step="0.01"
                        value={formData.valor}
                        onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                  <button
                    type="submit"
                    className="w-full inline-flex justify-center rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 sm:col-start-2"
                  >
                    {editingDividendo ? 'Salvar' : 'Adicionar'}
                  </button>
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
                    className="mt-3 w-full inline-flex justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-600 sm:mt-0 sm:col-start-1"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 