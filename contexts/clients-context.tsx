'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type { Client, ClientFormData, PaymentStatus, DashboardStats, PaymentChartData } from '@/lib/types'
import { useClients as useClientsHook } from '@/hooks/use-clients'

interface ClientsContextType {
  clients: Client[]
  isLoading: boolean
  error: string | null
  addClient: (data: ClientFormData) => Promise<{ success: boolean; error?: string }>
  updateClient: (id: string, data: Partial<ClientFormData>) => Promise<{ success: boolean; error?: string }>
  markAsPaid: (id: string) => Promise<{ success: boolean; error?: string }>
  deleteClient: (id: string) => Promise<{ success: boolean; error?: string }>
  getStats: () => DashboardStats
  getChartData: () => PaymentChartData[]
  refetch: () => void
}

const ClientsContext = createContext<ClientsContextType | null>(null)

export function ClientsProvider({ children }: { children: ReactNode }) {
  const {
    clients,
    isLoading,
    error,
    addClient,
    updateClient,
    deleteClient,
    markAsPaid,
    getStats: getHookStats,
    refetch
  } = useClientsHook()

  const getStats = useCallback((): DashboardStats => {
    return getHookStats()
  }, [getHookStats])

  const getChartData = useCallback((): PaymentChartData[] => {
    const months = ['Nov', 'Dez', 'Jan', 'Fev', 'Mar', 'Abr']
    const paidClients = clients.filter(c => c.status === 'pago')
    const pendingClients = clients.filter(c => c.status === 'pendente')
    
    const baseReceived = paidClients.reduce((sum, c) => sum + c.monthly_price, 0)
    const basePending = pendingClients.reduce((sum, c) => sum + c.monthly_price, 0)
    
    return months.map((month, index) => ({
      month,
      received: Math.round(baseReceived * (0.7 + Math.random() * 0.6)),
      pending: Math.round(basePending * (0.5 + Math.random() * 0.5))
    }))
  }, [clients])

  return (
    <ClientsContext.Provider value={{ 
      clients, 
      isLoading, 
      error,
      addClient, 
      updateClient, 
      markAsPaid, 
      deleteClient,
      getStats,
      getChartData,
      refetch
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
