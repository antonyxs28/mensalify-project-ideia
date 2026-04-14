'use client'

import { motion } from 'framer-motion'
import { DollarSign, Clock, Users, TrendingUp, TrendingDown } from 'lucide-react'

import { useClients } from '@/hooks/use-clients'
import { formatCurrency } from '@/lib/validation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
}

export function StatsCards() {
  const { getStats } = useClients()
  const stats = getStats()

  const cards = [
    {
      title: 'Total Recebido',
      value: formatCurrency(stats.totalReceived),
      description: `${stats.paidClients} clientes pagos`,
      icon: DollarSign,
      trend: 'up' as const,
      trendValue: '+12.5%'
    },
    {
      title: 'Total Pendente',
      value: formatCurrency(stats.totalPending),
      description: `${stats.pendingClients} pagamentos pendentes`,
      icon: Clock,
      trend: 'down' as const,
      trendValue: '-8.2%'
    },
    {
      title: 'Total de Clientes',
      value: stats.totalClients.toString(),
      description: 'Clientes ativos',
      icon: Users,
      trend: 'up' as const,
      trendValue: '+2 este mês'
    }
  ]

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
    >
      {cards.map((card, index) => (
        <motion.div key={index} variants={item}>
          <Card className="relative overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <div className="rounded-lg bg-primary/10 p-2">
                <card.icon className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{card.value}</div>
              <div className="mt-1 flex items-center gap-2">
                {card.trend === 'up' ? (
                  <TrendingUp className="h-3 w-3 text-success" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-destructive" />
                )}
                <span className={`text-xs ${card.trend === 'up' ? 'text-success' : 'text-destructive'}`}>
                  {card.trendValue}
                </span>
                <span className="text-xs text-muted-foreground">{card.description}</span>
              </div>
            </CardContent>
            {/* Subtle gradient accent */}
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
          </Card>
        </motion.div>
      ))}
    </motion.div>
  )
}
