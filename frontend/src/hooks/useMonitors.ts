import { useState, useEffect } from 'react';

interface Monitor {
  id: string;
  name: string;
  url: string;
  slug: string;
  group_id: string | null;
  group_name: string | null;
  status: 'online' | 'offline' | 'warning' | 'unknown';
}

interface UseMonitorsReturn {
  monitors: Monitor[];
  loading: boolean;
  error: string | null;
}

function useMonitors(): UseMonitorsReturn {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMonitors = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`${import.meta.env.VITE_API_URL}/public/monitors`);
        
        if (!response.ok) {
          throw new Error(`Erro ao buscar monitores: ${response.status}`);
        }
        
        const data = await response.json();
        setMonitors(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
        console.error('Erro ao buscar monitores:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMonitors();
  }, []);

  return { monitors, loading, error };
}

export default useMonitors;