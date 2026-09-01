import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export interface TimeRange {
  value: string
  label: string
  description: string
}

export const timeRanges: TimeRange[] = [
  { value: '24h', label: 'Últimas 24 horas', description: 'Dados das últimas 24 horas' },
  { value: '7d', label: 'Últimos 7 dias', description: 'Dados dos últimos 7 dias corridos (incluindo hoje)' },
  { value: '30d', label: 'Últimos 30 dias', description: 'Dados dos últimos 30 dias corridos (incluindo hoje)' }
]

export const DEFAULT_TIME_RANGE = '24h'

interface PeriodFilterProps {
  selectedTimeRange: string
  onTimeRangeChange: (value: string) => void
  className?: string
}

export function PeriodFilter({ selectedTimeRange, onTimeRangeChange, className }: PeriodFilterProps) {
  return (
    <div className={className || ''}>
      <Select value={selectedTimeRange} onValueChange={onTimeRangeChange}>
        <SelectTrigger className="w-[250px]">
          <SelectValue placeholder="Selecione o período" />
        </SelectTrigger>
        <SelectContent>
          {timeRanges.map((range) => (
            <SelectItem key={range.value} value={range.value}>
              {range.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}