/**
 * Utilitários para geração de URLs baseadas no ambiente
 */

/**
 * Obtém a URL base do frontend baseada no ambiente atual
 * Em desenvolvimento: usa localhost
 * Em produção: usa o domínio atual da aplicação
 */
export function getBaseUrl(): string {
  // Se estamos no browser
  if (typeof window !== 'undefined') {
    // Em produção, usar o domínio atual
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return `${window.location.protocol}//${window.location.host}`;
    }
    
    // Em desenvolvimento local, usar localhost:3000 (porta padrão do frontend em produção via Docker)
    return 'http://localhost:3000';
  }
  
  // Fallback para SSR ou outros contextos
  return 'http://localhost:3000';
}

/**
 * Gera URL para página de status pública
 * @param slug - Slug do grupo/monitor ou 'all' para página geral
 * @returns URL completa para a página de status
 */
export function getStatusPageUrl(slug: string): string {
  const baseUrl = getBaseUrl();
  return `${baseUrl}/status/${slug}`;
}

/**
 * Gera URL para página de status geral (todos os serviços)
 * @returns URL completa para a página de status geral
 */
export function getAllStatusPageUrl(): string {
  return getStatusPageUrl('all');
}