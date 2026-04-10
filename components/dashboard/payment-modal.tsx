'use client'

import { useState, useEffect } from 'react'
import { useClientCycles, useAddPayment, type BillingCycle } from '@/hooks/use-billing-cycles'
import { formatCurrency } from '@/lib/validation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

const statusConfig = {
  paid: { label: 'Pago', className: 'bg-success/10 text-success border-success/20' },
  pending: { label: 'Pendente', className: 'bg-muted text-muted-foreground border-border' },
  partial: { label: 'Parcial', className: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  overdue: { label: 'Vencido', className: 'bg-destructive/10 text-destructive border-destructive/20' },
}

const monthNames = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

interface PaymentModalProps {
  cycle: BillingCycle | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function PaymentModal({ cycle, isOpen, onClose, onSuccess }: PaymentModalProps) {
  const [amount, setAmount] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { addPayment } = useAddPayment()

  useEffect(() => {
    if (cycle) {
      const remaining = cycle.expected_amount - cycle.paid_amount
      setAmount(remaining.toFixed(2))
    }
  }, [cycle])

  const handleSubmit = async () => {
    if (!cycle || !amount) return
    
    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) return

    setIsSubmitting(true)
    const result = await addPayment(cycle.id, parsedAmount)
    setIsSubmitting(false)

    if (result.success) {
      onSuccess()
      onClose()
    }
  }

  if (!cycle) return null

  const remaining = cycle.expected_amount - cycle.paid_amount
  const status = statusConfig[cycle.status]

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar Pagamento</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="rounded-lg bg-muted p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Mês</span>
              <Badge className={status.className}>{status.label}</Badge>
            </div>
            <p className="text-lg font-medium">
              {monthNames[cycle.cycle_month - 1]} {cycle.cycle_year}
            </p>
            <p className="text-sm text-muted-foreground">
              Vencimento: {new Date(cycle.due_date).toLocaleDateString('pt-BR')}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Valor esperado</span>
              <p className="font-medium">{formatCurrency(cycle.expected_amount)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Já pago</span>
              <p className="font-medium text-success">{formatCurrency(cycle.paid_amount)}</p>
            </div>
          </div>

          <div>
            <Label htmlFor="amount">Valor do pagamento (R$)</Label>
            <Input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              step="0.01"
              min="0"
              max={remaining}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Restante: {formatCurrency(remaining)}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || !amount || parseFloat(amount) <= 0}
          >
            {isSubmitting ? 'Salvando...' : 'Confirmar Pagamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}