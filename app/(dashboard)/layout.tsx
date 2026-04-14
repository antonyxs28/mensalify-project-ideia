'use client'

import { useState, useEffect } from 'react'

import { ProtectedRoute } from '@/components/protected-route'
import { Sidebar, MobileSidebar } from '@/components/dashboard/sidebar'
import { cn } from '@/lib/utils'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        {/* Desktop Sidebar */}
        <Sidebar isCollapsed={isCollapsed} onCollapse={setIsCollapsed} />
        
        {/* Mobile Sidebar */}
        <MobileSidebar />
        
        {/* Main Content */}
        <main
          className={cn(
            'min-h-screen pt-14 transition-[margin-left] duration-200 ease-in-out lg:pt-0',
            mounted ? (isCollapsed ? 'lg:ml-20' : 'lg:ml-64') : 'lg:ml-64'
          )}
        >
          <div className="mx-auto max-w-7xl p-4 md:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  )
}
