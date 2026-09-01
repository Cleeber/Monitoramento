import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog'
import { Label } from '../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Switch } from '../components/ui/switch'
import { Badge } from '../components/ui/badge'
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Globe,
  Clock,
  CheckCircle,
  Upload,
  X,
  Activity,
  AlertTriangle,
  Eraser,
  Info
} from 'lucide-react'
import { useToast } from '../contexts/ToastContext'
import { apiGet, apiPost, apiPut, apiDelete, apiUpload } from '../utils/apiUtils'

interface Monitor {
  id: string
  name: string
  url: string
  type: 'http' | 'ping' | 'tcp'
  interval: number
  timeout: number
  status: 'online' | 'offline' | 'warning' | 'unknown'
  enabled: boolean
  last_check: string | null
  response_time: number | null
  created_at: string
  uptime_24h: number
  uptime_7d: number
  uptime_30d: number
  slug: string
  logo_url?: string | null
}

interface MonitorFormData {
  name: string
  url: string
  type: 'http' | 'ping' | 'tcp'
  interval: number
  timeout: number
  enabled: boolean
  slug: string
  logo_url?: string | null
  report_email: string
  report_send_day: number
  report_send_time: string

  // ── Validação avançada ──────────────────────────────────────────────
  // Validador: páginas de erro conhecidas (sempre ativo)
  // Validador: keywords esperadas (configurável)
  expected_keywords: string[]
  forbidden_keywords: string[]
  // Validador: API health endpoint (configurável)
  api_health_enabled: boolean
  api_health_path: string
  api_health_expected_status: number
  api_health_expected_body: string
  // Validador: SSL (configurável)
  check_ssl: boolean
  // Validador: estrutura HTML (CSS/JS obrigatórios)
  require_css: boolean
  require_js: boolean
  // Validador: conteúdo mínimo
  min_content_length: number
  min_text_length: number
  // Validador: tempo de resposta
  response_time_warning_ms: number
  response_time_critical_ms: number
  // Códigos HTTP esperados (lista customizada)
  expected_status_codes: number[]
}

