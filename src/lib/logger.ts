type Level = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

interface LogEntry {
  level: Level
  time: string
  service: string
  message: string
  [key: string]: unknown
}

export function createLogger(service: string) {
  return (level: Level, message: string, data: Record<string, unknown> = {}) => {
    const entry: LogEntry = {
      level,
      time: new Date().toISOString(),
      service,
      message,
      ...data,
    }
    const output = level === 'error' || level === 'fatal' ? console.error : console.log
    output(JSON.stringify(entry))
  }
}

export const apiLogger = createLogger('api')
export const monitoringLogger = createLogger('monitoring')
