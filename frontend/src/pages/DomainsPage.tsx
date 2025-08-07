import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'

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
  CheckCircle, 
  AlertTriangle, 
  Clock,
  Activity
} from 'lucide-react'
import { useToast } from '../contexts/ToastContext'
import { cn } from '../lib/utils'

interface Monitor {
  id: string
  name: string
  url: string
  type: 'http' | 'ping' | 'tcp'
  interval: number
  timeout: number
  status: 'online' | 'offline' | 'warning' | 'unknown'
  enabled: boolean
  group_id: string | null
  group_name: string | null
  last_check: string | null
  response_time: number | null
  created_at: string
  uptime_24h: number
  uptime_7d: number
  uptime_30d: number
}

interface Group {
  id: string
  name: string
  description: string
}

interface MonitorFormData {
  name: string
  url: string
  type: 'http' | 'ping' | 'tcp'
  interval: number
  timeout: number
  group_id: string | null
  enabled: boolean
}

export function DomainsPage() {
  const [monitors, setMonitors] = useState<Monitor[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedGroup, setSelectedGroup] = useState<string>('all')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingMonitor, setEditingMonitor] = useState<Monitor | null>(null)
  const [formData, setFormData] = useState<MonitorFormData>({
    name: '',
    url: '',
    type: 'http',
    interval: 60,
    timeout: 30,
    group_id: null,
    enabled: true
  })
  const { addToast } = useToast()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('auth_token')
      const [monitorsResponse, groupsResponse] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_URL}/monitors`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${import.meta.env.VITE_API_URL}/groups`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ])

      if (monitorsResponse.ok && groupsResponse.ok) {
        const [monitorsData, groupsData] = await Promise.all([
          monitorsResponse.json(),
          groupsResponse.json()
        ])
        setMonitors(monitorsData)
        setGroups(groupsData)
      }
    } catch (error) {
      console.error('Erro ao buscar dados:', error)
      addToast('Erro ao carregar dados', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const token = localStorage.getItem('auth_token')
      const url = editingMonitor 
        ? `${import.meta.env.VITE_API_URL}/monitors/${editingMonitor.id}`
        : `${import.meta.env.VITE_API_URL}/monitors`
      
      const method = editingMonitor ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        addToast(
          editingMonitor ? 'Monitor atualizado com sucesso' : 'Monitor criado com sucesso',
          'success'
        )
        setIsDialogOpen(false)
        setEditingMonitor(null)
        resetForm()
        fetchData()
      } else {
        throw new Error('Erro ao salvar monitor')
      }
    } catch (error) {
      console.error('Erro ao salvar monitor:', error)
      addToast('Erro ao salvar monitor', 'error')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este monitor?')) return

    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch(`${import.meta.env.VITE_API_URL}/monitors/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })

      if (response.ok) {
        addToast('Monitor excluído com sucesso', 'success')
        fetchData()
      } else {
        throw new Error('Erro ao excluir monitor')
      }
    } catch (error) {
      console.error('Erro ao excluir monitor:', error)
      addToast('Erro ao excluir monitor', 'error')
    }
  }

  const handleEdit = (monitor: Monitor) => {
    setEditingMonitor(monitor)
    setFormData({
      name: monitor.name,
      url: monitor.url,
      type: monitor.type,
      interval: Math.floor(monitor.interval / 1000), // Converter de milissegundos para segundos
      timeout: Math.floor(monitor.timeout / 1000),   // Converter de milissegundos para segundos
      group_id: monitor.group_id,
      enabled: monitor.enabled
    })
    setIsDialogOpen(true)
  }

  const resetForm = () => {
    setFormData({
      name: '',
      url: '',
      type: 'http',
      interval: 60,
      timeout: 30,
      group_id: null,
      enabled: true
    })
  }

  const openCreateDialog = () => {
    setEditingMonitor(null)
    resetForm()
    setIsDialogOpen(true)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'offline':
        return <AlertTriangle className="h-4 w-4 text-red-600" />
      case 'warning':
        return <Clock className="h-4 w-4 text-yellow-600" />
      default:
        return <Activity className="h-4 w-4 text-gray-600" />
    }
  }



  const filteredMonitors = monitors.filter(monitor => {
    const matchesSearch = monitor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         monitor.url.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesGroup = selectedGroup === 'all' || 
                        (selectedGroup === 'none' && !monitor.group_id) ||
                        monitor.group_id === selectedGroup
    return matchesSearch && matchesGroup
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
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Monitor
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]" style={{backgroundColor: '#181b20', borderColor: '#2c313a'}}>
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
            <form onSubmit={handleSubmit} className="space-y-4">
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
                <Select value={formData.type} onValueChange={(value: 'http' | 'ping' | 'tcp') => setFormData({ ...formData, type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="http">HTTP/HTTPS</SelectItem>
                    <SelectItem value="ping">Ping (ICMP)</SelectItem>
                    <SelectItem value="tcp">TCP Socket</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="interval" className="text-white">Intervalo (seg)</Label>
                  <Input
                    id="interval"
                    type="number"
                    min="30"
                    value={formData.interval}
                    onChange={(e) => setFormData({ ...formData, interval: parseInt(e.target.value) })}
                  />
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
              
              <div className="space-y-2">
                <Label htmlFor="group" className="text-white">Grupo (opcional)</Label>
                <Select value={formData.group_id || 'none'} onValueChange={(value) => setFormData({ ...formData, group_id: value === 'none' ? null : value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um grupo (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum grupo</SelectItem>
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="enabled"
                  checked={formData.enabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
                />
                <Label htmlFor="enabled" className="text-white">Monitor ativo</Label>
              </div>
              
              <div className="flex justify-end space-x-2">
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
        <Select value={selectedGroup} onValueChange={setSelectedGroup}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os grupos</SelectItem>
            <SelectItem value="none">Sem grupo</SelectItem>
            {groups.map((group) => (
              <SelectItem key={group.id} value={group.id}>
                {group.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
                {searchTerm || selectedGroup !== 'all' ? 'Nenhum monitor encontrado' : 'Nenhum monitor configurado'}
              </h3>
              <p className="text-gray-400 mb-4">
                {searchTerm || selectedGroup !== 'all' 
                  ? 'Tente ajustar os filtros de busca'
                  : 'Comece adicionando seus primeiros domínios para monitorar'
                }
              </p>
              {!searchTerm && selectedGroup === 'all' && (
                <Button onClick={openCreateDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Monitor
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredMonitors.map((monitor) => (
                <div
                  key={monitor.id}
                  className="flex items-center justify-between p-4 border rounded-lg transition-colors"
                  style={{borderColor: '#2c313a', backgroundColor: '#2c313a'}}
                >
                  <div className="flex items-center space-x-4">
                    {getStatusIcon(monitor.status)}
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-medium text-white">{monitor.name}</h4>
                        {!monitor.enabled && (
                          <Badge variant="outline" className="text-xs">
                            Pausado
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-300">{monitor.url}</p>
                      <div className="flex items-center space-x-4 text-xs text-gray-400">
                        <span>{monitor.group_name || 'Sem grupo'}</span>
                        <span>•</span>
                        <span>{monitor.type.toUpperCase()}</span>
                        <span>•</span>
                        <span>Intervalo: {Math.floor(monitor.interval / 1000)}s</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    {monitor.response_time && (
                      <div className="text-right">
                        <p className="text-sm font-medium text-white">
                          {monitor.response_time}ms
                        </p>
                        <p className="text-xs text-gray-400">resposta</p>
                      </div>
                    )}
                    

                    
                    <div className="flex items-center space-x-2">
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
                        onClick={() => handleDelete(monitor.id)}
                        className="bg-gray-700 border-gray-600 text-red-400 hover:bg-red-600 hover:text-white hover:border-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}