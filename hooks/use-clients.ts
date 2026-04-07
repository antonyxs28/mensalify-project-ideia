'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/auth-context'
import type { ClientWithStatus, ClientFormData, Payment, PaymentStatus, DashboardStats } from '@/lib/types'

export function useClients() {
  const { user } = useAuth()
  const [clients, setClients] = useState<ClientWithStatus[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const getCurrentMonth = useCallback(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
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

  const fetchClients = useCallback(async () => {
    if (!user) {
      setClients([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        throw error
      }

      const clientIds = data?.map(c => c.id) || []
      const paymentStatus = await fetchPaymentStatus(clientIds)

      const clientsWithStatus: ClientWithStatus[] = (data || []).map(client => ({
        ...client,
        status: paymentStatus[client.id]?.paid ? 'pago' : 'pendente',
        monthly_price: client.monthly_price,
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
  }, [user, fetchPaymentStatus])

  useEffect(() => {
    fetchClients()
  }, [fetchClients])

  const addClient = useCallback(async (data: ClientFormData): Promise<{ success: boolean; error?: string }> => {
    const { data: { user: authUser } } = await supabase.auth.getUser()
    
    if (!authUser) {
      return { success: false, error: 'User not authenticated. Please log in.' }
    }

    try {
      const { error } = await supabase
        .from('clients')
        .insert({
          user_id: authUser.id,
          name: data.name.trim(),
          email: data.email?.trim() || null,
          phone: data.phone?.trim() || null,
          monthly_price: data.monthly_price
        })

      if (error) {
        console.error('Supabase error:', error)
        throw error
      }

      return { success: true }
    } catch (error: any) {
      console.error('Error adding client:', error)
      return { success: false, error: error.message || 'Failed to add client' }
    }
  }, [])

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
    refetch: fetchClients
  }
}
