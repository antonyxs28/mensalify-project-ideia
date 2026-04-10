'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Mail, Phone, Calendar, Loader2 } from 'lucide-react'
import { useRouter, useParams } from 'next/navigation'
import { formatCurrency } from '@/lib/validation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ClientCyclesTimeline } from '@/components/dashboard/client-cycles-timeline'
import { PaymentModal } from '@/components/dashboard/payment-modal'
import type { ClientWithStatus } from '@/lib/types'
import { supabase } from '@/lib/supabase/client'

async function getClientAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession()
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`
    headers['x-refresh-token'] = session.refresh_token || ''
  }
  return headers
}

export default function ClientDetailPage() {
  const router = useRouter()
  const params = useParams()
  const clientId = params.id as string
  
  const [client, setClient] = useState<ClientWithStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)

  useEffect(() => {
    async function fetchClient() {
      if (!clientId) return
      
      console.log('[ClientDetail] Fetching client, clientId:', clientId)
      
      try {
        setIsLoading(true)
        setError(null)
        
        const headers = await getClientAuthHeaders()
        const response = await fetch(`/api/clients/${clientId}`, {
          headers,
          credentials: 'include',
        })
        
        console.log('[ClientDetail] Client API response status:', response.status)
        
        if (!response.ok) {
          throw new Error('Client not found')
        }
        
        const result = await response.json()
        console.log('[ClientDetail] Client API result:', result)
        
        const clientData = result.data
        
        if (clientData) {
          const currentMonth = new Date()
          const monthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`
          const monthDb = `${monthKey}-01`
          
          const { data: payment } = await supabase
            .from('payments')
            .select('paid')
            .eq('client_id', clientId)
            .eq('month', monthDb)
            .maybeSingle()
          
          console.log('[ClientDetail] Payment for current month:', payment)
          
          setClient({
            ...clientData,
            status: payment?.paid ? 'pago' : 'pendente',
            monthKey,
          } as ClientWithStatus)
          console.log('[ClientDetail] Client state set successfully')
        }
      } catch (err) {
        console.error('[ClientDetail] Error fetching client:', err)
        setError(err instanceof Error ? err.message : 'Failed to load client')
      } finally {
        setIsLoading(false)
        console.log('[ClientDetail] Loading finished')
      }
    }
    
    fetchClient()
  }, [clientId])

  const handlePayClick = (cycleId: string) => {
    setSelectedCycleId(cycleId)
    setIsPaymentModalOpen(true)
  }

  const handlePaymentSuccess = () => {
    setIsPaymentModalOpen(false)
    setSelectedCycleId(null)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !client) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-lg font-medium">Cliente não encontrado</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
      >
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      </motion.div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">
            {client.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{client.name}</h1>
            <p className="text-muted-foreground">
              {formatCurrency(client.monthly_price)}/mês
            </p>
          </div>
        </div>
        <Badge
          className={
            client.status === 'pago'
              ? 'bg-success/20 text-success'
              : 'bg-destructive/20 text-destructive'
          }
        >
          {client.status === 'pago' ? 'Pago' : 'Pendente'}
        </Badge>
      </motion.div>

      {/* Client Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Informações do Cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {client.email && (
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{client.email}</p>
                  </div>
                </div>
              )}
              {client.phone && (
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Telefone</p>
                    <p className="font-medium">{client.phone}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Criado em</p>
                  <p className="font-medium">
                    {new Date(client.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Billing Cycles Timeline */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <ClientCyclesTimeline
          clientId={client.id}
          clientName={client.name}
          monthlyPrice={client.monthly_price}
          dueDay={client.due_day || 5}
        />
      </motion.div>
    </div>
  )
}