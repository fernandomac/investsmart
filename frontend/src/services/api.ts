import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Create a separate axios instance for refresh token requests
const refreshApi = axios.create({
  baseURL: 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to add the JWT token to all requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If the error is 401 and we haven't tried to refresh the token yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        const response = await refreshApi.post('/token/refresh/', { refresh: refreshToken });
        const { access } = response.data;

        localStorage.setItem('accessToken', access);
        api.defaults.headers.common['Authorization'] = `Bearer ${access}`;
        originalRequest.headers.Authorization = `Bearer ${access}`;

        return api(originalRequest);
      } catch (err) {
        // If refresh token fails, redirect to login
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(err);
      }
    }

    return Promise.reject(error);
  }
);

export type TipoCategoria = 'RENDA_FIXA' | 'RENDA_VARIAVEL' | 'FUNDOS' | 'EXTERIOR';

export type SubtipoCategoria = 
  | 'TESOURO_DIRETO' | 'CDB' | 'LCI_LCA' | 'DEBENTURES' | 'CRI_CRA' | 'POUPANCA'  // Renda Fixa
  | 'ACOES' | 'FII' | 'ETFS' | 'BDRS' | 'CRIPTO'  // Renda Variável
  | 'FUNDO_RF' | 'FUNDO_MULTI' | 'FUNDO_ACOES' | 'FUNDO_CAMBIAL' | 'FUNDO_IMOB' | 'PREVIDENCIA'  // Fundos
  | 'ETF_INTER' | 'ACOES_INTER' | 'FUNDOS_INTER' | 'REITS';  // Exterior

export type Categoria = {
  id: number;
  tipo: TipoCategoria;
  subtipo: SubtipoCategoria;
  descricao: string;
  dataCriacao: string;
  dataAlteracao: string;
}

export type Ativo = {
  id: number;
  ticker: string;
  nome: string;
  moeda: string;
  categoria: number;
  categoria_display: string;
  peso: number;
  quantidade: number;
  preco_medio: number;
  dataVencimento: string | null;
  anotacao: string;
  icone_url: string | null;
  icone_url_display: string;
  dataCriacao: string;
  dataAtualizacao: string;
  total_investido: number;
  valor_atual: number;
  rendimento: number;
  is_preco_estimado: boolean;
  preco_atual: number;
}

type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export const categoriaService = {
  getAll: () => api.get<Categoria[]>('/categorias/'),
  getById: (id: number) => api.get<Categoria>(`/categorias/${id}/`),
  create: (data: Partial<Categoria>) => api.post<Categoria>('/categorias/', data),
  update: (id: number, data: Partial<Categoria>) => api.put<Categoria>(`/categorias/${id}/`, data),
  delete: (id: number) => api.delete(`/categorias/${id}/`),
};

export const ativoService = {
  getAll: (page?: number, pageSize?: number, ticker?: string) => {
    const params = new URLSearchParams();
    if (page) params.append('page', page.toString());
    if (pageSize) params.append('page_size', pageSize.toString());
    if (ticker) params.append('ticker', ticker);
    
    const queryString = params.toString();
    const url = queryString ? `/ativos/?${queryString}` : '/ativos/';
    
    return api.get<PaginatedResponse<Ativo>>(url);
  },
  getById: (id: number) => api.get<Ativo>(`/ativos/${id}/`),
  create: (data: Partial<Ativo>) => api.post<Ativo>('/ativos/', data),
  update: (id: number, data: Partial<Ativo>) => api.put<Ativo>(`/ativos/${id}/`, data),
  delete: (id: number) => api.delete(`/ativos/${id}/`),
};

export type Movimentacao = {
  id: number;
  ativo: number;
  ativo_display: string;
  data: string;
  operacao: string;
  operacao_display: string;
  quantidade: number;
  valorUnitario: number;
  taxa: number;
  custoTotal: number;
  dataCriacao: string;
  dataAlteracao: string;
};

export const movimentacaoService = {
  getAll: (page?: number, pageSize?: number, year?: number, ticker?: string) => {
    const params = new URLSearchParams();
    if (page) params.append('page', page.toString());
    if (pageSize) params.append('page_size', pageSize.toString());
    if (year) params.append('year', year.toString());
    if (ticker) params.append('ticker', ticker);
    
    const queryString = params.toString();
    const url = queryString ? `/movimentacoes/?${queryString}` : '/movimentacoes/';
    
    return api.get<PaginatedResponse<Movimentacao>>(url);
  },
  getById: (id: number) => api.get<Movimentacao>(`/movimentacoes/${id}/`),
  create: (data: any) => api.post<Movimentacao>('/movimentacoes/', data),
  update: (id: number, data: any) => api.put<Movimentacao>(`/movimentacoes/${id}/`, data),
  delete: (id: number) => api.delete(`/movimentacoes/${id}/`),
};

export type Dividendo = {
  id: number;
  ativo: number;
  ativo_display: string;
  data: string;
  valor: number;
  dataCriacao: string;
  dataAlteracao: string;
};

export const dividendoService = {
  getAll: (page?: number, pageSize?: number, year?: number, ticker?: string) => {
    const params = new URLSearchParams();
    if (page) params.append('page', page.toString());
    if (pageSize) params.append('page_size', pageSize.toString());
    if (year) params.append('year', year.toString());
    if (ticker) params.append('ticker', ticker);
    
    const queryString = params.toString();
    const url = queryString ? `/dividendos/?${queryString}` : '/dividendos/';
    
    return api.get<PaginatedResponse<Dividendo>>(url);
  },
  getById: (id: number) => api.get<Dividendo>(`/dividendos/${id}/`),
  create: (data: any) => api.post<Dividendo>('/dividendos/', data),
  update: (id: number, data: any) => api.put<Dividendo>(`/dividendos/${id}/`, data),
  delete: (id: number) => api.delete(`/dividendos/${id}/`),
};

export default api; 