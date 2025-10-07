import React from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Calendar } from 'lucide-react'

export interface TimeRange {
  value: string
  label: string
  description: string
}

export const timeRanges: TimeRange[] = [
  { value: 'yesterday', label: 'Ontem', description: 'Dados do dia anterior completo' },
  { value: 'last_week', label: 'Semana passada', description: 'Dados da semana anterior (segunda a domingo)' },
  { value: 'last_month', label: 'Mês passado', description: 'Dados do mês anterior completo' },
  { value: '7d', label: 'Últimos 7 dias', description: 'Dados dos últimos 7 dias corridos (incluindo hoje)' },
  { value: '30d', label: 'Últimos 30 dias', description: 'Dados dos últimos 30 dias corridos (incluindo hoje)' },
  { value: '90d', label: 'Últimos 3 meses', description: 'Dados dos últimos 90 dias corridos' }
]

export const DEFAULT_TIME_RANGE = 'last_month'

interface PeriodFilterProps {
  selectedTimeRange: string
  onTimeRangeChange: (value: string) => void
  className?: string
}

export function PeriodFilter({ selectedTimeRange, onTimeRangeChange, className }: PeriodFilterProps) {
  return (
    <div className={`flex items-center gap-2 ${className || ''}`}>
      <Calendar className="h-4 w-4 text-muted-foreground" />
      <Select value={selectedTimeRange} onValueChange={onTimeRangeChange}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Selecione o período" />
        </SelectTrigger>
        <SelectContent>
          {timeRanges.map((range) => (
            <SelectItem key={range.value} value={range.value}>
              <div className="flex flex-col">
                <span className="font-medium">{range.label}</span>
                <span className="text-xs text-muted-foreground">{range.description}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}