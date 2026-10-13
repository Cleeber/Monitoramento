import { useEffect, useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { Activity, LayoutDashboard, Globe, Settings, FileText, LogOut, Menu, ExternalLink, PanelLeftClose, PanelLeftOpen, ChevronRight } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { Button } from './ui/button'
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetTrigger } from './ui/sheet'
import { cn } from '../lib/utils'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Domínios', href: '/dominios', icon: Globe },
  { name: 'Configurações SMTP', href: '/config/smtp', icon: Settings },
  { name: 'Relatórios', href: '/relatorios', icon: FileText },
  { name: 'Páginas de Status', href: '/paginas-status', icon: ExternalLink },
]

export function Layout() {
  const { logout, user } = useAuth()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const currentPage = navigation.find(item => item.href === location.pathname)?.name || 'Dashboard'

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)')
    const closeMobileNavigation = () => { if (desktop.matches) setSidebarOpen(false) }
    desktop.addEventListener('change', closeMobileNavigation)
    return () => desktop.removeEventListener('change', closeMobileNavigation)
  }, [])

  const sidebar = (compact = false) => (
    <>
      <Link to="/dashboard" aria-label="Página 1 — Dashboard" onClick={() => setSidebarOpen(false)} className={cn('flex h-28 shrink-0 items-center border-b border-border px-6', compact && 'justify-center px-3')}>
        {compact ? <Activity className="h-7 w-7 text-primary" /> : <img src="/Pag1_Principal.svg" alt="Página 1" className="h-auto w-36" />}
      </Link>
      <nav aria-label="Navegação principal" className="flex-1 space-y-1 px-3 py-6">
        {!compact && <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Monitoramento</p>}
        {navigation.map(item => (
          <Button key={item.href} variant="ghost" asChild className={cn('h-11 w-full justify-start gap-3 text-muted-foreground hover:text-foreground', compact && 'justify-center px-0', location.pathname === item.href && 'bg-[#1e3a8a] text-white hover:bg-[#1e3a8a]')}>
            <Link to={item.href} aria-current={location.pathname === item.href ? 'page' : undefined} title={compact ? item.name : undefined} onClick={() => setSidebarOpen(false)}>
              <item.icon className="h-[18px] w-[18px] shrink-0" />
              <span className={compact ? 'sr-only' : ''}>{item.name}</span>
            </Link>
          </Button>
        ))}
      </nav>
      <div className="border-t border-border p-3">
        {!compact && <div className="mb-3 min-w-0 px-3 py-2"><p className="truncate text-sm font-medium">{user?.name || 'Minha conta'}</p><p className="truncate text-xs text-muted-foreground">{user?.email}</p></div>}
        <Button variant="ghost" className={cn('w-full justify-start gap-3 text-muted-foreground', compact && 'justify-center px-0')} onClick={() => logout()} title={compact ? 'Sair' : undefined}>
          <LogOut className="h-4 w-4 shrink-0" /><span className={compact ? 'sr-only' : ''}>Sair</span>
        </Button>
      </div>
    </>
  )

  return (
    <div className="admin-theme admin-shell min-h-screen bg-background text-foreground">
      <aside className={cn('fixed inset-y-0 left-0 z-40 hidden flex-col overflow-y-auto border-r border-border bg-card lg:flex', collapsed ? 'w-[72px]' : 'w-60')}>
        {sidebar(collapsed)}
      </aside>
      <div className={cn('min-w-0', collapsed ? 'lg:pl-[72px]' : 'lg:pl-60')}>
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/95 px-4 backdrop-blur sm:px-6 2xl:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
              <SheetTrigger asChild><Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir navegação"><Menu className="h-5 w-5" /></Button></SheetTrigger>
              <SheetContent side="left" className="admin-theme flex w-72 flex-col overflow-y-auto bg-card p-0 lg:hidden">
                <SheetTitle className="sr-only">Navegação principal</SheetTitle>
                <SheetDescription className="sr-only">Acesse as páginas do sistema de monitoramento.</SheetDescription>
                {sidebar()}
              </SheetContent>
            </Sheet>
            <Button variant="ghost" size="icon" className="hidden text-muted-foreground lg:inline-flex" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'} aria-expanded={!collapsed}>
              {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
            </Button>
            <span className="hidden text-sm text-muted-foreground sm:inline">Monitoramento</span>
            <ChevronRight className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" />
            <span className="truncate text-sm font-medium">{currentPage}</span>
          </div>
          <span className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex"><Activity className="h-4 w-4 text-primary" />Painel de controle</span>
        </header>
        <main id="main-content" className="min-w-0 p-4 sm:p-6 2xl:p-8"><Outlet /></main>
      </div>
    </div>
  )
}
