'use client'

import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

import { useClients } from '@/hooks/use-clients'
import { formatCurrency, formatDate } from '@/lib/validation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function RecentClients() {
  const { clients } = useClients()
  const recentClients = clients.slice(0, 5)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
    >
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-foreground">
              Clientes Recentes
            </CardTitle>
            <CardDescription>
              Últimos clientes adicionados
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/clients" className="flex items-center gap-1">
              Ver todos
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentClients.map((client) => (
              <div
                key={client.id}
                className="flex items-center justify-between rounded-lg border border-border/30 bg-secondary/30 p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                    {client.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{client.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(client.monthly_price)}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-sm font-medium ${
                    (client.paidCycles ?? 0) === (client.totalCycles ?? 0) && (client.totalCycles ?? 0) > 0
                      ? 'text-green-500'
                      : 'text-muted-foreground'
                  }`}
                >
                  {client.paidCycles ?? 0}/{client.totalCycles ?? 0}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
