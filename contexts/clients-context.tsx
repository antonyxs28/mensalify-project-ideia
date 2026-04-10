'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { ClientWithStatus, ClientFormData, DashboardStats, ChartData } from '@/lib/types'
import { useClients as useClientsHook } from '@/hooks/use-clients'

interface ClientsContextType {
  clients: ClientWithStatus[]
  isLoading: boolean
  error: string | null
  addClient: (data: ClientFormData) => Promise<{ success: boolean; error?: string }>
  updateClient: (id: string, data: Partial<ClientFormData>) => Promise<{ success: boolean; error?: string }>
  markAsPaid: (id: string) => Promise<{ success: boolean; error?: string }>
  deleteClient: (id: string) => Promise<{ success: boolean; error?: string }>
  getStats: () => DashboardStats
  getChartData: () => ChartData[]
  refetch: () => void
}

const ClientsContext = createContext<ClientsContextType | null>(null)

export function ClientsProvider({ children }: { children: ReactNode }) {
  const hookResult = useClientsHook()
  
  return (
    <ClientsContext.Provider value={hookResult}>
      {children}
    </ClientsContext.Provider>
  )
}

export function useClients() {
  const context = useContext(ClientsContext)
  if (!context) {
    throw new Error('useClients must be used within a ClientsProvider')
  }
  return context
}