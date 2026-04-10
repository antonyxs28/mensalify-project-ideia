'use client'

import { motion } from 'framer-motion'
import { DollarSign, Clock, AlertTriangle, Calendar } from 'lucide-react'

import { useBillingStats, type BillingStats } from '@/hooks/use-billing-cycles'
import { formatCurrency } from '@/lib/validation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

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

function StatsCard({ 
  title, 
  value, 
  description, 
  icon: Icon, 
  variant = 'default'
}: { 
  title: string
  value: string
  description?: string
  icon: React.ElementType
  variant?: 'default' | 'warning' | 'success'
}) {
  const variantClasses = {
    default: 'bg-primary/10',
    warning: 'bg-destructive/10',
    success: 'bg-success/10',
  }
  
  const iconColors = {
    default: 'text-primary',
    warning: 'text-destructive',
    success: 'text-success',
  }

  return (
    <motion.div variants={item}>
      <Card className="relative overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          <div className={`rounded-lg p-2 ${variantClasses[variant]}`}>
            <Icon className={`h-4 w-4 ${iconColors[variant]}`} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">{value}</div>
          {description && (
            <div className="mt-1 text-xs text-muted-foreground">{description}</div>
          )}
        </CardContent>
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      </Card>
    </motion.div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <Card key={i} className="p-6">
          <Skeleton className="h-4 w-20 mb-2" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-3 w-24 mt-2" />
        </Card>
      ))}
    </div>
  )
}

export function BillingStatsCards() {
  const { stats, isLoading, error } = useBillingStats()

  if (isLoading) {
    return <LoadingSkeleton />
  }

  if (error) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="p-6 border-destructive">
          <p className="text-destructive text-sm">Erro ao carregar estatísticas</p>
        </Card>
      </div>
    )
  }

  const cards = [
    {
      title: 'Total Recebido',
      value: formatCurrency(stats.totalReceived),
      description: `${stats.paidCycles} ciclos pagos`,
      icon: DollarSign,
      variant: 'success' as const,
    },
    {
      title: 'Total Esperado',
      value: formatCurrency(stats.totalExpected),
      description: `${stats.totalCycles} ciclos total`,
      icon: Calendar,
      variant: 'default' as const,
    },
    {
      title: 'Ciclos Vencidos',
      value: stats.overdueCycles.toString(),
      description: 'Pagamentos atrasados',
      icon: AlertTriangle,
      variant: 'warning' as const,
    },
    {
      title: 'Receita Mês Atual',
      value: formatCurrency(stats.currentMonthRevenue),
      description: `${stats.pendingCycles + stats.partialCycles} pendentes`,
      icon: Clock,
      variant: 'default' as const,
    },
  ]

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
    >
      {cards.map((card, index) => (
        <StatsCard key={index} {...card} />
      ))}
    </motion.div>
  )
}