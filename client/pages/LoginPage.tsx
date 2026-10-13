import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Eye, EyeOff, Activity, Globe, BarChart3 } from 'lucide-react'

export function LoginPage() {
  const { login, isAuthenticated, loading } = useAuth()
  const { error } = useToast()
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Redirecionar se já estiver autenticado
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const result = await login(formData.email, formData.password)
      
      if (!result.success) {
        error('Erro no login', result.error)
      }
    } catch (err) {
      error('Erro no login', 'Ocorreu um erro inesperado')
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="admin-theme min-h-screen bg-background p-4 text-foreground sm:p-8 lg:grid lg:grid-cols-2 lg:items-center lg:gap-16 lg:px-16 xl:px-24">
      <div className="mx-auto hidden w-full max-w-xl space-y-10 lg:block">
        <img src="/Pag1_Principal.svg" alt="Página 1" className="w-44" />
        <div className="space-y-4">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-blue-400">Monitoramento de serviços</p>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">Cada serviço.<br />Tudo sob controle.</h1>
          <p className="max-w-md text-base leading-relaxed text-muted-foreground">Acompanhe a disponibilidade dos seus sites, identifique incidentes e visualize o desempenho em um só lugar.</p>
        </div>
        <div className="grid grid-cols-3 gap-4 border-t border-border pt-6">
          {[{ icon: Activity, text: 'Disponibilidade' }, { icon: Globe, text: 'Domínios' }, { icon: BarChart3, text: 'Relatórios' }].map(item => <div key={item.text} className="space-y-3"><item.icon className="h-5 w-5 text-blue-400" /><p className="text-sm text-muted-foreground">{item.text}</p></div>)}
        </div>
      </div>
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-md flex-col justify-center lg:min-h-0">
        <img src="/Pag1_Principal.svg" alt="Página 1" className="mx-auto mb-8 w-32 lg:hidden" />
        {/* Login Card */}
        <Card className="border" style={{backgroundColor: '#181b20', borderColor: '#2c313a'}}>
          <CardHeader className="space-y-1 pb-6">
            <CardTitle className="text-2xl font-semibold text-center text-white">Fazer login</CardTitle>
            <CardDescription className="text-center text-gray-400">
              Entre com suas credenciais para acessar o sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-300">E-mail</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="seu@email.com"
                  disabled={isLoading}
                  style={{backgroundColor: '#2c313a', borderColor: '#2c313a', color: '#ffffff'}}
                  className="focus:border-blue-800 focus:ring-blue-800"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-gray-300">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    disabled={isLoading}
                    className="pr-10 focus:border-blue-800 focus:ring-blue-800"
                    style={{backgroundColor: '#2c313a', borderColor: '#2c313a', color: '#ffffff'}}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    disabled={isLoading}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </Button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                style={{backgroundColor: '#1e3a8a', color: '#ffffff'}}
                disabled={isLoading || !formData.email || !formData.password}
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Entrando...
                  </>
                ) : (
                  'Entrar'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
