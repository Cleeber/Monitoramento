import { useState, useEffect } from 'react'
import { Card, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog'
import { Label } from '../components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Globe,
  Building,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import { useToast } from '../contexts/ToastContext'

interface Group {
  id: string
  name: string
  description: string
  slug: string
  monitor_count: number
  created_at: string
}

interface Monitor {
  id: string
  name: string
  url: string
  status: 'online' | 'offline' | 'warning' | 'unknown'
  type: string
  group_id: string
  response_time?: number
}

interface GroupFormData {
  name: string
  description: string
  slug: string
}

export function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [monitors, setMonitors] = useState<Monitor[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<Group | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [formData, setFormData] = useState<GroupFormData>({
    name: '',
    description: '',
    slug: ''
  })
  const { addToast } = useToast()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    await Promise.all([fetchGroups(), fetchMonitors()])
  }

  const fetchGroups = async () => {
    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch(`${import.meta.env.VITE_API_URL}/groups`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (response.ok) {
        const data = await response.json()
        setGroups(data)
      }
    } catch (error) {
      console.error('Erro ao buscar grupos:', error)
      addToast({ title: 'Erro ao carregar grupos', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const fetchMonitors = async () => {
    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch(`${import.meta.env.VITE_API_URL}/monitors`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (response.ok) {
        const data = await response.json()
        setMonitors(data)
      }
    } catch (error) {
      console.error('Erro ao buscar monitores:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const token = localStorage.getItem('auth_token')
      const url = editingGroup 
        ? `${import.meta.env.VITE_API_URL}/groups/${editingGroup.id}`
        : `${import.meta.env.VITE_API_URL}/groups`
      
      const method = editingGroup ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        addToast({
          title: editingGroup ? 'Grupo atualizado com sucesso' : 'Grupo criado com sucesso',
          variant: 'success'
        })
        setIsDialogOpen(false)
        setEditingGroup(null)
        resetForm()
        fetchData()
      } else {
        throw new Error('Erro ao salvar grupo')
      }
    } catch (error) {
      console.error('Erro ao salvar grupo:', error)
      addToast({ title: 'Erro ao salvar grupo', variant: 'destructive' })
    }
  }

  const toggleGroupExpansion = (groupId: string) => {
    const newExpanded = new Set(expandedGroups)
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId)
    } else {
      newExpanded.add(groupId)
    }
    setExpandedGroups(newExpanded)
  }

  const getGroupMonitors = (groupId: string) => {
    return monitors.filter(monitor => monitor.group_id === groupId)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return <div className="w-2 h-2 bg-green-500 rounded-full"></div>
      case 'offline':
        return <div className="w-2 h-2 bg-red-500 rounded-full"></div>
      case 'warning':
        return <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
      default:
        return <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este grupo? Todos os monitores associados também serão removidos.')) return

    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch(`${import.meta.env.VITE_API_URL}/groups/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })

      if (response.ok) {
        addToast({ title: 'Grupo excluído com sucesso', variant: 'success' })
        fetchGroups()
      } else {
        throw new Error('Erro ao excluir grupo')
      }
    } catch (error) {
      console.error('Erro ao excluir grupo:', error)
      addToast({ title: 'Erro ao excluir grupo', variant: 'destructive' })
    }
  }

  const handleEdit = (group: Group) => {
    setEditingGroup(group)
    setFormData({
      name: group.name,
      description: group.description,
      slug: group.slug || ''
    })
    setIsDialogOpen(true)
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      slug: ''
    })
  }

  const openCreateDialog = () => {
    setEditingGroup(null)
    resetForm()
    setIsDialogOpen(true)
  }

  const filteredGroups = groups.filter(group => 
    group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    group.description.toLowerCase().includes(searchTerm.toLowerCase())
  )

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
          <h1 className="text-2xl font-bold text-white">Grupos</h1>
          <p className="text-gray-400">Gerencie os grupos do sistema</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Grupo
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]" style={{backgroundColor: '#181b20', borderColor: '#2c313a'}}>
            <DialogHeader>
              <DialogTitle className="text-white">
                {editingGroup ? 'Editar Grupo' : 'Novo Grupo'}
              </DialogTitle>
              <DialogDescription className="text-gray-400">
                {editingGroup 
                  ? 'Atualize as informações do grupo'
                  : 'Crie um novo grupo para organizar seus monitores'
                }
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-white">Nome do Grupo</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Cliente ABC, Projeto XYZ"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description" className="text-white">Descrição</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrição opcional do grupo"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="slug" className="text-white">Slug para Página de Status</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="Ex: meu-grupo-1 (deixe vazio para gerar automaticamente)"
                />
                <p className="text-xs text-gray-400">
                  Será usado na URL da página de status: /status/seu-slug
                </p>
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingGroup ? 'Atualizar' : 'Criar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          placeholder="Buscar grupos..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Groups Table */}
      {filteredGroups.length === 0 ? (
        <Card className="border" style={{backgroundColor: '#181b20', borderColor: '#2c313a'}}>
          <CardContent className="text-center py-8">
            <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">
              {searchTerm ? 'Nenhum grupo encontrado' : 'Nenhum grupo criado'}
            </h3>
            <p className="text-gray-400 mb-4">
              {searchTerm 
                ? 'Tente ajustar o termo de busca'
                : 'Crie grupos para organizar seus monitores por projeto ou categoria'
              }
            </p>
            {!searchTerm && (
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeiro Grupo
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border" style={{backgroundColor: '#181b20', borderColor: '#2c313a'}}>
          <Table>
            <TableHeader>
              <TableRow style={{borderColor: '#2c313a'}}>
                <TableHead className="text-gray-300">Grupo</TableHead>
                <TableHead className="text-gray-300">Descrição</TableHead>
                <TableHead className="text-gray-300">Monitores</TableHead>
                <TableHead className="text-gray-300">Criado em</TableHead>
                <TableHead className="text-gray-300 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredGroups.map((group) => {
                const groupMonitors = getGroupMonitors(group.id)
                const isExpanded = expandedGroups.has(group.id)
                
                return (
                  <>
                    <TableRow key={group.id} style={{borderColor: '#2c313a'}} className="hover:bg-gray-800/50">
                      <TableCell className="text-white">
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleGroupExpansion(group.id)}
                            className="p-1 h-6 w-6 text-gray-400 hover:text-white"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                          <Building className="h-4 w-4 text-primary" />
                          <span className="font-medium">{group.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-300">
                        {group.description || '-'}
                      </TableCell>
                      <TableCell className="text-gray-300">
                        <div className="flex items-center space-x-2">
                          <Globe className="h-4 w-4" />
                          <span>
                            {group.monitor_count} {group.monitor_count === 1 ? 'monitor' : 'monitores'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-300">
                        {new Date(group.created_at).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(group)}
                            className="bg-gray-700 border-gray-600 text-gray-300 hover:bg-blue-600 hover:text-white hover:border-blue-500"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(group.id)}
                            className="bg-gray-700 border-gray-600 text-red-400 hover:bg-red-600 hover:text-white hover:border-red-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    
                    {/* Expanded monitors section */}
                    {isExpanded && groupMonitors.length > 0 && (
                      <TableRow style={{borderColor: '#2c313a'}}>
                        <TableCell colSpan={5} className="p-0">
                          <div className="p-4" style={{backgroundColor: '#181b20'}}>
                            <h4 className="text-sm font-medium text-gray-300 mb-3">Monitores do Grupo:</h4>
                            <div className="space-y-2">
                              {groupMonitors.map((monitor) => (
                                <div key={monitor.id} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                                  <div className="flex items-center space-x-3">
                                    {getStatusIcon(monitor.status)}
                                    <div>
                                      <div className="text-white font-medium">{monitor.name}</div>
                                      <div className="text-gray-400 text-sm">{monitor.url}</div>
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-4 text-sm text-gray-400">
                                    <span className="capitalize">{monitor.type}</span>
                                    {monitor.response_time && (
                                      <span>{monitor.response_time}ms</span>
                                    )}
                                    <span className={`px-2 py-1 rounded-full text-xs ${
                                      monitor.status === 'online' ? 'bg-green-900 text-green-300' :
                                      monitor.status === 'offline' ? 'bg-red-900 text-red-300' :
                                      monitor.status === 'warning' ? 'bg-yellow-900 text-yellow-300' :
                                      'bg-gray-900 text-gray-300'
                                    }`}>
                                      {monitor.status === 'online' ? 'Online' :
                                       monitor.status === 'offline' ? 'Offline' :
                                       monitor.status === 'warning' ? 'Aviso' : 'Desconhecido'}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                    
                    {/* Empty state for expanded group with no monitors */}
                    {isExpanded && groupMonitors.length === 0 && (
                      <TableRow style={{borderColor: '#2c313a'}}>
                        <TableCell colSpan={5} className="p-0">
                          <div className="bg-gray-900/50 p-4 text-center">
                            <p className="text-gray-400 text-sm">Nenhum monitor encontrado neste grupo</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}