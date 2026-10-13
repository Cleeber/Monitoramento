import React, { useState, useMemo } from 'react';
import { PageHeader } from '../components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { ExternalLink, Globe, Monitor, Filter, ArrowUpDown } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import useMonitors from '../hooks/useMonitors';
import { getAllStatusPageUrl, getStatusPageUrl } from '../utils/urlUtils';

type SortOption = 'recent' | 'alphabetical' | 'status';

const StatusPagesPage: React.FC = () => {
  const { monitors, loading, error } = useMonitors();
  
  const [monitorsSortBy, setMonitorsSortBy] = useState<SortOption>('recent');
  const [monitorsSortReverse, setMonitorsSortReverse] = useState(false);

  const handleOpenStatusPage = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

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
      case 'status': {
        // Ordenar por status: online > warning > offline > unknown
        const statusOrder = { 'online': 0, 'warning': 1, 'offline': 2, 'unknown': 3 };
        sorted = monitorsCopy.sort((a, b) => {
          const statusA = statusOrder[a.status as keyof typeof statusOrder] ?? 3;
          const statusB = statusOrder[b.status as keyof typeof statusOrder] ?? 3;
          return statusA - statusB;
        });
        break;
      }
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
        <SelectTrigger className="w-[180px]" aria-label="Ordenar monitores">
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
        aria-label="Inverter ordem dos monitores"
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
          <h2 className="text-lg font-semibold text-red-400 mb-2">Erro ao carregar monitores</h2>
          <p className="text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Páginas de Status" description="Acesse e compartilhe as páginas públicas dos seus serviços" />

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
        {/* Página de Status Geral */}
        <Card>
          <CardContent className="pt-5">
          <div className="flex flex-col gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <div className="shrink-0 p-2 rounded-lg" style={{backgroundColor: '#1e3a8a'}}>
                <Globe className="h-6 w-6 text-white" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-white">Todas as Páginas</h3>
                <p className="text-gray-400 text-sm">
                  Página de status geral com todos os serviços monitorados
                </p>
                <p className="break-all text-xs text-gray-500 mt-1">
                  URL: {getAllStatusPageUrl()}
                </p>
              </div>
            </div>
            <Button
              onClick={() => handleOpenStatusPage(getAllStatusPageUrl())}
              className="gap-2 bg-[#1e3a8a] hover:bg-blue-800"
            >
              <ExternalLink className="h-4 w-4" />
              <span>Abrir status geral</span>
            </Button>
          </div>
          </CardContent>
        </Card>

        {/* Monitores Individuais */}
        {monitors.length > 0 && (
          <Card>
            <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <CardTitle className="text-white flex items-center gap-2">
                <Monitor className="h-5 w-5" />
                <span>Monitores Individuais</span>
              </CardTitle>
              <SortFilter 
                value={monitorsSortBy} 
                onChange={setMonitorsSortBy}
                reverse={monitorsSortReverse}
                onReverseChange={setMonitorsSortReverse}
                showStatus={true} 
              />
            </div>
            </CardHeader>
            <CardContent>
              <Table className="min-w-[760px]">
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
                      <TableCell className="min-w-[180px] text-white">
                        <div className="flex items-center space-x-2">
                          <Monitor aria-label={monitor.status} className={`h-4 w-4 shrink-0 ${monitor.status === 'online' ? 'text-green-500' : monitor.status === 'offline' ? 'text-red-500' : monitor.status === 'warning' ? 'text-yellow-500' : 'text-gray-500'}`} />
                          <span className="font-medium">{monitor.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-300">
                        <code className="block max-w-[220px] truncate text-xs" title={monitor.url}>
                          {monitor.url}
                        </code>
                      </TableCell>
                      <TableCell className="text-gray-300">
                        <code className="block max-w-[240px] truncate text-xs" title={getStatusPageUrl(monitor.slug)}>
                          {getStatusPageUrl(monitor.slug)}
                        </code>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          onClick={() => handleOpenStatusPage(getStatusPageUrl(monitor.slug))}
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
            </CardContent>
          </Card>
        )}

        {monitors.length === 0 && !loading && (
          <Card className="p-6 text-center">
            <Monitor className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-white mb-2">Nenhuma página de status encontrada</h3>
            <p className="text-gray-400">
              Crie monitores para gerar páginas de status personalizadas
            </p>
          </Card>
        )}
      </div>

      <div className="p-4 border border-blue-500/30 bg-blue-600/10 rounded-lg">
        <h3 className="text-sm font-medium text-blue-200 mb-2">💡 Dica</h3>
        <p className="text-sm text-blue-100">
          Compartilhe estes links para que possam acompanhar o status dos serviços em tempo real.
          As páginas são públicas e não requerem autenticação.
        </p>
      </div>
    </div>
  );
};

export default StatusPagesPage;
