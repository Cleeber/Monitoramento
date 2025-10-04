import { useState, useEffect } from 'react';

interface Monitor {
  id: string;
  name: string;
  url: string;
  slug: string;
  group_id: string | null;
  group_name: string | null;
  status: 'online' | 'offline' | 'warning' | 'unknown';
  // created_at é opcional, pois nem todas as APIs podem retornar
  created_at?: string;
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
        
        // Normaliza base pública para evitar duplicação de '/api' e 502
        const API_BASE = (() => {
          const raw = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
          const isAbsolute = /^https?:\/\//i.test(raw)
          const origin = (import.meta.env.VITE_BACKEND_ORIGIN || '').replace(/\/$/, '')
          const base = isAbsolute ? raw : `${origin}${raw || '/api'}`
          return (base || '').replace(/\/$/, '').replace(/\/api$/, '')
        })()
        const response = await fetch(`${API_BASE}/api/public/monitors`);
        
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