import React from 'react';
import { ExternalLink, Globe, Users } from 'lucide-react';
import useGroups from '../hooks/useGroups';

const StatusPagesPage: React.FC = () => {
  const { groups, loading, error } = useGroups();

  const handleOpenStatusPage = (url: string) => {
    window.open(url, '_blank');
  };

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
              <div className="p-2 rounded-lg" style={{backgroundColor: '#6b26d9'}}>
                <Globe className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Todas as Páginas</h3>
                <p className="text-gray-400 text-sm">
                  Página de status geral com todos os serviços monitorados
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  URL: http://localhost:3001/status/all
                </p>
              </div>
            </div>
            <button
              onClick={() => handleOpenStatusPage('http://localhost:3001/status/all')}
              className="flex items-center space-x-2 px-4 py-2 text-white rounded-lg transition-colors"
              style={{backgroundColor: '#6b26d9'}}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#5b21b6'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#6b26d9'}
            >
              <ExternalLink className="h-4 w-4" />
              <span>Abrir</span>
            </button>
          </div>
        </div>

        {/* Páginas por Grupo */}
        {groups.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>Páginas por Grupo</span>
            </h2>
            <div className="grid gap-4">
              {groups.map((group) => (
                <div key={group.id} className="rounded-lg border p-6" style={{backgroundColor: '#181b20', borderColor: '#2c313a'}}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 rounded-lg" style={{backgroundColor: '#059669'}}>
                        <Users className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">{group.name}</h3>
                        {group.description && (
                          <p className="text-gray-400 text-sm">{group.description}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          URL: http://localhost:3001/status/{group.id}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleOpenStatusPage(`http://localhost:3001/status/${group.id}`)}
                      className="flex items-center space-x-2 px-4 py-2 text-white rounded-lg transition-colors"
                      style={{backgroundColor: '#059669'}}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#047857'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#059669'}
                    >
                      <ExternalLink className="h-4 w-4" />
                      <span>Abrir</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {groups.length === 0 && !loading && (
          <div className="border rounded-lg p-6 text-center" style={{backgroundColor: '#181b20', borderColor: '#2c313a'}}>
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-white mb-2">Nenhum grupo encontrado</h3>
            <p className="text-gray-400">
              Crie grupos de monitoramento para organizar seus serviços
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