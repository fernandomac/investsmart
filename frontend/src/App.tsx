import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Ativos from './pages/Ativos'
import Movimentacoes from './pages/Movimentacoes'
import Dividendos from './pages/Dividendos'
import EvolucaoPatrimonial from './pages/EvolucaoPatrimonial'
import Login from './pages/Login'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="ativos" element={<Ativos />} />
          <Route path="movimentacoes" element={<Movimentacoes />} />
          <Route path="dividendos" element={<Dividendos />} />
          <Route path="evolucao-patrimonial" element={<EvolucaoPatrimonial />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
