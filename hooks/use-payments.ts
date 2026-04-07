'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/auth-context'
import type { Payment, Client } from '@/lib/types'

export function usePayments(clientId?: string) {
  const { user } = useAuth()
  const [payments, setPayments] = useState<Payment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPayments = useCallback(async () => {
    if (!user || !clientId) {
      setPayments([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('client_id', clientId)
        .order('month', { ascending: false })

      if (error) {
        throw error
      }

      setPayments(data || [])
    } catch (error: any) {
      console.error('Error fetching payments:', error)
      setError(error.message || 'Erro ao carregar pagamentos')
    } finally {
      setIsLoading(false)
    }
  }, [user, clientId])

  useEffect(() => {
    fetchPayments()
  }, [fetchPayments])

  const addPayment = useCallback(async (
    paymentMonth: Date,
    paid: boolean = false
  ): Promise<{ success: boolean; error?: string }> => {
    if (!clientId) {
      return { success: false, error: 'ID do cliente não fornecido' }
    }

    try {
      const { data, error } = await supabase
        .from('payments')
        .insert({
          client_id: clientId,
          month: paymentMonth.toISOString().split('T')[0],
          paid,
          paid_at: paid ? new Date().toISOString() : null
        })
        .select()
        .single()

      if (error) {
        throw error
      }

      setPayments(prev => [data, ...prev])
      return { success: true }
    } catch (error: any) {
      console.error('Error adding payment:', error)
      return { success: false, error: error.message || 'Erro ao adicionar pagamento' }
    }
  }, [clientId])

  const markAsPaid = useCallback(async (paymentId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase
        .from('payments')
        .update({
          paid: true,
          paid_at: new Date().toISOString()
        })
        .eq('id', paymentId)

      if (error) {
        throw error
      }

      setPayments(prev => prev.map(payment => {
        if (payment.id === paymentId) {
          return {
            ...payment,
            paid: true,
            paid_at: new Date().toISOString()
          }
        }
        return payment
      }))

      return { success: true }
    } catch (error: any) {
      console.error('Error marking as paid:', error)
      return { success: false, error: error.message || 'Erro ao marcar como pago' }
    }
  }, [])

  const markAsPending = useCallback(async (paymentId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase
        .from('payments')
        .update({
          paid: false,
          paid_at: null
        })
        .eq('id', paymentId)

      if (error) {
        throw error
      }

      setPayments(prev => prev.map(payment => {
        if (payment.id === paymentId) {
          return {
            ...payment,
            paid: false,
            paid_at: null
          }
        }
        return payment
      }))

      return { success: true }
    } catch (error: any) {
      console.error('Error marking as pending:', error)
      return { success: false, error: error.message || 'Erro ao marcar como pendente' }
    }
  }, [])

  const deletePayment = useCallback(async (paymentId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase
        .from('payments')
        .delete()
        .eq('id', paymentId)

      if (error) {
        throw error
      }

      setPayments(prev => prev.filter(payment => payment.id !== paymentId))
      return { success: true }
    } catch (error: any) {
      console.error('Error deleting payment:', error)
      return { success: false, error: error.message || 'Erro ao excluir pagamento' }
    }
  }, [])

  return {
    payments,
    isLoading,
    error,
    addPayment,
    markAsPaid,
    markAsPending,
    deletePayment,
    refetch: fetchPayments
  }
}

export function useAllPayments() {
  const { user } = useAuth()
  const [payments, setPayments] = useState<Payment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAllPayments = useCallback(async () => {
    if (!user) {
      setPayments([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', user.id)

      if (clientsError) {
        throw clientsError
      }

      if (!clients || clients.length === 0) {
        setPayments([])
        setIsLoading(false)
        return
      }

      const clientIds = clients.map(c => c.id)

      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .in('client_id', clientIds)
        .order('month', { ascending: false })

      if (error) {
        throw error
      }

      setPayments(data || [])
    } catch (error: any) {
      console.error('Error fetching all payments:', error)
      setError(error.message || 'Erro ao carregar pagamentos')
    } finally {
      setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchAllPayments()
  }, [fetchAllPayments])

  return {
    payments,
    isLoading,
    error,
    refetch: fetchAllPayments
  }
}
