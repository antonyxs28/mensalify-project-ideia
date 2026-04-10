'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Client, ClientFormData, DashboardStats, ChartData, PaymentStatus } from '@/lib/types'

interface ClientWithStatus extends Client {
  status: PaymentStatus
  monthKey: string
  dueDate?: Date
}

interface UseClientsOptions {
  enabled?: boolean
}

const getMonthKey = (date: Date = new Date()): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

const getStatusForMonth = (payments: { month: string; paid: boolean }[], monthKey: string): PaymentStatus => {
  const payment = payments.find(p => p.month === monthKey)
  return payment?.paid ? 'pago' : 'pendente'
}

export function useClients(options: UseClientsOptions = {}) {
  const { enabled = true } = options

  const [clients, setClients] = useState<ClientWithStatus[]>([])
  const [allPayments, setAllPayments] = useState<Map<string, { month: string; paid: boolean }[]>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchClients = useCallback(async () => {
    if (!enabled) {
      setClients([])
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch('/api/clients')

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to fetch clients')
      }

      const data = await response.json()
      const clientsData = data.data || []
      
      const paymentsMap = new Map<string, { month: string; paid: boolean }[]>()
      clientsData.forEach((client: Client) => {
        paymentsMap.set(client.id, [])
      })
      setAllPayments(paymentsMap)
      
      const currentMonth = getMonthKey()
      const clientsWithStatus = clientsData.map((client: Client) => ({
        ...client,
        status: 'pendente' as PaymentStatus,
        monthKey: currentMonth
      }))
      
      setClients(clientsWithStatus)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load clients'
      setError(message)
      setClients([])
    } finally {
      setIsLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    fetchClients()
  }, [fetchClients])

  const createClient = useCallback(async (data: ClientFormData): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          phone: data.phone,
          monthlyPrice: data.monthly_price
        })
      })

      if (!response.ok) {
        const responseData = await response.json()
        return { success: false, error: responseData.error || 'Failed to create client' }
      }

      await fetchClients()
      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create client'
      return { success: false, error: message }
    }
  }, [fetchClients])

  const updateClient = useCallback(async (
    id: string,
    data: Partial<ClientFormData>
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`/api/clients/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          phone: data.phone,
          monthlyPrice: data.monthly_price
        })
      })

      if (!response.ok) {
        const responseData = await response.json()
        return { success: false, error: responseData.error || 'Failed to update client' }
      }

      await fetchClients()
      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update client'
      return { success: false, error: message }
    }
  }, [fetchClients])

  const deleteClient = useCallback(async (id: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`/api/clients/${id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const responseData = await response.json()
        return { success: false, error: responseData.error || 'Failed to delete client' }
      }

      setClients(prev => prev.filter(client => client.id !== id))
      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete client'
      return { success: false, error: message }
    }
  }, [])

  const markAsPaid = useCallback(async (id: string): Promise<{ success: boolean; error?: string }> => {
    const currentMonth = getMonthKey()
    
    try {
      const response = await fetch(`/api/clients/${id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: currentMonth,
          paid: true
        })
      })

      if (!response.ok) {
        const responseData = await response.json()
        return { success: false, error: responseData.error || 'Failed to mark as paid' }
      }

      setClients(prev => prev.map(client => 
        client.id === id ? { ...client, status: 'pago' as PaymentStatus } : client
      ))
      
      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to mark as paid'
      return { success: false, error: message }
    }
  }, [])

  const getStats = useMemo((): DashboardStats => {
    const totalClients = clients.length
    const paidClients = clients.filter(c => c.status === 'pago').length
    const pendingClients = totalClients - paidClients
    
    const totalExpected = clients.reduce((sum, c) => sum + (c.monthly_price || 0), 0)
    const totalReceived = clients
      .filter(c => c.status === 'pago')
      .reduce((sum, c) => sum + (c.monthly_price || 0), 0)

    return {
      totalReceived,
      totalPending: totalExpected - totalReceived,
      totalClients,
      paidClients,
      pendingClients
    }
  }, [clients])

  const getChartData = useMemo((): ChartData[] => {
    const months: ChartData[] = []
    const now = new Date()
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthKey = getMonthKey(date)
      const monthLabel = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
      
      const monthClients = clients
      const expected = monthClients.reduce((sum, c) => sum + (c.monthly_price || 0), 0)
      const received = monthClients
        .filter(c => c.monthKey === monthKey && c.status === 'pago')
        .reduce((sum, c) => sum + (c.monthly_price || 0), 0)
      
      months.push({
        month: monthLabel,
        monthKey,
        received,
        expected
      })
    }
    
    return months
  }, [clients])

  const refetch = useCallback(() => {
    return fetchClients()
  }, [fetchClients])

  return {
    clients,
    isLoading,
    error,
    addClient: createClient,
    updateClient,
    deleteClient,
    markAsPaid,
    getStats,
    getChartData,
    refetch
  }
}