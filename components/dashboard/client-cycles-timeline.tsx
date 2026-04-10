'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Calendar, CheckCircle2, Clock, AlertCircle, Plus } from 'lucide-react'
import { useClientCycles, useAddPayment, type BillingCycle } from '@/hooks/use-billing-cycles'
import { formatCurrency } from '@/lib/validation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'

const statusConfig = {
  paid: { 
    label: 'Pago', 
    icon: CheckCircle2, 
    className: 'bg-success/10 text-success border-success/20' 
  },
  pending: { 
    label: 'Pendente', 
    icon: Clock, 
    className: 'bg-muted text-muted-foreground border-border' 
  },
  partial: { 
    label: 'Parcial', 
    icon: Clock, 
    className: 'bg-amber-500/10 text-amber-500 border-amber-500/20' 
  },
  overdue: { 
    label: 'Vencido', 
    icon: AlertCircle, 
    className: 'bg-destructive/10 text-destructive border-destructive/20' 
  },
}

const monthNames = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

function CycleCard({ 
  cycle, 
  onPay,
  isProcessing 
}: { 
  cycle: BillingCycle
  onPay: () => void
  isProcessing: boolean
}) {
  const status = statusConfig[cycle.status]
  const StatusIcon = status.icon
  const progress = cycle.expected_amount > 0 
    ? (cycle.paid_amount / cycle.expected_amount) * 100 
    : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative flex items-start gap-4 rounded-lg border p-4 transition-colors hover:bg-accent/50"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
        <Calendar className="h-5 w-5 text-primary" />
      </div>
      
      <div className="flex-1 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">
              {monthNames[cycle.cycle_month - 1]} {cycle.cycle_year}
            </p>
            <p className="text-sm text-muted-foreground">
              Vencimento: {new Date(cycle.due_date).toLocaleDateString('pt-BR')}
            </p>
          </div>
          <Badge className={status.className}>
            <StatusIcon className="mr-1 h-3 w-3" />
            {status.label}
          </Badge>
        </div>

        <div className="flex items-center gap-4 text-sm">
          <div className="flex-1">
            <div className="flex justify-between mb-1">
              <span className="text-muted-foreground">Progresso</span>
              <span>{formatCurrency(cycle.paid_amount)} / {formatCurrency(cycle.expected_amount)}</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <motion.div 
                className="h-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
        </div>

        {cycle.status !== 'paid' && (
          <Button 
            size="sm" 
            onClick={onPay}
            disabled={isProcessing}
            className="mt-2"
          >
            <Plus className="mr-1 h-4 w-4" />
            Registrar Pagamento
          </Button>
        )}
      </div>
    </motion.div>
  )
}

function LoadingState() {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex gap-4 p-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-2 w-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-medium">Nenhum ciclo de cobrança</h3>
      <p className="text-sm text-muted-foreground mt-1">
        Os ciclos de cobrança serão criados automaticamente
      </p>
    </div>
  )
}

export function ClientCyclesTimeline({ 
  clientId,
  clientName,
  monthlyPrice 
}: { 
  clientId: string
  clientName: string
  monthlyPrice: number
}) {
  const { cycles, isLoading, error, refetch } = useClientCycles(clientId)
  const { addPayment, isLoading: isAddingPayment } = useAddPayment()
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handlePayClick = (cycleId: string) => {
    setSelectedCycleId(cycleId)
    const cycle = cycles.find(c => c.id === cycleId)
    if (cycle) {
      setPaymentAmount((cycle.expected_amount - cycle.paid_amount).toString())
    }
    setIsModalOpen(true)
  }

  const handleSubmitPayment = async () => {
    if (!selectedCycleId || !paymentAmount) return
    
    const amount = parseFloat(paymentAmount)
    if (isNaN(amount) || amount <= 0) return

    const result = await addPayment(selectedCycleId, amount)
    if (result.success) {
      setIsModalOpen(false)
      setSelectedCycleId(null)
      refetch()
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ciclos de Cobrança</CardTitle>
        </CardHeader>
        <CardContent>
          <LoadingState />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <p className="text-destructive">Erro ao carregar ciclos: {error}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Ciclos de Cobrança</span>
          <Badge variant="outline">
            {monthlyPrice}/mês
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {cycles.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-3">
            {cycles.map((cycle) => (
              <CycleCard
                key={cycle.id}
                cycle={cycle}
                onPay={() => handlePayClick(cycle.id)}
                isProcessing={isAddingPayment}
              />
            ))}
          </div>
        )}
      </CardContent>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Registrar Pagamento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Valor (R$)</label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="mt-1 w-full rounded-md border p-2"
                  step="0.01"
                  min="0"
                />
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={handleSubmitPayment}
                  disabled={isAddingPayment || !paymentAmount}
                  className="flex-1"
                >
                  {isAddingPayment ? 'Salvando...' : 'Confirmar'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </Card>
  )
}