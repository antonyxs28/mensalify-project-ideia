'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  LayoutDashboard, 
  Users, 
  BarChart3, 
  Settings, 
  Menu, 
  X, 
  LogOut,
  ChevronLeft
} from 'lucide-react'

import { useAuth } from '@/contexts/auth-context'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/clients', label: 'Clientes', icon: Users },
  { href: '/dashboard/reports', label: 'Relatórios', icon: BarChart3 },
  { href: '/dashboard/settings', label: 'Configurações', icon: Settings },
]

interface SidebarProps {
  isCollapsed: boolean
  onCollapse: (collapsed: boolean) => void
}

export function Sidebar({ isCollapsed, onCollapse }: SidebarProps) {
  const pathname = usePathname()
  const { user, logout } = useAuth()

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 80 : 256 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="fixed left-0 top-0 z-40 hidden h-screen border-r border-sidebar-border bg-sidebar lg:flex lg:flex-col"
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
        <AnimatePresence mode="wait">
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Link href="/dashboard" className="text-xl font-bold text-sidebar-foreground">
                Zenvy
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onCollapse(!isCollapsed)}
          className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent"
          aria-label={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          <ChevronLeft className={cn('h-4 w-4 transition-transform', isCollapsed && 'rotate-180')} />
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive 
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground' 
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
              title={isCollapsed ? item.label : undefined}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <AnimatePresence mode="wait">
                {!isCollapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.15 }}
                    className="whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          )
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-sidebar-border p-3">
        <div className={cn('flex items-center gap-3 rounded-lg px-3 py-2', !isCollapsed && 'mb-2')}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-sm font-medium text-sidebar-accent-foreground">
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <AnimatePresence mode="wait">
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.15 }}
                className="flex-1 overflow-hidden"
              >
                <p className="truncate text-sm font-medium text-sidebar-foreground">
                  {user?.name || 'Usuário'}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {user?.email || 'email@example.com'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <Button
          variant="ghost"
          onClick={logout}
          className={cn(
            'w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            isCollapsed && 'justify-center px-0'
          )}
          title={isCollapsed ? 'Sair' : undefined}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <AnimatePresence mode="wait">
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.15 }}
              >
                Sair
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </div>
    </motion.aside>
  )
}

// Mobile sidebar
export function MobileSidebar() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  const { user, logout } = useAuth()

  return (
    <>
      {/* Mobile header */}
      <header className="fixed left-0 right-0 top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-background px-4 lg:hidden">
        <Link href="/dashboard" className="text-lg font-bold text-foreground">
          Zenvy
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(true)}
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </header>

      {/* Mobile overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm lg:hidden"
              onClick={() => setIsOpen(false)}
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="fixed left-0 top-0 z-50 h-screen w-72 border-r border-border bg-sidebar lg:hidden"
            >
              {/* Header */}
              <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
                <span className="text-lg font-bold text-sidebar-foreground">Zenvy</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsOpen(false)}
                  className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent"
                  aria-label="Fechar menu"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Navigation */}
              <nav className="flex-1 space-y-1 p-3">
                {navItems.map((item) => {
                  const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsOpen(false)}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                        isActive 
                          ? 'bg-sidebar-primary text-sidebar-primary-foreground' 
                          : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                      {item.label}
                    </Link>
                  )
                })}
              </nav>

              {/* User section */}
              <div className="border-t border-sidebar-border p-3">
                <div className="flex items-center gap-3 rounded-lg px-3 py-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-accent text-sm font-medium text-sidebar-accent-foreground">
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="truncate text-sm font-medium text-sidebar-foreground">
                      {user?.name || 'Usuário'}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {user?.email || 'email@example.com'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setIsOpen(false)
                    logout()
                  }}
                  className="mt-2 w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                >
                  <LogOut className="h-4 w-4" />
                  Sair
                </Button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
