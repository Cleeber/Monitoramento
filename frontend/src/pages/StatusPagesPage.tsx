import React, { useState, useMemo } from 'react';
import { ExternalLink, Globe, Users, Monitor, Filter, ArrowUpDown } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import useGroups from '../hooks/useGroups';
import useMonitors from '../hooks/useMonitors';

type SortOption = 'recent' | 'alphabetical' | 'status';

const StatusPagesPage: React.FC = () => {
  const { groups, loading: groupsLoading, error: groupsError } = useGroups();
  const { monitors, loading: monitorsLoading, error: monitorsError } = useMonitors();
  
  const [groupsSortBy, setGroupsSortBy] = useState<SortOption>('recent');
  const [groupsSortReverse, setGroupsSortReverse] = useState(false);
  const [monitorsSortBy, setMonitorsSortBy] = useState<SortOption>('recent');
  const [monitorsSortReverse, setMonitorsSortReverse] = useState(false);
  
  const loading = groupsLoading || monitorsLoading;
  const error = groupsError || monitorsError;

  const handleOpenStatusPage = (url: string) => {
    window.open(url, '_blank');
  };

  // Função para ordenar grupos
  const sortedGroups = useMemo(() => {
    if (!groups) return [];
    
    const groupsCopy = [...groups];
    let sorted;
    
    switch (groupsSortBy) {
      case 'alphabetical':
        sorted = groupsCopy.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'recent':
        sorted = groupsCopy.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
        break;
      case 'status':
        // Para grupos, ordenar por nome já que não temos status direto
        sorted = groupsCopy.sort((a, b) => a.name.localeCompare(b.name));
        break;
      default:
        sorted = groupsCopy;
    }
    
    return groupsSortReverse ? sorted.reverse() : sorted;
  }, [groups, groupsSortBy, groupsSortReverse]);

  // Função para ordenar monitores
  const sortedMonitors = useMemo(() => {
    if (!monitors) return [];
    
    const monitorsCopy = [...monitors];
    let sorted;
    
    switch (monitorsSortBy) {
      case 'alphabetical':
        sorted = monitorsCopy.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'recent':
        sorted = monitorsCopy.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
        break;
      case 'status':
        // Ordenar por status: online > warning > offline > unknown
        const statusOrder = { 'online': 0, 'warning': 1, 'offline': 2, 'unknown': 3 };
        sorted = monitorsCopy.sort((a, b) => {
          const statusA = statusOrder[a.status as keyof typeof statusOrder] ?? 3;
          const statusB = statusOrder[b.status as keyof typeof statusOrder] ?? 3;
          return statusA - statusB;
        });
        break;
      default:
        sorted = monitorsCopy;
    }
    
    return monitorsSortReverse ? sorted.reverse() : sorted;
  }, [monitors, monitorsSortBy, monitorsSortReverse]);

  // Componente de filtro
  const SortFilter: React.FC<{ 
    value: SortOption; 
    onChange: (value: SortOption) => void; 
    reverse: boolean;
    onReverseChange: (reverse: boolean) => void;
    showStatus?: boolean 
  }> = ({ value, onChange, reverse, onReverseChange, showStatus = false }) => (
    <div className="flex items-center space-x-2">
      <Filter className="h-4 w-4 text-gray-400" />
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-[180px] bg-gray-800 border-gray-600 text-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-gray-800 border-gray-600">
          <SelectItem value="recent" className="text-white hover:bg-gray-700">Mais Recentes</SelectItem>
          <SelectItem value="alphabetical" className="text-white hover:bg-gray-700">Ordem Alfabética</SelectItem>
          {showStatus && (
            <SelectItem value="status" className="text-white hover:bg-gray-700">Por Status</SelectItem>
          )}
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onReverseChange(!reverse)}
        className="transition-all duration-200 bg-gray-800 border-gray-600 text-gray-400 hover:bg-gray-700 hover:border-gray-500 hover:text-white"
        title={reverse ? 'Ordem Decrescente' : 'Ordem Crescente'}
      >
        <ArrowUpDown className="h-4 w-4" />
      </Button>
    </div>
  );

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-600 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-600 rounded"></div>
            <div className="h-4 bg-gray-600 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="border rounded-lg p-4" style={{backgroundColor: '#181b20', borderColor: '#dc2626'}}>
          <h2 className="text-lg font-semibold text-red-400 mb-2">Erro ao carregar grupos</h2>
          <p className="text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-2">Páginas de Status</h1>
        <p className="text-gray-400">
          Acesse as páginas públicas de status para compartilhar com seus grupos
        </p>
      </div>

      <div className="grid gap-6">
        {/* Página de Status Geral */}
        <div className="rounded-lg border p-6" style={{backgroundColor: '#181b20', borderColor: '#2c313a'}}>
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg" style={{backgroundColor: '#1e3a8a'}}>
                <Globe className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Todas as Páginas</h3>
                <p className="text-gray-400 text-sm">
                  Página de status geral com todos os serviços monitorados
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  URL: http://localhost:3000/status/all
                </p>
              </div>
            </div>
            <button
              onClick={() => handleOpenStatusPage('http://localhost:3000/status/all')}
              className="flex items-center space-x-2 px-4 py-2 text-white rounded-lg transition-colors"
              style={{backgroundColor: '#1e3a8a'}}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1e40af'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1e3a8a'}
            >
              <ExternalLink className="h-4 w-4" />
              <span>Abrir</span>
            </button>
          </div>
        </div>

        {/* Páginas por Grupo */}
        {groups.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>Páginas por Grupo</span>
              </h2>
              <SortFilter 
                value={groupsSortBy} 
                onChange={setGroupsSortBy}
                reverse={groupsSortReverse}
                onReverseChange={setGroupsSortReverse}
              />
            </div>
            <div className="rounded-lg border" style={{backgroundColor: '#181b20', borderColor: '#2c313a'}}>
              <Table>
                <TableHeader>
                  <TableRow style={{borderColor: '#2c313a'}}>
                    <TableHead className="text-gray-300">Grupo</TableHead>
                    <TableHead className="text-gray-300">Descrição</TableHead>
                    <TableHead className="text-gray-300">URL</TableHead>
                    <TableHead className="text-gray-300 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedGroups.map((group) => (
                    <TableRow key={group.id} style={{borderColor: '#2c313a'}} className="hover:bg-gray-800/50">
                      <TableCell className="text-white">
                        <div className="flex items-center space-x-2">
                          <Users className="h-4 w-4 text-green-500" />
                          <span className="font-medium">{group.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-300">
                        {group.description || '-'}
                      </TableCell>
                      <TableCell className="text-gray-300">
                        <code className="text-xs bg-gray-800 px-2 py-1 rounded">
                          http://localhost:3000/status/{group.slug}
                        </code>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          onClick={() => handleOpenStatusPage(`http://localhost:3000/status/${group.slug}`)}
                          className="bg-green-600 hover:bg-green-700 text-white"
                          size="sm"
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          Abrir
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Monitores Individuais */}
        {monitors.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white flex items-center space-x-2">
                <Monitor className="h-5 w-5" />
                <span>Monitores Individuais</span>
              </h2>
              <SortFilter 
                value={monitorsSortBy} 
                onChange={setMonitorsSortBy}
                reverse={monitorsSortReverse}
                onReverseChange={setMonitorsSortReverse}
                showStatus={true} 
              />
            </div>
            <div className="rounded-lg border" style={{backgroundColor: '#181b20', borderColor: '#2c313a'}}>
              <Table>
                <TableHeader>
                  <TableRow style={{borderColor: '#2c313a'}}>
                    <TableHead className="text-gray-300">Monitor</TableHead>
                    <TableHead className="text-gray-300">URL Monitorada</TableHead>
                    <TableHead className="text-gray-300">URL da Página</TableHead>
                    <TableHead className="text-gray-300 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedMonitors.map((monitor) => (
                    <TableRow key={monitor.id} style={{borderColor: '#2c313a'}} className="hover:bg-gray-800/50">
                      <TableCell className="text-white">
                        <div className="flex items-center space-x-2">
                          <Monitor className="h-4 w-4 text-green-500" />
                          <span className="font-medium">{monitor.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-300">
                        <code className="text-xs bg-gray-800 px-2 py-1 rounded">
                          {monitor.url}
                        </code>
                      </TableCell>
                      <TableCell className="text-gray-300">
                        <code className="text-xs bg-gray-800 px-2 py-1 rounded">
                          http://localhost:3000/status/{monitor.slug}
                        </code>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          onClick={() => handleOpenStatusPage(`http://localhost:3000/status/${monitor.slug}`)}
                          className="bg-green-600 hover:bg-green-700 text-white"
                          size="sm"
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          Abrir
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {groups.length === 0 && monitors.length === 0 && !loading && (
          <div className="border rounded-lg p-6 text-center" style={{backgroundColor: '#181b20', borderColor: '#2c313a'}}>
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-white mb-2">Nenhuma página de status encontrada</h3>
            <p className="text-gray-400">
              Crie grupos e monitores para gerar páginas de status personalizadas
            </p>
          </div>
        )}
      </div>

      <div className="mt-8 p-4 border rounded-lg" style={{backgroundColor: '#1e3a8a', borderColor: '#3b82f6'}}>
        <h3 className="text-sm font-medium text-blue-200 mb-2">💡 Dica</h3>
        <p className="text-sm text-blue-100">
          Compartilhe estes links com seus grupos para que eles possam acompanhar o status dos serviços em tempo real.
          As páginas são públicas e não requerem autenticação.
        </p>
      </div>
    </div>
  );
};

export default StatusPagesPage;