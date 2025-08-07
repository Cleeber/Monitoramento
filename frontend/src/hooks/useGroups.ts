import { useState, useEffect } from 'react';

interface Group {
  id: string;
  name: string;
  description?: string;
  slug: string;
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
        
        const response = await fetch('http://localhost:8080/api/public/groups');
        
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