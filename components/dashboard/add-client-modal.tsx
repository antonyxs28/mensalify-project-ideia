'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Loader2, User, Mail, Phone, DollarSign } from 'lucide-react'
import { toast } from 'sonner'

import { useClients } from '@/contexts/clients-context'
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
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<{
    name?: string
    email?: string
    phone?: string
    monthlyPrice?: string
  }>({})

  const isEditing = !!editingClient

  useEffect(() => {
    if (editingClient) {
      setName(editingClient.name)
      setEmail(editingClient.email || '')
      setPhone(editingClient.phone || '')
      setMonthlyPrice(editingClient.monthly_price?.toString() || '')
    } else {
      setName('')
      setEmail('')
      setPhone('')
      setMonthlyPrice('')
    }
    setErrors({})
  }, [editingClient, isOpen])

  const resetForm = () => {
    setName('')
    setEmail('')
    setPhone('')
    setMonthlyPrice('')
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
      newErrors.name = 'Name is required'
    } else if (!isValidName(sanitizedName)) {
      newErrors.name = 'Please enter a valid name'
    }
    
    const sanitizedEmail = sanitizeInput(email)
    if (sanitizedEmail && !isValidEmail(sanitizedEmail)) {
      newErrors.email = 'Please enter a valid email'
    }
    
    const valueNumber = parseFloat(monthlyPrice.replace(',', '.'))
    if (!monthlyPrice.trim()) {
      newErrors.monthlyPrice = 'Monthly price is required'
    } else if (!isValidMonetaryValue(valueNumber)) {
      newErrors.monthlyPrice = 'Please enter a valid amount'
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
        monthly_price: parseFloat(monthlyPrice.replace(',', '.'))
      }

      let result
      if (isEditing && editingClient) {
        result = await updateClient(editingClient.id, clientData)
      } else {
        result = await addClient(clientData)
      }
      
      if (result.success) {
        toast.success(isEditing ? 'Client updated successfully!' : 'Client added successfully!')
        onSuccess?.()
        handleClose()
      } else {
        toast.error(result.error || 'An error occurred')
      }
    } catch {
      toast.error('An unexpected error occurred')
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
                  {isEditing ? 'Edit Client' : 'Add Client'}
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
                    <FieldLabel htmlFor="client-name">Name</FieldLabel>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="client-name"
                        type="text"
                        placeholder="Client name"
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
                    <FieldLabel htmlFor="client-email">Email (optional)</FieldLabel>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="client-email"
                        type="email"
                        placeholder="client@email.com"
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
                    <FieldLabel htmlFor="client-phone">Phone (optional)</FieldLabel>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="client-phone"
                        type="tel"
                        placeholder="+1 234 567 8900"
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
                    <FieldLabel htmlFor="client-price">Monthly Price</FieldLabel>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="client-price"
                        type="text"
                        placeholder="0.00"
                        value={monthlyPrice}
                        onChange={(e) => setMonthlyPrice(e.target.value)}
                        className="pl-10"
                        disabled={isSubmitting}
                        aria-invalid={!!errors.monthlyPrice}
                      />
                    </div>
                    {errors.monthlyPrice && <FieldError>{errors.monthlyPrice}</FieldError>}
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
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      isEditing ? 'Save' : 'Add Client'
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
