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

const defaultStats: DashboardStats = {
  totalReceived: 0,
  totalPending: 0,
  totalClients: 0,
  paidClients: 0,
  pendingClients: 0
}

const defaultChartData: ChartData[] = []

const ClientsContext = createContext<ClientsContextType | null>(null)

export function ClientsProvider({ children }: { children: ReactNode }) {
  const hookResult = useClientsHook()
  
  const clients = hookResult.clients
  const isLoading = hookResult.isLoading
  const error = hookResult.error
  const createClient = (hookResult as { createClient?: typeof hookResult.addClient }).createClient ?? hookResult.addClient
  const updateClient = hookResult.updateClient
  const deleteClient = hookResult.deleteClient
  const markAsPaid = hookResult.markAsPaid
  const getStats = hookResult.getStats
  const getChartData = hookResult.getChartData
  const refetch = hookResult.refetch

  const getStatsValue = (): DashboardStats => {
    return getStats ?? defaultStats
  }

  const getChartDataValue = (): ChartData[] => {
    return getChartData ?? defaultChartData
  }

  return (
    <ClientsContext.Provider value={{ 
      clients, 
      isLoading, 
      error,
      addClient: createClient ?? (async () => ({ success: false, error: 'Not available' })), 
      updateClient: updateClient ?? (async () => ({ success: false, error: 'Not available' })), 
      markAsPaid: markAsPaid ?? (async () => ({ success: false, error: 'Not available' })), 
      deleteClient: deleteClient ?? (async () => ({ success: false, error: 'Not available' })),
      getStats: getStatsValue,
      getChartData: getChartDataValue,
      refetch: refetch ?? (() => {})
    }}>
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