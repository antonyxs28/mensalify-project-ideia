'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Edit, MoreHorizontal, Trash2, Loader2, Eye, DollarSign, Wallet, CreditCard } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

import { useClients } from '@/contexts/clients-context'
import { formatCurrency, formatDate } from '@/lib/validation'
import type { ClientWithStatus } from '@/lib/types'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface ClientWithDate extends ClientWithStatus {
  dueDate?: Date
}

import { RegisterPaymentDialog } from './register-payment-dialog'
import { PaymentModal } from './payment-modal'

interface ClientsTableProps {
  onEdit: (client: ClientWithStatus) => void
}

export function ClientsTable({ onEdit }: ClientsTableProps) {
  const { clients, deleteClient, refetch } = useClients()
  const [processingId, setProcessingId] = useState<string | null>(null)
  const router = useRouter()

  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState('')
  const [selectedClientName, setSelectedClientName] = useState('')
  const [selectedCycle, setSelectedCycle] = useState<any>(null)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)

  const handleViewDetails = (id: string) => {
    router.push(`/dashboard/clients/${id}`)
  }

  const handleOpenPaymentDialog = (clientId: string) => {
    const client = clients.find(c => c.id === clientId)
    if (client) {
      setSelectedClientId(clientId)
      setSelectedClientName(client.name)
      setPaymentDialogOpen(true)
    }
  }

  const handleSelectCycle = (cycle: any) => {
    setSelectedCycle(cycle)
    setPaymentDialogOpen(false)
    setPaymentModalOpen(true)
  }

  const handlePaymentSuccess = () => {
    refetch()
    setSelectedCycle(null)
    setPaymentModalOpen(false)
    toast.success('Pagamento registrado com sucesso!')
  }

  const handleDelete = async (id: string) => {
    setProcessingId(id)
    try {
      const result = await deleteClient(id)
      if (result.success) {
        toast.success('Cliente removido com sucesso!')
      } else {
        toast.error(result.error || 'Falha ao remover cliente')
      }
    } catch {
      toast.error('Ocorreu um erro inesperado')
    } finally {
      setProcessingId(null)
    }
  }

  const DesktopTable = () => (
    <div className="hidden md:block overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-border/50 hover:bg-transparent">
            <TableHead className="text-muted-foreground">Name</TableHead>
            <TableHead className="text-muted-foreground hidden md:table-cell">Contact</TableHead>
            <TableHead className="text-muted-foreground hidden md:table-cell">Monthly Price</TableHead>
            <TableHead className="text-muted-foreground">Progresso</TableHead>
            <TableHead className="text-muted-foreground hidden md:table-cell">Due Date</TableHead>
            <TableHead className="text-muted-foreground">Pagamento</TableHead>
            <TableHead className="text-right text-muted-foreground">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((client, index) => (
            <motion.tr
              key={client.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="border-border/30 hover:bg-secondary/30"
            >
              <TableCell>
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                    {client.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{client.name}</p>
                    <p className="text-xs text-muted-foreground">{client.email || '-'}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <div className="text-sm">
                  {client.email && <p className="text-muted-foreground">{client.email}</p>}
                  {client.phone && <p className="text-muted-foreground">{client.phone}</p>}
                  {!client.email && !client.phone && <span className="text-muted-foreground">-</span>}
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <span className="font-medium text-foreground">
                  {formatCurrency(client.monthly_price)}
                </span>
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <span className="text-sm font-medium">
                    {client.paidCycles ?? 0}/{client.totalCycles ?? 0}
                  </span>
                  {(client.totalCycles ?? 0) > 0 && (
                    <div className="h-1 w-full rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${((client.paidCycles ?? 0) / (client.totalCycles ?? 1)) * 100}%` }}
                      />
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <span className="text-muted-foreground">
                  {formatDate((client as ClientWithDate).dueDate || new Date(client.created_at))}
                </span>
              </TableCell>
              <TableCell>
                {(client.paidCycles ?? 0) < (client.totalCycles ?? 0) ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenPaymentDialog(client.id)}
                    disabled={processingId === client.id}
                  >
                    <DollarSign className="mr-1 h-4 w-4" />
                    <span className="hidden sm:inline">Pagar</span>
                  </Button>
                ) : (
                  <span className="text-sm text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={processingId === client.id}
                    >
                      {processingId === client.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <MoreHorizontal className="h-4 w-4" />
                      )}
                      <span className="sr-only">Open menu</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => handleViewDetails(client.id)}>
                      <Eye className="mr-2 h-4 w-4" />
                      Ver Detalhes
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onEdit(client)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Editar Cliente
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleDelete(client.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </motion.tr>
          ))}
        </TableBody>
      </Table>
    </div>
  )

  const MobileCards = () => (
    <div className="space-y-4 md:hidden">
      {clients.map((client, index) => (
        <motion.div
          key={client.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
        >
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                    {client.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{client.name}</p>
                    {(client.email || client.phone) && (
                      <p className="text-xs text-muted-foreground">{client.email || client.phone}</p>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-sm font-medium">
                    {client.paidCycles ?? 0}/{client.totalCycles ?? 0}
                  </span>
                  {(client.totalCycles ?? 0) > 0 && (
                    <div className="h-1 w-full rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${((client.paidCycles ?? 0) / (client.totalCycles ?? 1)) * 100}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
              
              <div className="mt-4 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenPaymentDialog(client.id)}
                  disabled={processingId === client.id || (client.paidCycles ?? 0) >= (client.totalCycles ?? 0)}
                  className="flex-1"
                >
                  <DollarSign className="h-4 w-4" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={processingId === client.id}
                      className="flex-1"
                    >
                      {processingId === client.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <MoreHorizontal className="h-4 w-4" />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => handleViewDetails(client.id)}>
                      <Eye className="mr-2 h-4 w-4" />
                      Ver Detalhes
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onEdit(client)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Editar Cliente
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleDelete(client.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  )

  if (clients.length === 0) {
    return (
      <Card className="border-border/50 bg-card/50">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-lg font-medium text-foreground">No clients found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add your first client to get started
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className="border-border/50 bg-card/50">
        <CardContent className="p-0 md:p-0">
          <DesktopTable />
          <div className="p-4 md:hidden">
            <MobileCards />
          </div>
        </CardContent>
      </Card>

      <RegisterPaymentDialog
        clientId={selectedClientId}
        clientName={selectedClientName}
        isOpen={paymentDialogOpen}
        onClose={() => {
          setPaymentDialogOpen(false)
          setSelectedClientId('')
          setSelectedClientName('')
        }}
        onSelectCycle={handleSelectCycle}
      />

      <PaymentModal
        cycle={selectedCycle}
        isOpen={paymentModalOpen}
        onClose={() => {
          setPaymentModalOpen(false)
          setSelectedCycle(null)
        }}
        onSuccess={handlePaymentSuccess}
      />
    </>
  )
}
