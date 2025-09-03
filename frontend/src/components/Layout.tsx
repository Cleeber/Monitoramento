import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Button } from './ui/button'
import { 
  LayoutDashboard, 
  Globe, 
  Users, 
  Settings, 
  FileText, 
  LogOut,
  Menu,
  X,
  ExternalLink
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '../lib/utils'


const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Domínios', href: '/dominios', icon: Globe },
  { name: 'Grupos', href: '/grupos', icon: Users },
  { name: 'Configurações SMTP', href: '/config/smtp', icon: Settings },
  { name: 'Relatórios', href: '/relatorios', icon: FileText },
]

export function Layout() {
  const { logout } = useAuth()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = () => {
    logout()
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Mobile sidebar */}
      <div className={cn(
        "fixed inset-0 z-50 lg:hidden",
        sidebarOpen ? "block" : "hidden"
      )}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 flex w-64 flex-col shadow-xl" style={{backgroundColor: '#181b20'}}>
          <div className="flex h-16 items-center justify-between px-4">
            <div className="flex items-center">
              <div className="w-full flex items-center justify-center">
                  <img 
                   src="/Pag1_Principal.svg" 
                   alt="Logo da Empresa" 
                   className="w-full h-auto object-contain"
                   style={{ aspectRatio: '198.43/106.36' }}
                  />
                </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(false)}
              className="text-gray-300 hover:text-white"
            >
              <X className="h-6 w-6" />
            </Button>
          </div>
          
          <nav className="flex-1 space-y-1 px-2 py-4">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    "group flex items-center px-2 py-2 text-sm font-medium rounded-md",
                    isActive
                      ? "text-white"
                      : "text-gray-300 hover:text-white"
                  )}
                  style={isActive ? {backgroundColor: '#1e3a8a'} : {}}
                  onMouseEnter={(e) => !isActive && (e.currentTarget.style.backgroundColor = '#2c313a')}
                  onMouseLeave={(e) => !isActive && (e.currentTarget.style.backgroundColor = 'transparent')}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className="mr-3 h-5 w-5" />
                  {item.name}
                </Link>
              )
            })}
            
            {/* Menu de Páginas de Status */}
            <Link
              to="/paginas-status"
              className={cn(
                "group flex items-center px-2 py-2 text-sm font-medium rounded-md",
                location.pathname === '/paginas-status'
                  ? "text-white"
                  : "text-gray-300 hover:text-white"
              )}
              style={location.pathname === '/paginas-status' ? {backgroundColor: '#1e3a8a'} : {}}
              onMouseEnter={(e) => location.pathname !== '/paginas-status' && (e.currentTarget.style.backgroundColor = '#2c313a')}
              onMouseLeave={(e) => location.pathname !== '/paginas-status' && (e.currentTarget.style.backgroundColor = 'transparent')}
              onClick={() => setSidebarOpen(false)}
            >
              <ExternalLink className="mr-3 h-5 w-5" />
              Páginas de Status
            </Link>
          </nav>

          {/* Bottom Section */}
          <div className="mt-auto border-t border-gray-700 p-4">
            <Button
              variant="ghost"
              className="w-full justify-start text-gray-300 hover:text-white hover:bg-gray-700"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Log Out
            </Button>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow pt-5 pb-4 overflow-y-auto" style={{backgroundColor: '#181b20', borderRight: '1px solid #2c313a'}}>
          <div className="flex items-center flex-shrink-0 px-4 mb-8">
            <div className="flex items-center">
              <div className="w-full flex items-center justify-center">
                  <img 
                   src="/Pag1_Principal.svg" 
                   alt="Logo da Empresa" 
                   className="w-full h-auto object-contain"
                   style={{ aspectRatio: '198.43/106.36' }}
                  />
                </div>
            </div>
          </div>
          
          <nav className="mt-8 flex-1 space-y-1 px-2">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    "group flex items-center px-2 py-2 text-sm font-medium rounded-md",
                    isActive
                      ? "text-white"
                      : "text-gray-300 hover:text-white"
                  )}
                  style={isActive ? {backgroundColor: '#1e3a8a'} : {}}
                  onMouseEnter={(e) => !isActive && (e.currentTarget.style.backgroundColor = '#2c313a')}
                  onMouseLeave={(e) => !isActive && (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <item.icon className="mr-3 h-5 w-5" />
                  {item.name}
                </Link>
              )
            })}
            
            {/* Menu de Páginas de Status */}
            <Link
              to="/paginas-status"
              className={cn(
                "group flex items-center px-2 py-2 text-sm font-medium rounded-md",
                location.pathname === '/paginas-status'
                  ? "text-white"
                  : "text-gray-300 hover:text-white"
              )}
              style={location.pathname === '/paginas-status' ? {backgroundColor: '#1e3a8a'} : {}}
              onMouseEnter={(e) => location.pathname !== '/paginas-status' && (e.currentTarget.style.backgroundColor = '#2c313a')}
              onMouseLeave={(e) => location.pathname !== '/paginas-status' && (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <ExternalLink className="mr-3 h-5 w-5" />
              Páginas de Status
            </Link>
          </nav>

          {/* Bottom Section */}
          <div className="mt-auto border-t border-gray-700 p-4">
            <Button
              variant="ghost"
              className="w-full justify-start text-gray-300 hover:text-white hover:bg-gray-700"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Log Out
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64 min-h-screen" style={{backgroundColor: '#14161a'}}>
        {/* Top bar */}
        <div className="sticky top-0 z-40 flex h-16 flex-shrink-0 items-center gap-x-4 px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8" style={{backgroundColor: '#14161a', borderBottom: '1px solid #2c313a'}}>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden text-gray-300 hover:text-white"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </Button>
          
          <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
            <div className="flex flex-1 items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                {navigation.find(item => item.href === location.pathname)?.name || 'Dashboard'}
              </h2>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="py-6" style={{backgroundColor: '#14161a'}}>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}