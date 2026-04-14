'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/contexts/auth-context'
import type { Payment } from '@/lib/types'

async function getClientAuthHeaders(): Promise<HeadersInit> {
  const response = await fetch('/api/auth/session', { credentials: 'include' });
  const data = await response.json();
  const session = data.session;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }

  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`
    headers['x-refresh-token'] = session.refresh_token || ''
  }

  return headers
}

export function usePayments(clientId?: string) {
  const { user } = useAuth()
  const [payments, setPayments] = useState<Payment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const initialized = useRef(false)

  const fetchPayments = useCallback(async (currentClientId: string) => {
    try {
      const headers = await getClientAuthHeaders()
      const response = await fetch(`/api/payments?clientId=${currentClientId}`, {
        headers,
        credentials: 'include',
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || 'Failed to fetch payments')
      }

      const result = await response.json()
      setPayments(result.data || [])
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
      const headers = await getClientAuthHeaders()
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          client_id: clientId,
          month: paymentMonth.toISOString().split('T')[0],
          paid,
          paid_at: paid ? new Date().toISOString() : null,
        }),
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || 'Failed to add payment')
      }

      const result = await response.json()
      setPayments(prev => [result.data, ...prev])
      return { success: true }
    } catch (error: any) {
      console.error('Error adding payment:', error)
      return { success: false, error: error.message || 'Erro ao adicionar pagamento' }
    }
  }, [clientId])

  const markAsPaid = useCallback(async (paymentId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const headers = await getClientAuthHeaders()
      const response = await fetch(`/api/payments/${paymentId}`, {
        method: 'PATCH',
        headers,
        credentials: 'include',
        body: JSON.stringify({ paid: true }),
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || 'Failed to mark as paid')
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
      const headers = await getClientAuthHeaders()
      const response = await fetch(`/api/payments/${paymentId}`, {
        method: 'PATCH',
        headers,
        credentials: 'include',
        body: JSON.stringify({ paid: false }),
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || 'Failed to mark as pending')
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
      const headers = await getClientAuthHeaders()
      const response = await fetch(`/api/payments/${paymentId}`, {
        method: 'DELETE',
        headers,
        credentials: 'include',
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || 'Failed to delete payment')
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
      const headers = await getClientAuthHeaders()
      const response = await fetch('/api/payments/all', {
        headers,
        credentials: 'include',
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || 'Failed to fetch all payments')
      }

      const result = await response.json()
      setPayments(result.data || [])
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
