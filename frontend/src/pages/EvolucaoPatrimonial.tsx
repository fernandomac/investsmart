import React, { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import type { ChartData } from 'chart.js';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import type { EvolucaoPatrimonial, EvolucaoPatrimonialData, MonthlyGroup } from '../types/evolucaoPatrimonial';
import { formatCurrency } from '../utils/format';
import api from '../services/api';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const EvolucaoPatrimonialPage: React.FC = () => {
  const [evolucaoData, setEvolucaoData] = useState<EvolucaoPatrimonialData[]>([]);
  const [rawData, setRawData] = useState<EvolucaoPatrimonial[]>([]);
  const [monthlyGroups, setMonthlyGroups] = useState<MonthlyGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [editingSnapshot, setEditingSnapshot] = useState<EvolucaoPatrimonial | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    preco_atual: '',
    quantidade: '',
  });

  const groupDataByMonth = (data: EvolucaoPatrimonial[]): MonthlyGroup[] => {
    const grouped = data.reduce((acc, item) => {
      const monthKey = item.year_month_key;
      
      if (!acc[monthKey]) {
        acc[monthKey] = {
          year_month_key: monthKey,
          mes_ano_display: item.mes_ano_display,
          mes_ano_extenso: item.mes_ano_extenso,
          total_valor: 0,
          total_custo: 0,
          total_lucro_prejuizo: 0,
          total_dividendos: 0,
          count_ativos: 0,
          ativos: [],
          isExpanded: false,
        };
      }
      
      const valorTotal = Number(item.valor_total) || 0;
      const custoTotal = Number(item.custo_total) || 0;
      const lucroPrejuizo = Number(item.lucro_prejuizo) || 0;
      const dividendosMes = Number(item.dividendos_mes) || 0;
      
      acc[monthKey].total_valor += valorTotal;
      acc[monthKey].total_custo += custoTotal;
      acc[monthKey].total_lucro_prejuizo += lucroPrejuizo;
      acc[monthKey].total_dividendos += dividendosMes;
      acc[monthKey].count_ativos += 1;
      acc[monthKey].ativos.push(item);
      
      return acc;
    }, {} as Record<string, MonthlyGroup>);

    // Convert to array and sort by month descending
    return Object.values(grouped).sort((a, b) => b.year_month_key.localeCompare(a.year_month_key));
  };

  const processData = (data: EvolucaoPatrimonial[]) => {
    // Process data to group by date for the chart
    const groupedData = data.reduce((acc: Record<string, EvolucaoPatrimonialData>, item) => {
      const date = item.data.split('T')[0];
      if (!acc[date]) {
        acc[date] = {
          data: date,
          valor_total: 0,
          custo_total: 0,
          por_categoria: {},
          por_ativo: {},
        };
      }
      
      // Update total value - ensure numeric values
      const valorTotal = Number(item.valor_total) || 0;
      const custoTotal = Number(item.custo_total) || 0;
      
      acc[date].valor_total = (Number(acc[date].valor_total) || 0) + valorTotal;
      acc[date].custo_total = (Number(acc[date].custo_total) || 0) + custoTotal;
      
      // Group by category
      if (item.categoria_nome) {
        if (!acc[date].por_categoria[item.categoria_nome]) {
          acc[date].por_categoria[item.categoria_nome] = 0;
        }
        acc[date].por_categoria[item.categoria_nome] += valorTotal;
      }
      
      // Group by asset
      if (item.ativo_ticker) {
        if (!acc[date].por_ativo[item.ativo_ticker]) {
          acc[date].por_ativo[item.ativo_ticker] = 0;
        }
        acc[date].por_ativo[item.ativo_ticker] += valorTotal;
      }
      
      return acc;
    }, {} as Record<string, EvolucaoPatrimonialData>);

    // Convert to array and sort by date
    return Object.values(groupedData).sort((a, b) => a.data.localeCompare(b.data));
  };

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/evolucao-patrimonial/');
      setRawData(response.data);
      const processedData = processData(response.data);
      setEvolucaoData(processedData);
      
      // Group data by month for the table
      const groupedByMonth = groupDataByMonth(response.data);
      setMonthlyGroups(groupedByMonth);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Erro ao carregar dados de evolução patrimonial');
    } finally {
      setIsLoading(false);
    }
  };

  const createSnapshots = async () => {
    try {
      setIsUpdating(true);
      setFeedback(null);
      await api.post('/evolucao-patrimonial/create_snapshots/');
      await fetchData();
      setFeedback({ type: 'success', message: 'Snapshots mensais criados com sucesso!' });
    } catch (err) {
      console.error('Error creating snapshots:', err);
      setFeedback({ type: 'error', message: 'Erro ao criar snapshots' });
    } finally {
      setIsUpdating(false);
    }
  };

  const toggleMonthExpansion = (monthKey: string) => {
    setMonthlyGroups(groups => 
      groups.map(group => 
        group.year_month_key === monthKey 
          ? { ...group, isExpanded: !group.isExpanded }
          : group
      )
    );
  };

  const handleEdit = (snapshot: EvolucaoPatrimonial) => {
    setEditingSnapshot(snapshot);
    setEditForm({
      preco_atual: snapshot.preco_atual.toString(),
      quantidade: snapshot.quantidade.toString(),
    });
    setEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSnapshot) return;

    try {
      setIsUpdating(true);
      setFeedback(null);
      
      const updatedSnapshot = {
        ...editingSnapshot,
        preco_atual: Number(editForm.preco_atual),
        quantidade: Number(editForm.quantidade),
      };

      await api.put(`/evolucao-patrimonial/${editingSnapshot.id}/`, updatedSnapshot);
      await fetchData();
      setEditModalOpen(false);
      setFeedback({ type: 'success', message: 'Snapshot atualizado com sucesso!' });
    } catch (err) {
      console.error('Error updating snapshot:', err);
      setFeedback({ type: 'error', message: 'Erro ao atualizar snapshot' });
    } finally {
      setIsUpdating(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const chartData: ChartData<'line'> = {
    labels: evolucaoData.map(item => format(new Date(item.data), 'dd/MM/yyyy', { locale: ptBR })),
    datasets: [
      {
        label: 'Valor Patrimonial',
        data: evolucaoData.map(item => Number(item.valor_total) || 0),
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1,
      },
      {
        label: 'Valor Investido',
        data: evolucaoData.map(item => Number(item.custo_total) || 0),
        borderColor: 'rgb(255, 99, 132)',
        tension: 0.1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Evolução Patrimonial Mensal',
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const label = context.dataset.label;
            const value = formatCurrency(context.raw);
            return `${label}: ${value}`;
          },
        },
      },
    },
    scales: {
      y: {
        ticks: {
          callback: function(value: string | number) {
            return formatCurrency(Number(value));
          },
        },
      },
    },
  };

  return (
    <div className="bg-gray-50 min-h-screen -mt-8 -mx-4 px-4 py-8 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-800">Evolução Patrimonial</h1>
          <p className="mt-2 text-sm text-gray-600">
            Acompanhe a evolução do valor dos seus investimentos organizados por mês.
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
            onClick={createSnapshots}
            disabled={isUpdating}
            className="rounded-md bg-primary-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:opacity-50"
          >
            {isUpdating ? 'Criando...' : 'Criar Snapshot Mensal'}
          </button>
        </div>
      </div>

      {feedback && (
        <div className={`mt-4 p-4 rounded ${feedback.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {feedback.message}
        </div>
      )}

      {error && (
        <div className="mt-4 bg-red-50 text-red-700 p-4 rounded">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <>
          <div className="mt-8 bg-white rounded-lg shadow p-6">
            <Line data={chartData} options={chartOptions} />
          </div>

          <div className="mt-8 flow-root">
            <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
              <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
                <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg bg-white">
                  <table className="min-w-full divide-y divide-gray-300">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                          Mês/Ano
                        </th>
                        <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-gray-900">
                          Ativos
                        </th>
                        <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">
                          Valor Investido
                        </th>
                        <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">
                          Valor Patrimonial
                        </th>
                        <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">
                          Dividendos
                        </th>
                        <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">
                          Resultado
                        </th>
                        <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">
                          Performance %
                        </th>
                        <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                          <span className="sr-only">Ações</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {monthlyGroups.map((group) => {
                        const isPositive = group.total_lucro_prejuizo >= 0;
                        const variacao = group.total_custo !== 0 ? (group.total_lucro_prejuizo / group.total_custo) * 100 : 0;

                        return (
                          <React.Fragment key={group.year_month_key}>
                            {/* Monthly Summary Row */}
                            <tr className="bg-blue-50 hover:bg-blue-100 cursor-pointer" onClick={() => toggleMonthExpansion(group.year_month_key)}>
                              <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-semibold text-blue-900 sm:pl-6">
                                <div className="flex items-center">
                                  {group.isExpanded ? (
                                    <ChevronDownIcon className="h-4 w-4 mr-2" />
                                  ) : (
                                    <ChevronRightIcon className="h-4 w-4 mr-2" />
                                  )}
                                  {group.mes_ano_extenso}
                                </div>
                              </td>
                              <td className="whitespace-nowrap px-3 py-4 text-sm text-center font-medium text-blue-900">
                                {group.count_ativos}
                              </td>
                              <td className="whitespace-nowrap px-3 py-4 text-sm text-right font-medium text-blue-900">
                                {formatCurrency(group.total_custo)}
                              </td>
                              <td className="whitespace-nowrap px-3 py-4 text-sm text-right font-medium text-blue-900">
                                {formatCurrency(group.total_valor)}
                              </td>
                              <td className="whitespace-nowrap px-3 py-4 text-sm text-right font-medium text-blue-900">
                                {formatCurrency(group.total_dividendos)}
                              </td>
                              <td className={`whitespace-nowrap px-3 py-4 text-sm text-right font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                {formatCurrency(group.total_lucro_prejuizo)}
                              </td>
                              <td className={`whitespace-nowrap px-3 py-4 text-sm text-right font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                {variacao.toFixed(2)}%
                              </td>
                              <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                <span className="text-blue-600 text-xs">
                                  {group.isExpanded ? 'Fechar' : 'Expandir'}
                                </span>
                              </td>
                            </tr>

                            {/* Individual Asset Rows (when expanded) */}
                            {group.isExpanded && group.ativos.map((item, index) => {
                              const custoTotal = Number(item.custo_total) || 0;
                              const valorTotal = Number(item.valor_total) || 0;
                              const resultado = Number(item.lucro_prejuizo) || 0;
                              const isAssetPositive = resultado >= 0;
                              const assetVariacao = Number(item.percentual_lucro_prejuizo) || 0;

                              return (
                                <tr key={`${item.ativo_ticker}-${item.data}-${index}`} className="bg-gray-25">
                                  <td className="whitespace-nowrap py-3 pl-8 pr-3 text-sm text-gray-600 sm:pl-12">
                                    <div className="flex items-center">
                                      <span className="text-primary-600 font-medium">{item.ativo_ticker}</span>
                                      <span className="text-xs text-gray-400 ml-2">({item.ativo_nome})</span>
                                    </div>
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-3 text-sm text-center text-gray-500">
                                    {Number(item.quantidade).toFixed(6)}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-3 text-sm text-right text-gray-500">
                                    {formatCurrency(custoTotal)}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-3 text-sm text-right text-gray-500">
                                    {formatCurrency(valorTotal)}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-3 text-sm text-right text-gray-500">
                                    {formatCurrency(Number(item.dividendos_mes) || 0)}
                                  </td>
                                  <td className={`whitespace-nowrap px-3 py-3 text-sm text-right ${isAssetPositive ? 'text-green-600' : 'text-red-600'}`}>
                                    {formatCurrency(resultado)}
                                  </td>
                                  <td className={`whitespace-nowrap px-3 py-3 text-sm text-right ${isAssetPositive ? 'text-green-600' : 'text-red-600'}`}>
                                    {assetVariacao.toFixed(2)}%
                                  </td>
                                  <td className="relative whitespace-nowrap py-3 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEdit(item);
                                      }}
                                      className="text-primary-600 hover:text-primary-900 bg-transparent"
                                    >
                                      Editar
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Edit Modal */}
      {editModalOpen && editingSnapshot && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Editar Snapshot</h3>
            <form onSubmit={handleEditSubmit} className="space-y-4 bg-white rounded-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Ativo
                </label>
                <input
                  type="text"
                  value={editingSnapshot.ativo_ticker}
                  disabled
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Mês/Ano
                </label>
                <input
                  type="text"
                  value={editingSnapshot.mes_ano_extenso}
                  disabled
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Preço Atual
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editForm.preco_atual}
                  onChange={(e) => setEditForm({ ...editForm, preco_atual: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Quantidade
                </label>
                <input
                  type="number"
                  step="0.000001"
                  value={editForm.quantidade}
                  onChange={(e) => setEditForm({ ...editForm, quantidade: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:opacity-50"
                >
                  {isUpdating ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EvolucaoPatrimonialPage;