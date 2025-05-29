import { useEffect, useState } from 'react'
import type { Ativo } from '../services/api'
import { ativoService } from '../services/api'

export default function Dashboard() {
  const [ativos, setAtivos] = useState<Ativo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAtivos = async () => {
      try {
        const response = await ativoService.getAll()
        setAtivos(response.data.results)
      } catch (error) {
        console.error('Error fetching ativos:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchAtivos()
  }, [])

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
          <h1 className="text-2xl font-semibold text-gray-800">Dashboard</h1>
          <p className="mt-2 text-sm text-gray-600">
            Visão geral da sua carteira de investimentos.
          </p>
        </div>
      </div>
      
      <div className="mt-6">
        <div className="overflow-hidden bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-base font-semibold leading-6 text-gray-900">Ativos Recentes</h3>
            <div className="mt-4 divide-y divide-gray-200">
              {ativos.length > 0 ? (
                ativos.map((ativo) => (
                  <div key={ativo.id} className="py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-primary-600">{ativo.ticker}</p>
                        <p className="text-sm text-gray-500">{ativo.nome}</p>
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(ativo.dataCriacao).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="py-4 text-sm text-gray-500">Nenhum ativo cadastrado.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 