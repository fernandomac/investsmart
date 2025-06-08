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
import { format, subMonths, startOfMonth, endOfMonth, isAfter, isBefore, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronDownIcon, ChevronRightIcon, CalendarIcon } from '@heroicons/react/24/outline';
import type { EvolucaoPatrimonial, EvolucaoPatrimonialData, MonthlyGroup } from '../types/evolucaoPatrimonial';
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
  const [currencyFilter, setCurrencyFilter] = useState<string>('BRL');
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
  
  // Date range filtering
  const [dateRange, setDateRange] = useState<{
    startDate: string;
    endDate: string;
    preset: string;
  }>({
    startDate: '',
    endDate: '',
    preset: 'all'
  });

  const getFilteredData = (data: EvolucaoPatrimonial[]): EvolucaoPatrimonial[] => {
    let filtered = data.filter(item => item.moeda === currencyFilter);
    
    // Apply date range filter
    if (dateRange.startDate && dateRange.endDate) {
      const startDate = parseISO(dateRange.startDate);
      const endDate = parseISO(dateRange.endDate);
      
      filtered = filtered.filter(item => {
        const itemDate = parseISO(item.data);
        return !isBefore(itemDate, startDate) && !isAfter(itemDate, endDate);
      });
    }
    
    return filtered;
  };

  const getAvailableCurrencies = () => {
    const currencies = Array.from(new Set(rawData.map(item => item.moeda)));
    return currencies.sort();
  };

  const getCurrencyDisplayName = (currency: string) => {
    const currencyNames: { [key: string]: string } = {
      'BRL': 'Real (BRL)',
      'USD': 'Dólar (USD)',
      'EUR': 'Euro (EUR)',
      'GBP': 'Libra (GBP)'
    }
    return currencyNames[currency] || currency;
  };

  const setDateRangePreset = (preset: string) => {
    const now = new Date();
    let startDate = '';
    let endDate = format(now, 'yyyy-MM-dd');

    switch (preset) {
      case '3m':
        startDate = format(subMonths(now, 3), 'yyyy-MM-dd');
        break;
      case '6m':
        startDate = format(subMonths(now, 6), 'yyyy-MM-dd');
        break;
      case '1y':
        startDate = format(subMonths(now, 12), 'yyyy-MM-dd');
        break;
      case '2y':
        startDate = format(subMonths(now, 24), 'yyyy-MM-dd');
        break;
      case 'ytd':
        startDate = format(new Date(now.getFullYear(), 0, 1), 'yyyy-MM-dd');
        break;
      case 'all':
      default:
        startDate = '';
        endDate = '';
        break;
    }

    setDateRange({
      startDate,
      endDate,
      preset
    });
  };

  const groupDataByMonth = (data: EvolucaoPatrimonial[]): MonthlyGroup[] => {
    const filteredData = getFilteredData(data);
    const grouped = filteredData.reduce((acc, item) => {
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
    const filteredData = getFilteredData(data);
    // Process data to group by date for the chart
    const groupedData = filteredData.reduce((acc: Record<string, EvolucaoPatrimonialData>, item) => {
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

      // Set default currency to the first available currency if BRL is not available
      if (response.data.length > 0) {
        const availableCurrencies = Array.from(new Set(response.data.map((item: EvolucaoPatrimonial) => item.moeda)));
        if (!availableCurrencies.includes('BRL') && availableCurrencies.length > 0) {
          setCurrencyFilter(availableCurrencies[0] as string);
        }
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Erro ao carregar dados de evolução patrimonial');
    } finally {
      setIsLoading(false);
    }
  };

  // Update data when currency filter or date range changes
  useEffect(() => {
    if (rawData.length > 0) {
      const processedData = processData(rawData);
      setEvolucaoData(processedData);
      
      // Group data by month for the table
      const groupedByMonth = groupDataByMonth(rawData);
      setMonthlyGroups(groupedByMonth);
    }
  }, [currencyFilter, dateRange, rawData]);

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

  const getChartTitle = () => {
    let title = `Evolução Patrimonial Mensal (${currencyFilter})`;
    
    if (dateRange.startDate && dateRange.endDate) {
      const startFormatted = format(parseISO(dateRange.startDate), 'MMM/yyyy', { locale: ptBR });
      const endFormatted = format(parseISO(dateRange.endDate), 'MMM/yyyy', { locale: ptBR });
      title += ` - ${startFormatted} a ${endFormatted}`;
    } else if (dateRange.preset !== 'all') {
      const presetLabels: { [key: string]: string } = {
        '3m': 'Últimos 3 Meses',
        '6m': 'Últimos 6 Meses',
        '1y': 'Último Ano',
        '2y': 'Últimos 2 Anos',
        'ytd': 'Ano Atual'
      };
      if (presetLabels[dateRange.preset]) {
        title += ` - ${presetLabels[dateRange.preset]}`;
      }
    }
    
    return title;
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: getChartTitle(),
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const label = context.dataset.label;
            const value = context.raw.toLocaleString('pt-BR', {
              style: 'currency',
              currency: currencyFilter
            });
            return `${label}: ${value}`;
          },
        },
      },
    },
    scales: {
      y: {
        ticks: {
          callback: function(value: string | number) {
            return Number(value).toLocaleString('pt-BR', {
              style: 'currency',
              currency: currencyFilter
            });
          },
        },
      },
    },
  };

  return (
    <div className="bg-gray-50 min-h-screen -mt-8 -mx-4 px-4 py-8 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-800">Evolução Patrimonial</h1>
          <p className="mt-2 text-sm text-gray-600">
            Acompanhe a evolução do valor dos seus investimentos organizados por mês.
          </p>
        </div>
        
        <div className="mt-4 sm:mt-0 sm:flex-none flex gap-2">
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

      {/* Filters */}
      <div className="mt-6 space-y-4">
        {/* Date Range Filter */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center mb-4">
            <CalendarIcon className="h-5 w-5 text-gray-400 mr-2" />
            <h3 className="text-sm font-medium text-gray-700">Período</h3>
          </div>
          
          {/* Preset Buttons */}
          <div className="flex flex-wrap gap-2 mb-4">
            {[
              { key: 'all', label: 'Todos' },
              { key: '3m', label: '3 Meses' },
              { key: '6m', label: '6 Meses' },
              { key: 'ytd', label: 'Ano Atual' },
              { key: '1y', label: '1 Ano' },
              { key: '2y', label: '2 Anos' }
            ].map(preset => (
              <button
                key={preset.key}
                onClick={() => setDateRangePreset(preset.key)}
                className={`px-3 py-1 text-xs font-medium rounded-md ${
                  dateRange.preset === preset.key
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Currency Filter */}
        <div className="flex justify-end">
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
            {evolucaoData.length > 0 ? (
              <Line data={chartData} options={chartOptions} />
            ) : (
              <div className="text-center py-8 text-gray-500">
                Nenhum dado encontrado para {getCurrencyDisplayName(currencyFilter)}
              </div>
            )}
          </div>

          <div className="mt-8 flow-root">
            <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
              <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
                <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg bg-white">
                  {monthlyGroups.length > 0 ? (
                    <table className="min-w-full divide-y divide-gray-300">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                            Mês/Ano ({currencyFilter})
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
                                  {group.total_custo.toLocaleString('pt-BR', { style: 'currency', currency: currencyFilter })}
                                </td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-right font-medium text-blue-900">
                                  {group.total_valor.toLocaleString('pt-BR', { style: 'currency', currency: currencyFilter })}
                                </td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-right font-medium text-blue-900">
                                  {group.total_dividendos.toLocaleString('pt-BR', { style: 'currency', currency: currencyFilter })}
                                </td>
                                <td className={`whitespace-nowrap px-3 py-4 text-sm text-right font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                  {group.total_lucro_prejuizo.toLocaleString('pt-BR', { style: 'currency', currency: currencyFilter })}
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
                                  <tr key={`${group.year_month_key}-${item.id}-${item.ativo_ticker}-${index}`} className="bg-gray-25">
                                    <td className="whitespace-nowrap py-3 pl-8 pr-3 text-sm text-gray-600 sm:pl-12">
                                      <div className="flex items-center">
                                        <span className="text-primary-600 font-medium">{item.ativo_ticker}</span>
                                        <span className="text-xs text-gray-400 ml-2">({item.ativo_nome})</span>
                                        <span className="text-xs text-gray-400 ml-2">{item.moeda}</span>
                                      </div>
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-3 text-sm text-center text-gray-500">
                                      {Number(item.quantidade).toFixed(6)}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-3 text-sm text-right text-gray-500">
                                      {custoTotal.toLocaleString('pt-BR', { style: 'currency', currency: currencyFilter })}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-3 text-sm text-right text-gray-500">
                                      {valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: currencyFilter })}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-3 text-sm text-right text-gray-500">
                                      {(Number(item.dividendos_mes) || 0).toLocaleString('pt-BR', { style: 'currency', currency: currencyFilter })}
                                    </td>
                                    <td className={`whitespace-nowrap px-3 py-3 text-sm text-right ${isAssetPositive ? 'text-green-600' : 'text-red-600'}`}>
                                      {resultado.toLocaleString('pt-BR', { style: 'currency', currency: currencyFilter })}
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
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      Nenhum dado encontrado para {getCurrencyDisplayName(currencyFilter)}
                    </div>
                  )}
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