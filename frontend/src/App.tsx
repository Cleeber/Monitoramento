import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { DomainsPage } from './pages/DomainsPage'
import { ClientsPage } from './pages/ClientsPage'
import { StatusPage } from './pages/StatusPage'
import { SmtpConfigPage } from './pages/SmtpConfigPage'
import { ReportsPage } from './pages/ReportsPage'
import { Toaster } from './components/ui/toaster'

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Router>
          <div className="min-h-screen bg-background">
            <Routes>
              {/* Rota pública de login */}
              <Route path="/login" element={<LoginPage />} />
              
              {/* Rota pública de status */}
              <Route path="/status/:groupId" element={<StatusPage />} />
              
              {/* Rotas protegidas */}
              <Route path="/" element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="dominios" element={<DomainsPage />} />
                <Route path="clientes" element={<ClientsPage />} />
                <Route path="config/smtp" element={<SmtpConfigPage />} />
                <Route path="relatorios" element={<ReportsPage />} />
              </Route>
              
              {/* Rota de fallback */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
            <Toaster />
          </div>
        </Router>
      </ToastProvider>
    </AuthProvider>
  )
}

export default App