export function DomainsPage() {
  const [monitors, setMonitors] = useState<Monitor[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingMonitor, setEditingMonitor] = useState<Monitor | null>(null)
  const [formData, setFormData] = useState<MonitorFormData>({
    name: '',
    url: '',
    type: 'http',
    interval: 300,
    timeout: 30,
    enabled: true,
    slug: '',
    logo_url: null,
    report_email: '',
    report_send_day: 1,
    report_send_time: '09:00',
    // Validação avançada - defaults
    expected_keywords: [],
    forbidden_keywords: [],
    api_health_enabled: false,
    api_health_path: '',
    api_health_expected_status: 200,
    api_health_expected_body: '',
    check_ssl: false,
    require_css: false,
    require_js: false,
    min_content_length: 1000,
    min_text_length: 100,
    response_time_warning_ms: 5000,
    response_time_critical_ms: 30000,
    expected_status_codes: [],
  })
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [isClearHistoryDialogOpen, setIsClearHistoryDialogOpen] = useState(false)
  const [monitorToClearHistory, setMonitorToClearHistory] = useState<Monitor | null>(null)
  const [isClearAllDialogOpen, setIsClearAllDialogOpen] = useState(false)
  const [clearingAll, setClearingAll] = useState(false)
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false)
  const [detailsMonitor, setDetailsMonitor] = useState<Monitor | null>(null)
  const [detailsChecks, setDetailsChecks] = useState<any[]>([])
  const [loadingDetails, setLoadingDetails] = useState(false)
  const { addToast } = useToast()

  // Carregar dados iniciais
  useEffect(() => {
    fetchData()
  }, [])

  // Polling: atualizar lista de monitores a cada 30s para refletir status em tempo real
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData()
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchData = async () => {
    try {
      const monitorsResult = await apiGet('/dashboard/monitors')

      if (monitorsResult.success) {
        setMonitors(monitorsResult.data)
      } else {
        addToast({ title: 'Erro ao carregar monitores', description: monitorsResult.error, variant: 'destructive' })
      }
    } catch (error) {
      console.error('Erro ao buscar dados:', error)
      addToast({ title: 'Erro ao carregar dados', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validação do campo obrigatório
    if (!formData.report_send_time) {
      addToast({ title: 'O horário do envio é obrigatório', variant: 'destructive' })
      return
    }
    
    try {
      let logoUrl = formData.logo_url
      
      // Fazer upload da logo se houver um novo arquivo
      if (logoFile) {
        logoUrl = await uploadLogo()
        if (!logoUrl) {
          return // Upload falhou, não continuar
        }
      }
      
      const url = editingMonitor 
        ? `/monitors/${editingMonitor.id}`
        : `/monitors`
      
      const monitorData = {
        ...formData,
        interval: formData.interval * 1000, // Converter segundos para milissegundos
        timeout: formData.timeout * 1000,   // Converter segundos para milissegundos
        logo_url: logoUrl
      }
      
      const result = editingMonitor 
        ? await apiPut(url, monitorData)
        : await apiPost(url, monitorData)

      if (result.success) {
        addToast({
          title: editingMonitor ? 'Monitor atualizado com sucesso' : 'Monitor criado com sucesso',
          variant: 'success'
        })
        setIsDialogOpen(false)
        setEditingMonitor(null)
        resetForm()
        fetchData()
      } else {
        addToast({ title: 'Erro ao salvar monitor', description: result.error, variant: 'destructive' })
      }
    } catch (error) {
      console.error('Erro ao salvar monitor:', error)
      addToast({ title: 'Erro ao salvar monitor', variant: 'destructive' })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este monitor?')) return

    try {
      const result = await apiDelete(`/monitors/${id}`)

      if (result.success) {
        addToast({ title: 'Monitor excluído com sucesso', variant: 'success' })
        fetchData()
      } else {
        addToast({ title: 'Erro ao excluir monitor', description: result.error, variant: 'destructive' })
      }
    } catch (error) {
      console.error('Erro ao excluir monitor:', error)
      addToast({ title: 'Erro ao excluir monitor', variant: 'destructive' })
    }
  }

  const handleClearHistory = (monitor: Monitor) => {
    setMonitorToClearHistory(monitor)
    setIsClearHistoryDialogOpen(true)
  }

  const confirmClearHistory = async () => {
    if (!monitorToClearHistory) return

    try {
      const result = await apiDelete(`/monitors/${monitorToClearHistory.id}/history`)

      if (result.success) {
        addToast({ title: 'Histórico limpo com sucesso', variant: 'success' })
        fetchData() // Refresh data to show reset stats
      } else {
        addToast({ title: 'Erro ao limpar histórico', description: result.error, variant: 'destructive' })
      }
    } catch (error) {
      console.error('Erro ao limpar histórico:', error)
      addToast({ title: 'Erro ao limpar histórico', variant: 'destructive' })
    } finally {
      setIsClearHistoryDialogOpen(false)
      setMonitorToClearHistory(null)
    }
  }

  // Abre o modal de detalhes do monitor com últimos checks
  const showMonitorDetails = async (monitor: Monitor) => {
    setDetailsMonitor(monitor)
    setDetailsChecks([])
    setIsDetailsDialogOpen(true)
    setLoadingDetails(true)

    try {
      // Buscar últimos 50 checks, priorizando os que falharam
      const result = await apiGet<any[]>(`/monitors/${monitor.id}/checks?limit=50&failed_only=true`)
      if (result.success) {
        setDetailsChecks(result.data || [])
      }
    } catch (error) {
      console.error('Erro ao buscar detalhes:', error)
    } finally {
      setLoadingDetails(false)
    }
  }

  // Limpa o histórico de TODOS os monitores
  const clearAllHistory = async () => {
    setClearingAll(true)
    try {
      const result = await apiPost('/admin/clear-all-history')

      if (result.success) {
        addToast({ title: 'Histórico de todos os monitores foi limpo', variant: 'success' })
        await fetchData()
      } else {
        addToast({ title: 'Erro ao limpar históricos', description: result.error, variant: 'destructive' })
      }
    } catch (error) {
      console.error('Erro ao limpar históricos:', error)
      addToast({ title: 'Erro ao limpar históricos', variant: 'destructive' })
    } finally {
      setClearingAll(false)
      setIsClearAllDialogOpen(false)
    }
  }

  const handleEdit = (monitor: Monitor) => {
    setEditingMonitor(monitor)
    setFormData({
      name: monitor.name,
      url: monitor.url,
      type: 'http', // Apenas HTTP é suportado
      interval: Math.floor(monitor.interval / 1000), // Converter de milissegundos para segundos
      timeout: Math.floor(monitor.timeout / 1000),   // Converter de milissegundos para segundos
      enabled: monitor.enabled,
      slug: monitor.slug || '',
      logo_url: monitor.logo_url,
      report_email: (monitor as any).report_email || '',
      report_send_day: (monitor as any).report_send_day || 1,
      report_send_time: (monitor as any).report_send_time || '09:00',
      // Validação avançada
      expected_keywords: (monitor as any).expected_keywords || [],
      forbidden_keywords: (monitor as any).forbidden_keywords || [],
      api_health_enabled: (monitor as any).api_health_enabled || false,
      api_health_path: (monitor as any).api_health_path || '',
      api_health_expected_status: (monitor as any).api_health_expected_status || 200,
      api_health_expected_body: (monitor as any).api_health_expected_body || '',
      check_ssl: (monitor as any).check_ssl || false,
      require_css: (monitor as any).require_css || false,
      require_js: (monitor as any).require_js || false,
      min_content_length: (monitor as any).min_content_length || 1000,
      min_text_length: (monitor as any).min_text_length || 100,
      response_time_warning_ms: (monitor as any).response_time_warning_ms || 5000,
      response_time_critical_ms: (monitor as any).response_time_critical_ms || 30000,
      expected_status_codes: (monitor as any).expected_status_codes || [],
    })

    // Se o monitor tem logo, definir como preview
    if (monitor.logo_url) {
      setLogoPreview(monitor.logo_url)
    } else {
      setLogoPreview(null)
    }
    setLogoFile(null)

    setIsDialogOpen(true)
  }

  const resetForm = () => {
    setFormData({
      name: '',
      url: '',
      type: 'http',
      interval: 300,
      timeout: 30,
      enabled: true,
      slug: '',
      logo_url: null,
      report_email: '',
      report_send_day: 1,
      report_send_time: '09:00',
      // Defaults de validação avançada
      expected_keywords: [],
      forbidden_keywords: [],
      api_health_enabled: false,
      api_health_path: '',
      api_health_expected_status: 200,
      api_health_expected_body: '',
      check_ssl: false,
      require_css: false,
      require_js: false,
      min_content_length: 1000,
      min_text_length: 100,
      response_time_warning_ms: 5000,
      response_time_critical_ms: 30000,
      expected_status_codes: [],
    })
    setLogoFile(null)
    setLogoPreview(null)
  }

  const validateLogoFile = (file: File): boolean => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml']
    const maxSize = 5 * 1024 * 1024 // 5MB

    if (!allowedTypes.includes(file.type)) {
      addToast({ title: 'Formato de arquivo não suportado. Use PNG, JPG ou SVG.', variant: 'destructive' })
      return false
    }

    if (file.size > maxSize) {
      addToast({ title: 'Arquivo muito grande. O tamanho máximo é 5MB.', variant: 'destructive' })
      return false
    }

    return true
  }

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!validateLogoFile(file)) {
      e.target.value = ''
      return
    }

    setLogoFile(file)
    
    // Criar preview
    const reader = new FileReader()
    reader.onload = (event) => {
      setLogoPreview(event.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile) return null

    setUploadingLogo(true)
    try {
      const formData = new FormData()
      formData.append('logo', logoFile)

      const result = await apiUpload(`/upload/logo`, formData)

      if (result.success) {
        return result.data.url
      } else {
        addToast({ title: 'Erro ao fazer upload da logo', description: result.error, variant: 'destructive' })
        return null
      }
    } catch (error) {
      console.error('Erro ao fazer upload da logo:', error)
      addToast({ title: 'Erro ao fazer upload da logo', variant: 'destructive' })
      return null
    } finally {
      setUploadingLogo(false)
    }
  }

  const removeLogo = () => {
    setLogoFile(null)
    setLogoPreview(null)
    setFormData({ ...formData, logo_url: null })
  }

  const openCreateDialog = () => {
    setEditingMonitor(null)
    resetForm()
    setIsDialogOpen(true)
  }

  const getStatusIcon = (status: string, monitorId?: string) => {
    const keyPrefix = monitorId ? `icon-${monitorId}` : `icon-${status}`;
    switch (status) {
      case 'online':
        return <CheckCircle key={keyPrefix} className="h-4 w-4 text-green-600" />
      case 'offline':
        return <AlertTriangle key={keyPrefix} className="h-4 w-4 text-red-600" />
      case 'warning':
        return <Clock key={keyPrefix} className="h-4 w-4 text-yellow-600" />
      default:
        return <Activity key={keyPrefix} className="h-4 w-4 text-gray-600" />
    }
  }



  const filteredMonitors = monitors.filter(monitor => {
    const matchesSearch = monitor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         monitor.url.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesSearch
  })

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Domínios</h1>
          <p className="text-gray-400">Gerencie os domínios monitorados</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setIsClearAllDialogOpen(true)}
            className="bg-gray-700 border-gray-600 text-yellow-400 hover:bg-yellow-600 hover:text-white hover:border-yellow-500"
          >
            <Eraser className="h-4 w-4 mr-2" />
            Limpar Histórico de Todos
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Monitor
              </Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto" style={{backgroundColor: '#181b20', borderColor: '#2c313a'}}>
            <DialogHeader>
              <DialogTitle className="text-white">
                {editingMonitor ? 'Editar Monitor' : 'Novo Monitor'}
              </DialogTitle>
              <DialogDescription className="text-gray-400">
                {editingMonitor 
                  ? 'Atualize as informações do monitor'
                  : 'Adicione um novo domínio para monitorar'
                }
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Grid de duas colunas */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Coluna 1 - Informações Básicas */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white border-b border-gray-600 pb-2">Informações Básicas</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-white">Nome</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Nome do monitor"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="url" className="text-white">URL/Endereço</Label>
                    <Input
                      id="url"
                      value={formData.url}
                      onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                      placeholder="https://exemplo.com ou 192.168.1.1"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="type" className="text-white">Tipo de Monitor</Label>
                    <Select value={formData.type} onValueChange={(value: 'http') => setFormData({ ...formData, type: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="http">HTTP/HTTPS</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-400">
                      O sistema valida automaticamente: páginas em branco, páginas de erro padrão (Apache/Nginx/Cloudflare/AWS), tempo de resposta e estrutura HTML.
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="interval" className="text-white">Intervalo (seg)</Label>
                      <Input
                        id="interval"
                        type="number"
                        min="60"
                        value={formData.interval}
                        onChange={(e) => setFormData({ ...formData, interval: parseInt(e.target.value) })}
                      />
                      <p className="text-xs text-gray-400">Recomendado: 300 (5min) para evitar rate limits de WAF.</p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="timeout" className="text-white">Timeout (seg)</Label>
                      <Input
                        id="timeout"
                        type="number"
                        min="5"
                        value={formData.timeout}
                        onChange={(e) => setFormData({ ...formData, timeout: parseInt(e.target.value) })}
                      />
                    </div>
                  </div>

                  {/* ── Detecção Automática (sempre ativa) ───────────────────────────── */}
                  <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="text-green-400 mt-0.5 text-lg">✓</div>
                      <div>
                        <p className="text-sm text-white font-medium">
                          Detecção automática ativa
                        </p>
                        <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                          O sistema identifica automaticamente se o site está no ar, com erro ou fora do ar.
                          Detecta páginas em branco, erros 404/500, páginas padrão de servidores
                          (Apache, Nginx, Cloudflare, AWS), e bloqueios de WAF — mesmo que retornem
                          HTTP 200.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="slug" className="text-white">Slug para Página de Status</Label>
                    <Input
                      id="slug"
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                      placeholder="Ex: meu-dominio-1 (deixe vazio para gerar automaticamente)"
                    />
                    <p className="text-xs text-gray-400">
                      Será usado na URL da página de status: /status/seu-slug
                    </p>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="enabled"
                      checked={formData.enabled}
                      onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
                    />
                    <Label htmlFor="enabled" className="text-white">Monitor ativo</Label>
                  </div>
                </div>
                
                {/* Coluna 2 - Configurações Opcionais */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white border-b border-gray-600 pb-2">Configurações Opcionais</h3>

                  {/* Seção de Configuração de Relatório Mensal */}
                  <div className="space-y-4 p-4 border border-gray-600 rounded-lg bg-gray-800/50">
                    <h4 className="text-sm font-medium text-white mb-2">Relatório Mensal por E-mail</h4>
                    <p className="text-xs text-gray-400 mb-3">
                      Receba um resumo mensal automático com uptime, tempo de resposta e histórico de incidentes.
                    </p>
                    
                    <div className="space-y-2">
                      <Label htmlFor="report_email" className="text-white">E-mail para Relatórios *</Label>
                      <Input
                        id="report_email"
                        type="email"
                        value={formData.report_email}
                        onChange={(e) => setFormData({ ...formData, report_email: e.target.value })}
                        placeholder="exemplo@empresa.com"
                        required
                      />
                      <p className="text-xs text-gray-400">
                        E-mail que receberá os relatórios mensais de uptime
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="report_send_day" className="text-white">Dia do Envio</Label>
                      <Select 
                        value={formData.report_send_day.toString()} 
                        onValueChange={(value) => setFormData({ ...formData, report_send_day: parseInt(value) })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o dia do mês" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                            <SelectItem key={day} value={day.toString()}>
                              Dia {day}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-400">
                        Dia do mês em que o relatório será enviado (1-28)
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="report_send_time" className="text-white">Horário do Envio *</Label>
                      <Input
                        id="report_send_time"
                        type="time"
                        value={formData.report_send_time}
                        onChange={(e) => setFormData({ ...formData, report_send_time: e.target.value })}
                        className="bg-gray-800 border-gray-700 text-white"
                        required
                      />
                      <p className="text-xs text-gray-400">
                        Horário em que o relatório será enviado (formato 24h)
                      </p>
                    </div>
                  </div>
                  
                  {/* Campo de Upload de Logo */}
                  <div className="space-y-2">
                    <Label className="text-white">Logo da Empresa (opcional)</Label>
                    <div className="space-y-3">
                      {/* Preview da Logo */}
                      {logoPreview && (
                        <div className="relative inline-block">
                          <img 
                            src={logoPreview} 
                            alt="Preview da logo" 
                            className="w-20 h-20 object-contain border border-gray-600 rounded-lg bg-white p-2"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                            onClick={removeLogo}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                      
                      {/* Input de Upload */}
                      <div className="flex items-center gap-2">
                        <Input
                          type="file"
                          accept=".png,.jpg,.jpeg,.svg"
                          onChange={handleLogoChange}
                          className="hidden"
                          id="logo-upload"
                          disabled={uploadingLogo}
                        />
                        <Label 
                          htmlFor="logo-upload" 
                          className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors"
                        >
                          <Upload className="h-4 w-4" />
                          {uploadingLogo ? 'Enviando...' : 'Escolher Arquivo'}
                        </Label>
                      </div>
                      
                      <p className="text-xs text-gray-400">
                        Formatos aceitos: PNG, JPG, SVG • Tamanho máximo: 5MB
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Botões de ação - ocupam toda a largura */}
              <div className="flex justify-end space-x-2 pt-4 border-t border-gray-600">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingMonitor ? 'Atualizar' : 'Criar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        <Dialog open={isClearHistoryDialogOpen} onOpenChange={setIsClearHistoryDialogOpen}>
          <DialogContent style={{backgroundColor: '#181b20', borderColor: '#2c313a'}}>
            <DialogHeader>
              <DialogTitle className="text-white">Limpar Histórico</DialogTitle>
              <DialogDescription className="text-gray-400">
                Tem certeza que deseja limpar todo o histórico de monitoramento do domínio <strong>{monitorToClearHistory?.name}</strong>?
                <br/><br/>
                Esta ação não pode ser desfeita e todas as estatísticas serão resetadas.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setIsClearHistoryDialogOpen(false)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={confirmClearHistory}>
                Confirmar Limpeza
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog: Limpar Histórico de TODOS os monitores */}
        <Dialog open={isClearAllDialogOpen} onOpenChange={setIsClearAllDialogOpen}>
          <DialogContent style={{backgroundColor: '#181b20', borderColor: '#2c313a'}}>
            <DialogHeader>
              <DialogTitle className="text-white">Limpar Histórico de Todos os Monitores</DialogTitle>
              <DialogDescription className="text-gray-400">
                Esta ação irá remover TODAS as checagens e TODOS os relatórios mensais de TODOS os monitores.
                Os monitores em si serão mantidos. Esta ação não pode ser desfeita.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setIsClearAllDialogOpen(false)} disabled={clearingAll}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={clearAllHistory} disabled={clearingAll}>
                {clearingAll ? 'Limpando...' : 'Limpar Tudo'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog de Detalhes do Monitor */}
        <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
          <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto" style={{backgroundColor: '#181b20', borderColor: '#2c313a'}}>
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-3">
                {detailsMonitor && getStatusIcon(detailsMonitor.status, detailsMonitor.id)}
                {detailsMonitor?.name}
              </DialogTitle>
              <DialogDescription className="text-gray-400">
                Últimas verificações — status atual e histórico de falhas
              </DialogDescription>
            </DialogHeader>

            {detailsMonitor && (
              <div className="space-y-4">
                {/* Resumo atual */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-gray-800/50 border border-gray-700 rounded p-3">
                    <p className="text-xs text-gray-400">Status Atual</p>
                    <p className={`text-sm font-bold mt-1 ${
                      detailsMonitor.status === 'online' ? 'text-green-400' :
                      detailsMonitor.status === 'warning' ? 'text-yellow-400' :
                      detailsMonitor.status === 'offline' ? 'text-red-400' : 'text-gray-400'
                    }`}>
                      {detailsMonitor.status.toUpperCase()}
                    </p>
                  </div>
                  <div className="bg-gray-800/50 border border-gray-700 rounded p-3">
                    <p className="text-xs text-gray-400">Uptime 24h</p>
                    <p className="text-sm font-bold text-white mt-1">
                      {detailsMonitor.uptime_24h?.toFixed(1) || '0'}%
                    </p>
                  </div>
                  <div className="bg-gray-800/50 border border-gray-700 rounded p-3">
                    <p className="text-xs text-gray-400">Resposta</p>
                    <p className="text-sm font-bold text-white mt-1">
                      {detailsMonitor.response_time ? `${detailsMonitor.response_time}ms` : '-'}
                    </p>
                  </div>
                  <div className="bg-gray-800/50 border border-gray-700 rounded p-3">
                    <p className="text-xs text-gray-400">Última Verif.</p>
                    <p className="text-xs text-white mt-1">
                      {detailsMonitor.last_check
                        ? new Date(detailsMonitor.last_check).toLocaleString('pt-BR')
                        : 'Nunca'}
                    </p>
                  </div>
                </div>

                {/* URL monitorada */}
                <div className="bg-gray-800/50 border border-gray-700 rounded p-3">
                  <p className="text-xs text-gray-400 mb-1">URL Monitorada</p>
                  <code className="text-sm text-cyan-400">{detailsMonitor.url}</code>
                </div>

                {/* Histórico de falhas */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-white">
                      Histórico de Falhas
                    </h4>
                    <span className="text-xs text-gray-400">
                      {loadingDetails ? 'Carregando...' :
                        detailsChecks.length === 0 ? 'Nenhuma falha registrada' :
                        `${detailsChecks.length} falha(s) encontrada(s)`}
                    </span>
                  </div>

                  {loadingDetails ? (
                    <div className="flex items-center justify-center py-8">
                      <Activity className="h-6 w-6 text-gray-400 animate-spin" />
                    </div>
                  ) : detailsChecks.length === 0 ? (
                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-6 text-center">
                      <CheckCircle className="h-8 w-8 text-green-400 mx-auto mb-2" />
                      <p className="text-green-400 font-medium">
                        Sem falhas recentes! Site respondendo normalmente.
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Verificações com erro aparecerão aqui.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {detailsChecks.map((check: any) => (
                        <div
                          key={check.id}
                          className={`border rounded-lg p-3 ${
                            check.status === 'offline'
                              ? 'bg-red-500/5 border-red-500/30'
                              : 'bg-yellow-500/5 border-yellow-500/30'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge
                                  variant="outline"
                                  className={
                                    check.status === 'offline'
                                      ? 'text-red-400 border-red-500/50'
                                      : 'text-yellow-400 border-yellow-500/50'
                                  }
                                >
                                  {check.status.toUpperCase()}
                                </Badge>
                                {check.status_code && (
                                  <Badge variant="outline" className="text-gray-400">
                                    HTTP {check.status_code}
                                  </Badge>
                                )}
                                {check.response_time && (
                                  <span className="text-xs text-gray-400">
                                    {check.response_time}ms
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-white mb-1">
                                {check.error_message || 'Sem mensagem de erro'}
                              </p>
                              <p className="text-xs text-gray-500">
                                {new Date(check.checked_at).toLocaleString('pt-BR')}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Buscar por nome ou URL..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Monitors List */}
      <Card className="border" style={{backgroundColor: '#181b20', borderColor: '#2c313a'}}>
        <CardHeader>
          <CardTitle className="text-white">Monitores ({filteredMonitors.length})</CardTitle>
          <CardDescription className="text-gray-400">
            Lista de todos os domínios sendo monitorados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredMonitors.length === 0 ? (
            <div className="text-center py-8">
              <Globe className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">
                {searchTerm ? 'Nenhum monitor encontrado' : 'Nenhum monitor configurado'}
              </h3>
              <p className="text-gray-400 mb-4">
                {searchTerm 
                  ? 'Tente ajustar os filtros de busca'
                  : 'Comece adicionando seus primeiros domínios para monitorar'
                }
              </p>
              {!searchTerm && (
                <Button onClick={openCreateDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Monitor
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow style={{borderColor: '#2c313a'}}>
                  <TableHead className="text-gray-300">Status</TableHead>
                  <TableHead className="text-gray-300">Nome</TableHead>
                  <TableHead className="text-gray-300">URL</TableHead>
                  <TableHead className="text-gray-300">Resposta</TableHead>
                  <TableHead className="text-gray-300">Última Verificação</TableHead>
                  <TableHead className="text-gray-300">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMonitors.map((monitor) => (
                  <TableRow 
                    key={monitor.id} 
                    className="hover:bg-gray-800/50 transition-colors"
                    style={{borderColor: '#2c313a'}}
                  >
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(monitor.status, monitor.id)}
                        {!monitor.enabled && (
                          <Badge variant="outline" className="text-xs">
                            Pausado
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-white">{monitor.name}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-gray-300 text-sm">{monitor.url}</span>
                    </TableCell>
                    <TableCell>
                      {monitor.response_time ? (
                        <span className="text-white text-sm font-medium">
                          {monitor.response_time}ms
                        </span>
                      ) : (
                        <span className="text-gray-500 text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        {monitor.last_check ? (
                          <span className="text-gray-400 text-sm">
                            {new Date(monitor.last_check).toLocaleString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        ) : (
                          <span className="text-gray-500 text-sm">Nunca</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => showMonitorDetails(monitor)}
                          className="bg-gray-700 border-gray-600 text-cyan-400 hover:bg-cyan-600 hover:text-white hover:border-cyan-500"
                          title="Ver Detalhes"
                        >
                          <Info className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(monitor)}
                          className="bg-gray-700 border-gray-600 text-gray-300 hover:bg-blue-600 hover:text-white hover:border-blue-500"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleClearHistory(monitor)}
                          className="bg-gray-700 border-gray-600 text-yellow-400 hover:bg-yellow-600 hover:text-white hover:border-yellow-500"
                          title="Limpar Histórico"
                        >
                          <Eraser className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(monitor.id)}
                          className="bg-gray-700 border-gray-600 text-red-400 hover:bg-red-600 hover:text-white hover:border-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}