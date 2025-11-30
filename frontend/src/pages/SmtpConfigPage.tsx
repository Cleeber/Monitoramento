import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Switch } from '../components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { 
  Mail, 
  Save, 
  Eye, 
  EyeOff,
  AlertCircle,
  CheckCircle
} from 'lucide-react'
import { useToast } from '../contexts/ToastContext'
import { apiGet, apiPost, apiPut } from '../utils/apiUtils'

interface SmtpConfig {
  id?: string
  host: string
  port: number
  username: string
  password: string
  from_email: string
  from_name: string
  use_tls: boolean
  use_ssl: boolean
  enabled: boolean
}

export function SmtpConfigPage() {
  const [config, setConfig] = useState<SmtpConfig>({
    host: '',
    port: 587,
    username: '',
    password: '',
    from_email: '',
    from_name: '',
    use_tls: true,
    use_ssl: false,
    enabled: false
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const { addToast } = useToast()

  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    try {
      const result = await apiGet('/smtp/config')

      if (result.success && result.data) {
        // Mapear dados do backend para o frontend
        setConfig({
          host: result.data.host || '',
          port: result.data.port || 587,
          username: result.data.user || '',
          password: '', // Senha não é retornada por segurança
          from_email: result.data.from_email || '',
          from_name: result.data.from_name || '',
          use_tls: result.data.port === 587,
          use_ssl: result.data.secure || result.data.port === 465,
          enabled: result.data.is_configured || false
        })
      } else if (!result.success && result.status !== 404) {
        // Ignorar erro 404 (config não encontrada)
        addToast({ title: 'Erro ao carregar configuração SMTP', description: result.error, variant: 'destructive' })
      }
    } catch (error) {
      console.error('Erro ao buscar configuração SMTP:', error)
      addToast({ title: 'Erro ao carregar configuração SMTP', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    
    try {
      // Mapear para o formato esperado pelo backend
      const payload = {
        host: config.host,
        port: config.port,
        secure: config.use_ssl,
        user: config.username,
        pass: config.password,
        from_name: config.from_name,
        from_email: config.from_email,
        is_configured: config.enabled
      }

      // Usar POST em vez de PUT conforme definido no backend
      const result = await apiPost('/smtp/config', payload)

      if (result.success) {
        addToast({ title: 'Configuração SMTP salva com sucesso', variant: 'success' })
        fetchConfig()
      } else {
        addToast({ title: 'Erro ao salvar configuração SMTP', description: result.error, variant: 'destructive' })
      }
    } catch (error) {
      console.error('Erro ao salvar configuração SMTP:', error)
      addToast({ title: 'Erro ao salvar configuração SMTP', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    if (!testEmail) {
      addToast({ title: 'Digite um e-mail para teste', variant: 'destructive' })
      return
    }

    setTesting(true)
    
    try {
      const result = await apiPost('/smtp/test', { email: testEmail })

      if (result.success) {
        addToast({ title: 'E-mail de teste enviado com sucesso', variant: 'success' })
      } else {
        addToast({ title: 'Erro ao enviar e-mail de teste', description: result.error, variant: 'destructive' })
      }
    } catch (error) {
      console.error('Erro ao testar SMTP:', error)
      addToast({ title: `Erro ao enviar e-mail de teste: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, variant: 'destructive' })
    } finally {
      setTesting(false)
    }
  }

  const handlePortChange = (portType: 'smtp' | 'smtps' | 'submission') => {
    switch (portType) {
      case 'smtp':
        setConfig({ ...config, port: 25, use_tls: false, use_ssl: false })
        break
      case 'submission':
        setConfig({ ...config, port: 587, use_tls: true, use_ssl: false })
        break
      case 'smtps':
        setConfig({ ...config, port: 465, use_tls: false, use_ssl: true })
        break
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#ffffff' }}>Configuração SMTP</h1>
        <p style={{ color: '#9ca3af' }}>Configure o servidor de e-mail para notificações</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Configuration */}
        <div className="lg:col-span-2">
          <Card style={{ backgroundColor: '#181b20', borderColor: '#2c313a' }}>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2" style={{ color: '#ffffff' }}>
                <Mail className="h-5 w-5" style={{ color: '#ffffff' }} />
                <span>Configurações do Servidor</span>
              </CardTitle>
              <CardDescription style={{ color: '#9ca3af' }}>
                Configure as credenciais do seu provedor de e-mail
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-4">
                {/* Enable/Disable */}
                <div className="flex items-center space-x-2">
                  <Switch
                    id="enabled"
                    checked={config.enabled}
                    onCheckedChange={(checked) => setConfig({ ...config, enabled: checked })}
                  />
                  <Label htmlFor="enabled" style={{ color: '#ffffff' }}>Habilitar notificações por e-mail</Label>
                </div>

                {/* Server Settings */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="host" style={{ color: '#ffffff' }}>Servidor SMTP</Label>
                    <Input
                      id="host"
                      value={config.host}
                      onChange={(e) => setConfig({ ...config, host: e.target.value })}
                      placeholder="smtp.gmail.com"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="port" style={{ color: '#ffffff' }}>Porta</Label>
                    <div className="flex space-x-2">
                      <Input
                        id="port"
                        type="number"
                        value={config.port}
                        onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value) })}
                        required
                      />
                      <Select onValueChange={handlePortChange}>
                        <SelectTrigger className="w-32">
                          <SelectValue placeholder="Preset" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="smtp">25 (SMTP)</SelectItem>
                          <SelectItem value="submission">587 (TLS)</SelectItem>
                          <SelectItem value="smtps">465 (SSL)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Authentication */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="username" style={{ color: '#ffffff' }}>Usuário/E-mail</Label>
                    <Input
                      id="username"
                      value={config.username}
                      onChange={(e) => setConfig({ ...config, username: e.target.value })}
                      placeholder="seu@email.com"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="password" style={{ color: '#ffffff' }}>Senha</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={config.password}
                        onChange={(e) => setConfig({ ...config, password: e.target.value })}
                        placeholder="Senha ou App Password"
                        autoComplete="current-password"
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* From Settings */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="from_email" style={{ color: '#ffffff' }}>E-mail do Remetente</Label>
                    <Input
                      id="from_email"
                      value={config.from_email}
                      onChange={(e) => setConfig({ ...config, from_email: e.target.value })}
                      placeholder="noreply@seudominio.com"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="from_name" style={{ color: '#ffffff' }}>Nome do Remetente</Label>
                    <Input
                      id="from_name"
                      value={config.from_name}
                      onChange={(e) => setConfig({ ...config, from_name: e.target.value })}
                      placeholder="Monitor de Sites"
                      required
                    />
                  </div>
                </div>

                {/* Security Settings */}
                <div className="space-y-4">
                  <h4 className="font-medium" style={{ color: '#ffffff' }}>Configurações de Segurança</h4>
                  <div className="flex flex-col space-y-2">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="use_tls"
                        checked={config.use_tls}
                        onCheckedChange={(checked) => setConfig({ ...config, use_tls: checked })}
                      />
                      <Label htmlFor="use_tls" style={{ color: '#ffffff' }}>Usar TLS (recomendado para porta 587)</Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="use_ssl"
                        checked={config.use_ssl}
                        onCheckedChange={(checked) => setConfig({ ...config, use_ssl: checked })}
                      />
                      <Label htmlFor="use_ssl" style={{ color: '#ffffff' }}>Usar SSL (recomendado para porta 465)</Label>
                    </div>
                  </div>
                </div>

                <Button type="submit" disabled={saving} className="w-full">
                  {saving ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {saving ? 'Salvando...' : 'Salvar Configuração'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Test Panel */}
        <div>
          <Card style={{ backgroundColor: '#181b20', borderColor: '#2c313a' }}>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2" style={{ color: '#ffffff' }}>
                <Mail className="h-5 w-5" style={{ color: '#ffffff' }} />
                <span>Teste de E-mail</span>
              </CardTitle>
              <CardDescription style={{ color: '#9ca3af' }}>
                Envie um e-mail de teste para verificar a configuração
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="test_email" style={{ color: '#ffffff' }}>E-mail de Teste</Label>
                <Input
                  id="test_email"
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="teste@exemplo.com"
                />
              </div>
              
              <Button 
                onClick={handleTest} 
                disabled={testing || !config.enabled || !testEmail}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white border-blue-600 hover:border-blue-700"
                variant="default"
              >
                {testing ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                ) : (
                  <Mail className="h-4 w-4 mr-2" />
                )}
                {testing ? 'Enviando...' : 'Enviar Teste'}
              </Button>
              
              {!config.enabled && (
                <div className="flex items-start space-x-2 p-3 rounded-md" style={{ backgroundColor: '#2c313a', borderColor: '#1e3a8a', border: '1px solid' }}>
                  <AlertCircle className="h-4 w-4 mt-0.5" style={{ color: '#f59e0b' }} />
                  <div className="text-sm">
                    <p className="font-medium" style={{ color: '#f59e0b' }}>SMTP Desabilitado</p>
                    <p style={{ color: '#9ca3af' }}>Habilite o SMTP para enviar e-mails de teste.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Status Card */}
          <Card className="mt-6" style={{ backgroundColor: '#181b20', borderColor: '#2c313a' }}>
            <CardHeader>
              <CardTitle className="text-sm" style={{ color: '#ffffff' }}>Status da Configuração</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span style={{ color: '#9ca3af' }}>SMTP Habilitado</span>
                  {config.enabled ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  )}
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span style={{ color: '#9ca3af' }}>Servidor Configurado</span>
                  {config.host ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  )}
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span style={{ color: '#9ca3af' }}>Credenciais</span>
                  {config.username && config.password ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}