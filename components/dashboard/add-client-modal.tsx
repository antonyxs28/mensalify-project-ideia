'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Loader2, User, Mail, Phone, DollarSign, Calendar, Repeat } from 'lucide-react'
import { toast } from 'sonner'

import { useClients } from '@/hooks/use-clients'
import { isValidEmail, isValidName, isValidMonetaryValue, sanitizeInput } from '@/lib/validation'
import type { ClientWithStatus } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FieldGroup, Field, FieldLabel, FieldError } from '@/components/ui/field'

interface AddClientModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  editingClient?: ClientWithStatus | null
}

export function AddClientModal({ isOpen, onClose, onSuccess, editingClient }: AddClientModalProps) {
  const { addClient, updateClient } = useClients()
  
  const [name, setName] = useState(editingClient?.name || '')
  const [email, setEmail] = useState(editingClient?.email || '')
  const [phone, setPhone] = useState(editingClient?.phone || '')
  const [monthlyPrice, setMonthlyPrice] = useState(
    editingClient?.monthly_price?.toString() || ''
  )
  const [dueDay, setDueDay] = useState(
    (editingClient as any)?.due_day?.toString() || '5'
  )
  const [billingType, setBillingType] = useState<'monthly' | 'weekly' | 'yearly'>(
    (editingClient as any)?.billing_type || 'monthly'
  )
  const [numberOfCycles, setNumberOfCycles] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<{
    name?: string
    email?: string
    phone?: string
    monthlyPrice?: string
    dueDay?: string
    billingType?: string
    numberOfCycles?: string
  }>({})

  const isEditing = !!editingClient

  useEffect(() => {
    if (editingClient) {
      setName(editingClient.name)
      setEmail(editingClient.email || '')
      setPhone(editingClient.phone || '')
      setMonthlyPrice(editingClient.monthly_price?.toString() || '')
      setDueDay((editingClient as any)?.due_day?.toString() || '5')
      setBillingType((editingClient as any).billing_type || 'monthly')
      setNumberOfCycles((editingClient as any).number_of_cycles?.toString() || '')
    } else {
      setName('')
      setEmail('')
      setPhone('')
      setMonthlyPrice('')
      setDueDay('5')
      setBillingType('monthly')
      setNumberOfCycles('')
    }
    setErrors({})
  }, [editingClient, isOpen])

  const resetForm = () => {
    setName('')
    setEmail('')
    setPhone('')
    setMonthlyPrice('')
    setDueDay('5')
    setBillingType('monthly')
    setNumberOfCycles('')
    setErrors({})
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const validateForm = (): boolean => {
    const newErrors: typeof errors = {}
    
    const sanitizedName = sanitizeInput(name)
    if (!sanitizedName) {
      newErrors.name = 'O nome é obrigatório'
    } else if (!isValidName(sanitizedName)) {
      newErrors.name = 'Nome inválido'
    }
    
    const sanitizedEmail = sanitizeInput(email)
    if (sanitizedEmail && !isValidEmail(sanitizedEmail)) {
      newErrors.email = 'E-mail inválido'
    }
    
    const valueNumber = parseFloat(monthlyPrice.replace(',', '.'))
    if (!monthlyPrice.trim()) {
      newErrors.monthlyPrice = 'O valor mensal é obrigatório'
    } else if (!isValidMonetaryValue(valueNumber)) {
      newErrors.monthlyPrice = 'Valor inválido'
    } else if (valueNumber <= 0) {
      newErrors.monthlyPrice = 'O valor deve ser maior que zero'
    }
    
    const dueDayNumber = parseInt(dueDay, 10)
    if (!dueDay || dueDayNumber < 1 || dueDayNumber > 31 || isNaN(dueDayNumber)) {
      newErrors.dueDay = 'Dia de vencimento deve ser entre 1 e 31'
    }
    
    if (!billingType) {
      newErrors.billingType = 'O tipo de cobrança é obrigatório'
    }
    
    const cyclesNumber = parseInt(numberOfCycles, 10)
    if (!numberOfCycles.trim()) {
      newErrors.numberOfCycles = 'O número de parcelas é obrigatório'
    } else if (isNaN(cyclesNumber) || cyclesNumber <= 0) {
      newErrors.numberOfCycles = 'O número de parcelas deve ser maior que zero'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return
    
    setIsSubmitting(true)
    
    try {
      const clientData = {
        name: sanitizeInput(name),
        email: sanitizeInput(email) || undefined,
        phone: sanitizeInput(phone) || undefined,
        monthly_price: parseFloat(monthlyPrice.replace(',', '.')),
        due_day: dueDay ? parseInt(dueDay, 10) : 5,
        billing_type: billingType,
        number_of_cycles: numberOfCycles ? parseInt(numberOfCycles, 10) : null,
      }

      let result
      if (isEditing && editingClient) {
        result = await updateClient(editingClient.id, clientData)
      } else {
        result = await addClient(clientData)
      }
      
      if (result.success) {
        toast.success(isEditing ? 'Cliente atualizado com sucesso!' : 'Cliente adicionado com sucesso!')
        onSuccess?.()
        handleClose()
      } else {
        toast.error(result.error || 'Ocorreu um erro')
      }
    } catch {
      toast.error('Ocorreu um erro inesperado')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
            onClick={handleClose}
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 px-4"
          >
            <div className="rounded-xl border border-border bg-card p-6 shadow-2xl">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-foreground">
                  {isEditing ? 'Editar cliente' : 'Adicionar cliente'}
                </h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClose}
                  className="h-8 w-8"
                  aria-label="Close modal"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <form onSubmit={handleSubmit}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="client-name">Nome</FieldLabel>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="client-name"
                        type="text"
                        placeholder="Nome do cliente"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="pl-10"
                        disabled={isSubmitting}
                        aria-invalid={!!errors.name}
                      />
                    </div>
                    {errors.name && <FieldError>{errors.name}</FieldError>}
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="client-email">E-mail (opcional)</FieldLabel>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="client-email"
                        type="email"
                        placeholder="cliente@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                        disabled={isSubmitting}
                        aria-invalid={!!errors.email}
                      />
                    </div>
                    {errors.email && <FieldError>{errors.email}</FieldError>}
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="client-phone">Telefone (opcional)</FieldLabel>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="client-phone"
                        type="tel"
                        placeholder="+55 11 99999-9999"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="pl-10"
                        disabled={isSubmitting}
                        aria-invalid={!!errors.phone}
                      />
                    </div>
                    {errors.phone && <FieldError>{errors.phone}</FieldError>}
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="client-price">Valor mensal</FieldLabel>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="client-price"
                        type="text"
                        placeholder="0,00"
                        value={monthlyPrice}
                        onChange={(e) => setMonthlyPrice(e.target.value)}
                        className="pl-10"
                        disabled={isSubmitting}
                        aria-invalid={!!errors.monthlyPrice}
                      />
                    </div>
                    {errors.monthlyPrice && <FieldError>{errors.monthlyPrice}</FieldError>}
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="due-day">Dia de vencimento</FieldLabel>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="due-day"
                        type="number"
                        min="1"
                        max="31"
                        value={dueDay}
                        onChange={(e) => setDueDay(e.target.value)}
                        className="pl-10"
                        disabled={isSubmitting}
                        placeholder="5"
                      />
                    </div>
                    {errors.dueDay && <FieldError>{errors.dueDay}</FieldError>}
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="billing-type">Tipo de cobrança</FieldLabel>
                    <select
                      id="billing-type"
                      value={billingType}
                      onChange={(e) => setBillingType(e.target.value as 'monthly' | 'weekly' | 'yearly')}
                      disabled={isSubmitting}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="monthly">Mensal</option>
                      <option value="weekly">Semanal</option>
                      <option value="yearly">Anual</option>
                    </select>
                    {errors.billingType && <FieldError>{errors.billingType}</FieldError>}
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="number-of-cycles">Número de parcelas</FieldLabel>
                    <div className="relative">
                      <Repeat className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="number-of-cycles"
                        type="number"
                        placeholder="12"
                        value={numberOfCycles}
                        onChange={(e) => setNumberOfCycles(e.target.value)}
                        className="pl-10"
                        disabled={isSubmitting}
                        min="1"
                        aria-invalid={!!errors.numberOfCycles}
                      />
                    </div>
                    {errors.numberOfCycles && <FieldError>{errors.numberOfCycles}</FieldError>}
                  </Field>
                </FieldGroup>

                <div className="mt-6 flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClose}
                    disabled={isSubmitting}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      isEditing ? 'Salvar' : 'Adicionar cliente'
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
