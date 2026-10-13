import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { PublicStatusReport } from '../components/public-status/PublicStatusReport'
import { loadPublicReport, type PublicReport } from '../utils/publicReport'

export function StatusPage() {
  const { slug } = useParams<{ slug: string }>()
  const [report, setReport] = useState<PublicReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    let inFlight = false
    setReport(null)
    setLoading(true)
    setError(null)

    const refresh = async () => {
      if (inFlight) return
      inFlight = true
      try {
        const nextReport = await loadPublicReport(slug, controller.signal)
        if (!controller.signal.aborted) {
          setReport(nextReport)
          setError(null)
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Não foi possível carregar o status.')
        }
      } finally {
        inFlight = false
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void refresh()
    const interval = window.setInterval(refresh, 30_000)
    return () => {
      controller.abort()
      window.clearInterval(interval)
    }
  }, [slug])

  return <PublicStatusReport report={report} loading={loading} error={error} />
}
