export interface PeriodRange {
  startDate: Date
  endDate: Date
  label: string
}

/**
 * Calcula o período baseado no filtro selecionado
 */
export function calculatePeriodRange(timeRange: string): PeriodRange {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  
  switch (timeRange) {
    case 'yesterday': {
      // Ontem - dia anterior completo
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      const endOfYesterday = new Date(yesterday)
      endOfYesterday.setHours(23, 59, 59, 999)
      
      return {
        startDate: yesterday,
        endDate: endOfYesterday,
        label: 'Ontem'
      }
    }
    
    case 'last_week': {
      // Semana passada - segunda a domingo da semana anterior
      const lastWeekEnd = new Date(today)
      const dayOfWeek = today.getDay()
      const daysToSubtract = dayOfWeek === 0 ? 7 : dayOfWeek // Se domingo (0), volta 7 dias
      lastWeekEnd.setDate(lastWeekEnd.getDate() - daysToSubtract)
      
      const lastWeekStart = new Date(lastWeekEnd)
      lastWeekStart.setDate(lastWeekStart.getDate() - 6)
      
      const endOfLastWeek = new Date(lastWeekEnd)
      endOfLastWeek.setHours(23, 59, 59, 999)
      
      return {
        startDate: lastWeekStart,
        endDate: endOfLastWeek,
        label: 'Semana passada'
      }
    }
    
    case 'last_month': {
      // Mês passado - mês anterior completo
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0)
      endOfLastMonth.setHours(23, 59, 59, 999)
      
      return {
        startDate: lastMonth,
        endDate: endOfLastMonth,
        label: 'Mês passado'
      }
    }
    
    case '7d': {
      // Últimos 7 dias - incluindo hoje
      const sevenDaysAgo = new Date(today)
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
      
      const endOfToday = new Date(today)
      endOfToday.setHours(23, 59, 59, 999)
      
      return {
        startDate: sevenDaysAgo,
        endDate: endOfToday,
        label: 'Últimos 7 dias'
      }
    }
    
    case '30d': {
      // Últimos 30 dias - incluindo hoje
      const thirtyDaysAgo = new Date(today)
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29)
      
      const endOfToday = new Date(today)
      endOfToday.setHours(23, 59, 59, 999)
      
      return {
        startDate: thirtyDaysAgo,
        endDate: endOfToday,
        label: 'Últimos 30 dias'
      }
    }
    
    case '90d': {
      // Últimos 3 meses (90 dias) - incluindo hoje
      const ninetyDaysAgo = new Date(today)
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 89)
      
      const endOfToday = new Date(today)
      endOfToday.setHours(23, 59, 59, 999)
      
      return {
        startDate: ninetyDaysAgo,
        endDate: endOfToday,
        label: 'Últimos 3 meses'
      }
    }
    
    default: {
      // Fallback para mês passado
      return calculatePeriodRange('last_month')
    }
  }
}

/**
 * Formata uma data para string ISO para uso em APIs
 */
export function formatDateForAPI(date: Date): string {
  return date.toISOString()
}

/**
 * Calcula o número de dias entre duas datas
 */
export function getDaysBetween(startDate: Date, endDate: Date): number {
  const timeDiff = endDate.getTime() - startDate.getTime()
  return Math.ceil(timeDiff / (1000 * 3600 * 24))
}

/**
 * Verifica se um período é "corrido" (inclui hoje) ou "completo" (período fechado)
 */
export function isPeriodRunning(timeRange: string): boolean {
  return ['7d', '30d', '90d'].includes(timeRange)
}

/**
 * Obtém a descrição do período para exibição
 */
export function getPeriodDescription(timeRange: string): string {
  const range = calculatePeriodRange(timeRange)
  const days = getDaysBetween(range.startDate, range.endDate)
  
  if (isPeriodRunning(timeRange)) {
    return `${range.label} (${days} dias corridos)`
  } else {
    return `${range.label} (período completo)`
  }
}