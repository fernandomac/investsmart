import { useEffect, useState } from 'react'
import type { Ativo } from '../types/ativo'
import type { Movimentacao } from '../types/movimentacao'
import api from '../services/api'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  Colors
} from 'chart.js'
import { Pie } from 'react-chartjs-2'

// Register ChartJS components
ChartJS.register(ArcElement, Tooltip, Legend, Colors)

interface MovimentacaoSummary {
  ticker: string
  nome: string
  quantidade: number
  valorTotal: number
  custoMedio: number
  moeda: string
  categoriaId: number
  categoriaNome: string
}

interface CategoriaSummary {
  nome: string
  valorTotal: number
  percentual: number
}

export default function Dashboard() {
  const [ativos, setAtivos] = useState<Ativo[]>([])
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [ativosResponse, movimentacoesResponse] = await Promise.all([
          api.get('/ativos/'),
          api.get('/movimentacoes/')
        ])
        
        // Handle both paginated and non-paginated responses
        const ativos = Array.isArray(ativosResponse.data) ? ativosResponse.data :
                      Array.isArray(ativosResponse.data.results) ? ativosResponse.data.results : []
        
        const movimentacoes = Array.isArray(movimentacoesResponse.data) ? movimentacoesResponse.data :
                             Array.isArray(movimentacoesResponse.data.results) ? movimentacoesResponse.data.results : []
        
        setAtivos(ativos)
        setMovimentacoes(movimentacoes)
      } catch (error) {
        console.error('Error fetching data:', error)
        setError('Erro ao carregar dados')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const calcularSumario = (): MovimentacaoSummary[] => {
    const sumario: { [key: string]: MovimentacaoSummary } = {}

    // Initialize summary with all ativos
    ativos.forEach(ativo => {
      sumario[ativo.ticker] = {
        ticker: ativo.ticker,
        nome: ativo.nome,
        quantidade: 0,
        valorTotal: 0,
        custoMedio: 0,
        moeda: ativo.moeda,
        categoriaId: ativo.categoria,
        categoriaNome: ativo.categoria_display
      }
    })

    // Calculate totals from movimentacoes
    movimentacoes.forEach(mov => {
      const ativo = ativos.find(a => a.id === mov.ativo)
      if (!ativo) return

      const summary = sumario[ativo.ticker]
      if (!summary) return

      switch (mov.operacao) {
        case 'COMPRA':
          summary.quantidade += Number(mov.quantidade)
          summary.valorTotal += Number(mov.custoTotal)
          break
        case 'VENDA':
          summary.quantidade -= Number(mov.quantidade)
          summary.valorTotal -= Number(mov.custoTotal)
          break
        case 'BONIFICACAO':
          summary.quantidade += Number(mov.quantidade)
          break
        case 'GRUPAMENTO':
          summary.quantidade = Number(mov.quantidade)
          break
        case 'DESDOBRAMENTO':
          summary.quantidade = Number(mov.quantidade)
          break
      }
    })

    // Calculate average cost
    Object.values(sumario).forEach(summary => {
      summary.custoMedio = summary.quantidade > 0 ? summary.valorTotal / summary.quantidade : 0
    })

    return Object.values(sumario)
  }

  const calcularSumarioPorCategoria = (sumario: MovimentacaoSummary[]): CategoriaSummary[] => {
    const categoriaMap: { [key: string]: number } = {}
    
    // Calculate total value for each category
    sumario.forEach(item => {
      const categoriaNome = item.categoriaNome
      if (!categoriaMap[categoriaNome]) {
        categoriaMap[categoriaNome] = 0
      }
      categoriaMap[categoriaNome] += Math.abs(item.valorTotal)
    })
    
    // Calculate total portfolio value
    const totalPortfolio = Object.values(categoriaMap).reduce((acc, curr) => acc + curr, 0)
    
    // Create summary array with percentages
    return Object.entries(categoriaMap)
      .map(([nome, valorTotal]) => ({
        nome,
        valorTotal,
        percentual: (valorTotal / totalPortfolio) * 100
      }))
      .sort((a, b) => b.valorTotal - a.valorTotal) // Sort by value, highest first
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

  const sumario = calcularSumario()
  const sumarioCategorias = calcularSumarioPorCategoria(sumario)

  const chartData = {
    labels: sumario.map(item => {
      const percentage = (Math.abs(item.valorTotal) / sumario.reduce((acc, curr) => acc + Math.abs(curr.valorTotal), 0) * 100).toFixed(1)
      return `${item.ticker} (${item.moeda}) - ${percentage}%`
    }),
    datasets: [
      {
        data: sumario.map(item => Math.abs(item.valorTotal)),
        backgroundColor: [
          '#3B82F6', // blue-500
          '#10B981', // emerald-500
          '#F59E0B', // amber-500
          '#EF4444', // red-500
          '#8B5CF6', // violet-500
          '#EC4899', // pink-500
          '#14B8A6', // teal-500
          '#F97316', // orange-500
          '#6366F1', // indigo-500
          '#84CC16', // lime-500
          '#9333EA', // purple-500
          '#06B6D4', // cyan-500
        ],
        borderColor: [
          '#2563EB', // blue-600
          '#059669', // emerald-600
          '#D97706', // amber-600
          '#DC2626', // red-600
          '#7C3AED', // violet-600
          '#DB2777', // pink-600
          '#0D9488', // teal-600
          '#EA580C', // orange-600
          '#4F46E5', // indigo-600
          '#65A30D', // lime-600
          '#7E22CE', // purple-600
          '#0891B2', // cyan-600
        ],
        borderWidth: 1,
      },
    ],
  }

  const categoriaChartData = {
    labels: sumarioCategorias.map(item => `${item.nome} - ${item.percentual.toFixed(1)}%`),
    datasets: [
      {
        data: sumarioCategorias.map(item => item.valorTotal),
        backgroundColor: [
          '#3B82F6', // blue-500
          '#10B981', // emerald-500
          '#F59E0B', // amber-500
          '#EF4444', // red-500
          '#8B5CF6', // violet-500
          '#EC4899', // pink-500
        ],
        borderColor: [
          '#2563EB', // blue-600
          '#059669', // emerald-600
          '#D97706', // amber-600
          '#DC2626', // red-600
          '#7C3AED', // violet-600
          '#DB2777', // pink-600
        ],
        borderWidth: 1,
      },
    ],
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          font: {
            size: 12
          },
          padding: 20,
          usePointStyle: true,
          pointStyle: 'circle',
          generateLabels: (chart: any) => {
            const data = chart.data
            if (data.labels.length && data.datasets.length) {
              return data.labels.map((label: string, i: number) => ({
                text: label,
                fillStyle: data.datasets[0].backgroundColor[i],
                strokeStyle: data.datasets[0].borderColor[i],
                lineWidth: 1,
                hidden: false,
                index: i
              }))
            }
            return []
          }
        }
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const item = sumario[context.dataIndex]
            return [
              `${item.ticker}: ${item.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: item.moeda })}`,
              `Quantidade: ${item.quantidade.toLocaleString('pt-BR', { minimumFractionDigits: 6 })}`,
              `Custo Médio: ${item.custoMedio.toLocaleString('pt-BR', { style: 'currency', currency: item.moeda })}`
            ]
          }
        }
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="sm:flex sm:items-center">
          <div className="sm:flex-auto">
            <h1 className="text-2xl font-semibold text-gray-800">Dashboard</h1>
            <p className="mt-2 text-sm text-gray-600">
              Visão geral da sua carteira de investimentos.
            </p>
          </div>
        </div>
        
        <div className="mt-8 space-y-8">
          {/* Charts Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {/* Asset Distribution Chart */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6">
                <h3 className="text-base font-semibold leading-6 text-gray-900">Distribuição por Ativo</h3>
                <div className="mt-4 aspect-square w-full">
                  {sumario.length > 0 ? (
                    <Pie data={chartData} options={chartOptions} />
                  ) : (
                    <p className="text-center py-4 text-sm text-gray-500">
                      Nenhuma movimentação encontrada
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Category Distribution Chart */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6">
                <h3 className="text-base font-semibold leading-6 text-gray-900">Distribuição por Categoria</h3>
                <div className="mt-4 aspect-square w-full">
                  {sumarioCategorias.length > 0 ? (
                    <Pie data={categoriaChartData} options={chartOptions} />
                  ) : (
                    <p className="text-center py-4 text-sm text-gray-500">
                      Nenhuma categoria encontrada
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Sumário de Movimentações */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6">
              <h3 className="text-base font-semibold leading-6 text-gray-900">Posição Atual por Ativo</h3>
              <div className="mt-6 flow-root">
                <div className="overflow-x-auto">
                  <div className="inline-block min-w-full align-middle">
                    <table className="min-w-full divide-y divide-gray-300">
                      <thead>
                        <tr>
                          <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0">Ticker</th>
                          <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Nome</th>
                          <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">Quantidade</th>
                          <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">Custo Médio</th>
                          <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">Valor Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {sumario.length > 0 ? (
                          sumario.map((item) => (
                            <tr key={item.ticker}>
                              <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-primary-600 sm:pl-0">{item.ticker}</td>
                              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{item.nome}</td>
                              <td className="whitespace-nowrap px-3 py-4 text-sm text-right text-gray-500">
                                {item.quantidade.toLocaleString('pt-BR', { minimumFractionDigits: 6 })}
                              </td>
                              <td className="whitespace-nowrap px-3 py-4 text-sm text-right text-gray-500">
                                {item.custoMedio.toLocaleString('pt-BR', { style: 'currency', currency: item.moeda })}
                              </td>
                              <td className="whitespace-nowrap px-3 py-4 text-sm text-right text-gray-500">
                                {item.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: item.moeda })}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} className="text-center py-4 text-sm text-gray-500">
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

          {/* Ativos Recentes */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6">
              <h3 className="text-base font-semibold leading-6 text-gray-900">Ativos Recentes</h3>
              <div className="mt-6 divide-y divide-gray-200">
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
    </div>
  )
} 