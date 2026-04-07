'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/auth-context'
import type { Payment } from '@/lib/types'

export function usePayments(clientId?: string) {
  const { user } = useAuth()
  const [payments, setPayments] = useState<Payment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const initialized = useRef(false)

  const fetchPayments = useCallback(async (currentClientId: string) => {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('client_id', currentClientId)
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
  }, [])

  useEffect(() => {
    if (!clientId || !user || initialized.current) {
      if (!clientId || !user) {
        setPayments([])
        setIsLoading(false)
      }
      return
    }

    initialized.current = true
    setIsLoading(true)
    setError(null)
    
    fetchPayments(clientId)
  }, [clientId, user, fetchPayments])

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
    refetch: () => clientId && fetchPayments(clientId)
  }
}

export function useAllPayments() {
  const { user } = useAuth()
  const [payments, setPayments] = useState<Payment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const initialized = useRef(false)

  const fetchAllPayments = useCallback(async (currentUserId: string) => {
    try {
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', currentUserId)

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
  }, [])

  useEffect(() => {
    if (!user || initialized.current) {
      if (!user) {
        setPayments([])
        setIsLoading(false)
      }
      return
    }

    initialized.current = true
    setIsLoading(true)
    setError(null)
    
    fetchAllPayments(user.id)
  }, [user, fetchAllPayments])

  return {
    payments,
    isLoading,
    error,
    refetch: () => user && fetchAllPayments(user.id)
  }
}
