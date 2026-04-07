'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/auth-context'
import type { ClientWithStatus, ClientFormData, PaymentStatus, DashboardStats, Payment } from '@/lib/types'

interface ChartData {
  month: string
  monthKey: string
  received: number
  expected: number
}

export function useClients() {
  const { user } = useAuth()
  const [clients, setClients] = useState<ClientWithStatus[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const initialized = useRef(false)

  const getCurrentMonth = useCallback(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  }, [])

  const getMonthKey = useCallback((date: Date | string) => {
    const d = new Date(date)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }, [])

  const fetchPaymentStatus = useCallback(async (clientIds: string[]) => {
    if (clientIds.length === 0) return {}

    const currentMonth = getCurrentMonth()
    const startOfMonth = currentMonth.toISOString().split('T')[0]
    const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
      .toISOString().split('T')[0]

    const { data: payments, error } = await supabase
      .from('payments')
      .select('client_id, paid, paid_at')
      .in('client_id', clientIds)
      .gte('month', startOfMonth)
      .lte('month', endOfMonth)

    if (error) {
      console.error('Error fetching payment status:', error)
      return {}
    }

    const statusMap: Record<string, { paid: boolean; paid_at: string | null }> = {}
    payments?.forEach(payment => {
      statusMap[payment.client_id] = { paid: payment.paid, paid_at: payment.paid_at }
    })

    return statusMap
  }, [getCurrentMonth])

  const fetchAllPayments = useCallback(async (clientIds: string[]) => {
    if (clientIds.length === 0) return []

    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .in('client_id', clientIds)
      .order('month', { ascending: false })

    if (error) {
      console.error('Error fetching all payments:', error)
      return []
    }

    return data || []
  }, [])

  const fetchClients = useCallback(async (currentUserId: string) => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: false })

      if (error) {
        throw error
      }

      const clientIds = data?.map(c => c.id) || []
      const paymentStatus = await fetchPaymentStatus(clientIds)
      const allPayments = await fetchAllPayments(clientIds)
      
      setPayments(allPayments)

      const clientsWithStatus: ClientWithStatus[] = (data || []).map(client => ({
        ...client,
        status: paymentStatus[client.id]?.paid ? 'pago' : 'pendente',
        monthly_price: client.monthly_price,
        monthKey: getMonthKey(client.created_at),
        dueDate: paymentStatus[client.id]?.paid_at 
          ? new Date(paymentStatus[client.id].paid_at!) 
          : new Date(client.created_at)
      }))

      setClients(clientsWithStatus)
    } catch (error: any) {
      console.error('Error fetching clients:', error)
      setError(error.message || 'Failed to load clients')
    } finally {
      setIsLoading(false)
    }
  }, [fetchPaymentStatus, fetchAllPayments])

  useEffect(() => {
    if (!user || initialized.current) {
      if (!user) {
        setClients([])
        setPayments([])
        setIsLoading(false)
      }
      return
    }

    initialized.current = true
    setIsLoading(true)
    setError(null)
    
    fetchClients(user.id)
  }, [user, fetchClients])

  const getChartData = useCallback((): ChartData[] => {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()
    
    const months = []
    const monthLabels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    
    for (let i = 0; i < 6; i++) {
      const monthIndex = (currentMonth - 5 + i + 12) % 12
      const yearOffset = currentMonth - 5 + i < 0 ? -1 : 0
      const year = currentYear + yearOffset
      months.push({
        label: monthLabels[monthIndex],
        key: `${year}-${String(monthIndex + 1).padStart(2, '0')}`
      })
    }

    const paidClientsByMonth: Record<string, Set<string>> = {}
    payments.forEach(payment => {
      if (payment.paid) {
        const monthKey = getMonthKey(payment.month)
        if (!paidClientsByMonth[monthKey]) {
          paidClientsByMonth[monthKey] = new Set()
        }
        paidClientsByMonth[monthKey].add(payment.client_id)
      }
    })

    return months.map(({ label, key }) => {
      const paidClientIds = paidClientsByMonth[key] || new Set<string>()
      
      let received = 0
      let expected = 0
      
      clients.forEach(client => {
        if (client.monthKey !== key) return
        
        if (paidClientIds.has(client.id)) {
          received += client.monthly_price
        } else {
          expected += client.monthly_price
        }
      })

      return {
        month: label,
        monthKey: key,
        received,
        expected
      }
    })
  }, [clients, payments, getMonthKey])

  const addClient = useCallback(async (data: ClientFormData): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      return { success: false, error: 'User not authenticated. Please log in.' }
    }

    try {
      const insertData = {
        user_id: user.id,
        name: data.name.trim(),
        email: data.email?.trim() || null,
        phone: data.phone?.trim() || null,
        monthly_price: Number(data.monthly_price)
      }

      console.log('Inserting client with data:', insertData)

      const { error } = await supabase
        .from('clients')
        .insert(insertData)

      if (error) {
        console.error('Supabase insert error:', error)
        return { success: false, error: error.message }
      }

      fetchClients(user.id)
      return { success: true }
    } catch (error: any) {
      console.error('Error adding client:', error)
      return { success: false, error: error.message || 'Failed to add client' }
    }
  }, [user, fetchClients])

  const updateClient = useCallback(async (
    id: string, 
    data: Partial<ClientFormData>
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const updateData: Record<string, any> = {}
      if (data.name) updateData.name = data.name.trim()
      if (data.email !== undefined) updateData.email = data.email?.trim() || null
      if (data.phone !== undefined) updateData.phone = data.phone?.trim() || null
      if (data.monthly_price !== undefined) updateData.monthly_price = data.monthly_price
      updateData.updated_at = new Date().toISOString()

      const { error } = await supabase
        .from('clients')
        .update(updateData)
        .eq('id', id)

      if (error) {
        throw error
      }

      setClients(prev => prev.map(client => {
        if (client.id === id) {
          return { ...client, ...updateData }
        }
        return client
      }))

      return { success: true }
    } catch (error: any) {
      console.error('Error updating client:', error)
      return { success: false, error: error.message || 'Failed to update client' }
    }
  }, [])

  const deleteClient = useCallback(async (id: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', id)

      if (error) {
        throw error
      }

      setClients(prev => prev.filter(client => client.id !== id))
      return { success: true }
    } catch (error: any) {
      console.error('Error deleting client:', error)
      return { success: false, error: error.message || 'Failed to delete client' }
    }
  }, [])

  const markAsPaid = useCallback(async (id: string): Promise<{ success: boolean; error?: string }> => {
    const client = clients.find(c => c.id === id)
    if (!client) {
      return { success: false, error: 'Client not found' }
    }

    const currentMonth = getCurrentMonth()
    const monthDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)

    try {
      const { error } = await supabase
        .from('payments')
        .upsert({
          client_id: id,
          month: monthDate.toISOString().split('T')[0],
          paid: true,
          paid_at: new Date().toISOString()
        }, {
          onConflict: 'client_id,month'
        })

      if (error) {
        throw error
      }

      setClients(prev => prev.map(c => {
        if (c.id === id) {
          return {
            ...c,
            status: 'pago' as PaymentStatus,
            dueDate: new Date()
          }
        }
        return c
      }))

      return { success: true }
    } catch (error: any) {
      console.error('Error marking as paid:', error)
      return { success: false, error: error.message || 'Failed to mark as paid' }
    }
  }, [clients, getCurrentMonth])

  const getStats = useCallback((): DashboardStats => {
    const paidClients = clients.filter(c => c.status === 'pago')
    const pendingClients = clients.filter(c => c.status === 'pendente')

    return {
      totalReceived: paidClients.reduce((sum, c) => sum + c.monthly_price, 0),
      totalPending: pendingClients.reduce((sum, c) => sum + c.monthly_price, 0),
      totalClients: clients.length,
      paidClients: paidClients.length,
      pendingClients: pendingClients.length
    }
  }, [clients])

  return {
    clients,
    isLoading,
    error,
    addClient,
    updateClient,
    deleteClient,
    markAsPaid,
    getStats,
    getChartData,
    refetch: () => user && fetchClients(user.id)
  }
}
