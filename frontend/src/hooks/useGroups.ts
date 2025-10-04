import { useState, useEffect } from 'react';

interface Group {
  id: string;
  name: string;
  description?: string;
  slug: string;
  // created_at é opcional, pois pode não ser retornado por todas as APIs
  created_at?: string;
}

interface UseGroupsReturn {
  groups: Group[];
  loading: boolean;
  error: string | null;
}

function useGroups(): UseGroupsReturn {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Normaliza base pública para evitar duplicação de '/api' e 502
        const API_BASE = (() => {
          const raw = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
          const isAbsolute = /^https?:\/\//i.test(raw)
          const origin = (import.meta.env.VITE_BACKEND_ORIGIN || '').replace(/\/$/, '')
          const base = isAbsolute ? raw : `${origin}${raw || '/api'}`
          return (base || '').replace(/\/$/, '').replace(/\/api$/, '')
        })()
        const response = await fetch(`${API_BASE}/api/public/groups`);
        
        if (!response.ok) {
          throw new Error(`Erro ao buscar grupos: ${response.status}`);
        }
        
        const data = await response.json();
        setGroups(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
        console.error('Erro ao buscar grupos:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchGroups();
  }, []);

  return { groups, loading, error };
}

export default useGroups;