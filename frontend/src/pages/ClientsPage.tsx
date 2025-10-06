import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog'
import { Label } from '../components/ui/label'
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Globe,
  Building
} from 'lucide-react'
import { useToast } from '../contexts/ToastContext'
import { apiGet, apiPost, apiPut, apiDelete } from '../utils/apiUtils'

interface Group {
  id: string
  name: string
  description: string
  monitor_count: number
  created_at: string
}

interface GroupFormData {
  name: string
  description: string
}

export function ClientsPage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<Group | null>(null)
  const [formData, setFormData] = useState<GroupFormData>({
    name: '',
    description: ''
  })
  const { addToast } = useToast()

  useEffect(() => {
    fetchGroups()
  }, [])

  const fetchGroups = async () => {
    try {
      const result = await apiGet('/groups')

      if (result.success && Array.isArray(result.data)) {
        setGroups(result.data)
      } else {
        setGroups([])
        addToast({ title: 'Erro ao carregar grupos', description: result.error, variant: 'destructive' })
      }
    } catch (error) {
      console.error('Erro ao buscar grupos:', error)
      addToast({ title: 'Erro ao carregar grupos', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const url = editingGroup 
        ? `/groups/${editingGroup.id}`
        : '/groups'
      
      const result = editingGroup 
        ? await apiPut(url, formData)
        : await apiPost(url, formData)

      if (result.success) {
        addToast({
          title: editingGroup ? 'Grupo atualizado com sucesso' : 'Grupo criado com sucesso',
          variant: 'success'
        })
        setIsDialogOpen(false)
        setEditingGroup(null)
        resetForm()
        fetchGroups()
      } else {
        addToast({ title: 'Erro ao salvar grupo', description: result.error, variant: 'destructive' })
      }
    } catch (error) {
      console.error('Erro ao salvar grupo:', error)
      addToast({ title: 'Erro ao salvar grupo', variant: 'destructive' })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este grupo? Todos os monitores associados também serão removidos.')) return

    try {
      const result = await apiDelete(`/groups/${id}`)

      if (result.success) {
        addToast({ title: 'Grupo excluído com sucesso', variant: 'success' })
        fetchGroups()
      } else {
        addToast({ title: 'Erro ao excluir grupo', description: result.error, variant: 'destructive' })
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
      description: group.description
    })
    setIsDialogOpen(true)
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: ''
    })
  }

  const openCreateDialog = () => {
    setEditingGroup(null)
    resetForm()
    setIsDialogOpen(true)
  }

  const filteredGroups = Array.isArray(groups) ? groups.filter(group => 
    group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    group.description.toLowerCase().includes(searchTerm.toLowerCase())
  ) : []

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
          <h1 className="text-2xl font-bold text-white">Clientes</h1>
          <p className="text-gray-400">Gerencie os grupos e clientes do sistema</p>
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

      {/* Groups Grid */}
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
                : 'Crie grupos para organizar seus monitores por cliente ou projeto'
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGroups.map((group) => (
            <Card key={group.id} className="hover:shadow-md transition-shadow border" style={{backgroundColor: '#181b20', borderColor: '#2c313a'}}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Building className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg text-white">{group.name}</CardTitle>
                  </div>
                  <div className="flex items-center space-x-1">
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
                </div>
                {group.description && (
                  <CardDescription>{group.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-2 text-gray-400">
                    <Globe className="h-4 w-4" />
                    <span>
                      {group.monitor_count} {group.monitor_count === 1 ? 'monitor' : 'monitores'}
                    </span>
                  </div>
                  <div className="text-gray-400">
                    {new Date(group.created_at).toLocaleDateString('pt-BR')}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}