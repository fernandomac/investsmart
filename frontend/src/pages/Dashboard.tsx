import { useEffect, useState } from 'react'
import type { Ativo } from '../types/ativo'
import type { Movimentacao } from '../types/movimentacao'
import type { Dividendo } from '../types/dividendo'
import api from '../services/api'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  Colors,
  CategoryScale,
  LinearScale,
  BarElement,
  Title
} from 'chart.js'
import { Pie, Bar } from 'react-chartjs-2'
import { format, parse, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// Register ChartJS components
ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  Colors,
  CategoryScale,
  LinearScale,
  BarElement,
  Title
)

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
  const [dividendos, setDividendos] = useState<Dividendo[]>([])
  const [dividendosGroupBy, setDividendosGroupBy] = useState<'ativo' | 'categoria'>('ativo')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [ativosResponse, movimentacoesResponse, dividendosResponse] = await Promise.all([
          api.get('/ativos/'),
          api.get('/movimentacoes/'),
          api.get('/dividendos/')
        ])
        
        // Handle both paginated and non-paginated responses
        const ativos = Array.isArray(ativosResponse.data) ? ativosResponse.data :
                      Array.isArray(ativosResponse.data.results) ? ativosResponse.data.results : []
        
        const movimentacoes = Array.isArray(movimentacoesResponse.data) ? movimentacoesResponse.data :
                             Array.isArray(movimentacoesResponse.data.results) ? movimentacoesResponse.data.results : []
        
        const dividendos = Array.isArray(dividendosResponse.data) ? dividendosResponse.data :
                          Array.isArray(dividendosResponse.data.results) ? dividendosResponse.data.results : []
        
        setAtivos(ativos)
        setMovimentacoes(movimentacoes)
        setDividendos(dividendos)
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

  const calcularDividendosMensais = () => {
    // Create a map to store monthly dividends
    const dividendosPorMes: { [key: string]: { [key: string]: number } } = {}
    
    // Get last 12 months
    const hoje = new Date()
    const ultimos12Meses = Array.from({ length: 12 }, (_, i) => {
      const data = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
      return format(data, 'MMM yyyy', { locale: ptBR })
    }).reverse()
    
    // Initialize all months with 0
    ultimos12Meses.forEach(mes => {
      dividendosPorMes[mes] = {}
    })
    
    dividendos.forEach(dividendo => {
      const data = startOfMonth(parse(dividendo.data, 'yyyy-MM-dd', new Date()))
      const mesAno = format(data, 'MMM yyyy', { locale: ptBR })
      
      // Skip if not in last 12 months
      if (!ultimos12Meses.includes(mesAno)) return
      
      const ativo = ativos.find(a => a.id === dividendo.ativo)
      if (!ativo) return
      
      const chave = dividendosGroupBy === 'ativo' ? ativo.ticker : ativo.categoria_display || 'Sem categoria'
      
      if (!dividendosPorMes[mesAno][chave]) {
        dividendosPorMes[mesAno][chave] = 0
      }
      
      dividendosPorMes[mesAno][chave] += Number(dividendo.valor)
    })
    
    // Get unique labels (ativos or categorias)
    const labels = Array.from(new Set(
      dividendos
        .map(d => {
          const ativo = ativos.find(a => a.id === d.ativo)
          if (!ativo) return 'Desconhecido'
          return dividendosGroupBy === 'ativo' ? ativo.ticker : (ativo.categoria_display || 'Sem categoria')
        })
    )).filter(label => label !== 'Desconhecido')
    
    // Calculate total for percentages
    const totalPorMes = ultimos12Meses.map(mes => {
      const valores = Object.values(dividendosPorMes[mes] || {})
      return valores.reduce((acc, curr) => acc + curr, 0)
    })
    
    // Add percentage to month labels
    const mesesComPercentual = ultimos12Meses.map((mes, index) => {
      const total = totalPorMes[index]
      const percentual = (total / totalPorMes.reduce((acc, curr) => acc + curr, 0) * 100) || 0
      return `${mes} (${percentual.toFixed(1)}%)`
    })
    
    return {
      labels: mesesComPercentual,
      datasets: labels.map((label, index) => ({
        label,
        data: ultimos12Meses.map(mes => dividendosPorMes[mes][label] || 0),
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
        ][index % 12],
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
        ][index % 12],
        borderWidth: 1
      }))
    } as const
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

          {/* New monthly dividends chart */}
          <div className="bg-white shadow rounded-lg p-6 xl:col-span-2">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium text-gray-900">Dividendos Mensais</h2>
              <select
                value={dividendosGroupBy}
                onChange={(e) => setDividendosGroupBy(e.target.value as 'ativo' | 'categoria')}
                className="rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              >
                <option value="ativo">Agrupar por Ativo</option>
                <option value="categoria">Agrupar por Categoria</option>
              </select>
            </div>
            <div className="h-[400px]">
              <Bar
                data={calcularDividendosMensais()}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'right'
                    },
                    title: {
                      display: false
                    }
                  },
                  scales: {
                    x: {
                      stacked: true
                    },
                    y: {
                      stacked: true,
                      ticks: {
                        callback: (value) => {
                          return value.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL'
                          })
                        }
                      }
                    }
                  }
                }}
              />
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
                          <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">Peso Desejado</th>
                          <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">Peso Atual</th>
                          <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">Diferença</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {sumario.length > 0 ? (
                          sumario.map((item) => {
                            const totalPortfolio = sumario.reduce((acc, curr) => acc + Math.abs(curr.valorTotal), 0);
                            const currentPercentage = (Math.abs(item.valorTotal) / totalPortfolio) * 100;
                            const desiredPercentage = Number(ativos.find(a => a.ticker === item.ticker)?.peso || 0);
                            const difference = currentPercentage - desiredPercentage;
                            const getDifferenceColor = (diff: number) => {
                              const absValue = Math.abs(diff);
                              if (absValue <= 1) return 'text-green-600'; // Within 1% is good
                              if (absValue <= 3) return 'text-yellow-600'; // Within 3% is warning
                              return 'text-red-600'; // More than 3% is bad
                            };

                            return (
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
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-right text-gray-500">
                                  {desiredPercentage.toFixed(2)}%
                                </td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-right text-gray-500">
                                  {currentPercentage.toFixed(2)}%
                                </td>
                                <td className={`whitespace-nowrap px-3 py-4 text-sm text-right font-medium ${getDifferenceColor(difference)}`}>
                                  {difference > 0 ? '+' : ''}{difference.toFixed(2)}%
                                  {Math.abs(difference) > 1 && (
                                    <p className="text-xs mt-1">
                                      {difference > 0 
                                        ? `Reduzir ${difference.toFixed(2)}%`
                                        : `Aumentar ${Math.abs(difference).toFixed(2)}%`}
                                    </p>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={8} className="text-center py-4 text-sm text-gray-500">
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