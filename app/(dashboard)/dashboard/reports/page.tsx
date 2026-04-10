'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts'
import { Download, TrendingUp, Users, DollarSign } from 'lucide-react'

import { useClients } from '@/contexts/clients-context'
import type { ClientWithStatus } from '@/lib/types'
import { formatCurrency } from '@/lib/validation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const COLORS = {
  pago: 'oklch(0.65 0.12 200)',
  pendente: 'oklch(0.75 0.15 85)'
}

const statusLabels: Record<string, string> = {
  pago: 'Pago',
  pendente: 'Pendente'
}

export default function ReportsPage() {
  const { clients: rawClients, getStats } = useClients()
  const clients = rawClients as ClientWithStatus[]
  const stats = getStats()

  const paymentStatusDistribution = useMemo(() => {
    const distribution = clients.reduce((acc, client) => {
      acc[client.status] = (acc[client.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return Object.entries(distribution).map(([status, count]) => ({
      name: statusLabels[status] || status,
      value: count,
      status
    }))
  }, [clients])

  const revenueByStatus = useMemo(() => {
    const revenue = clients.reduce((acc, client) => {
      if (client.status === 'pago') {
        acc['pago'] = (acc['pago'] || 0) + client.monthly_price
      } else {
        acc['pendente'] = (acc['pendente'] || 0) + client.monthly_price
      }
      return acc
    }, {} as Record<string, number>)

    return Object.entries(revenue).map(([status, value]) => ({
      name: statusLabels[status] || status,
      receita: value,
      status
    }))
  }, [clients])

  const monthlyStats = useMemo(() => {
    return [
      { label: 'Receita Total', value: formatCurrency(stats.totalReceived), icon: DollarSign, color: 'text-success' },
      { label: 'Pendente', value: formatCurrency(stats.totalPending), icon: TrendingUp, color: 'text-warning' },
      { label: 'Total Clientes', value: stats.totalClients.toString(), icon: Users, color: 'text-primary' }
    ]
  }, [stats])

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">
            Relatórios
          </h1>
          <p className="mt-1 text-muted-foreground">
            Análise detalhada do seu negócio
          </p>
        </div>
        <Button variant="outline" className="w-full sm:w-auto">
          <Download className="mr-2 h-4 w-4" />
          Exportar Relatório
        </Button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid gap-4 sm:grid-cols-3"
      >
        {monthlyStats.map((stat, index) => (
          <Card key={index} className="border-border/50 bg-card/50">
            <CardContent className="flex items-center gap-4 p-4">
              <div className={`rounded-lg bg-secondary p-3 ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-xl font-bold text-foreground">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-foreground">
                Status de Pagamento
              </CardTitle>
              <CardDescription>
                Quantidade de clientes por status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-75">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentStatusDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {paymentStatusDistribution.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={COLORS[entry.status as keyof typeof COLORS] || COLORS.pendente}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'oklch(0.12 0 0)',
                        border: '1px solid oklch(0.22 0 0)',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number) => [`${value} clientes`, 'Quantidade']}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-foreground">
                Receita por Status
              </CardTitle>
              <CardDescription>
                Receita mensal por status de pagamento
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-75">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueByStatus} layout="vertical">
                    <CartesianGrid 
                      strokeDasharray="3 3" 
                      stroke="oklch(0.22 0 0)" 
                      horizontal={true}
                      vertical={false}
                    />
                    <XAxis 
                      type="number"
                      stroke="oklch(0.6 0 0)"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => formatCurrency(value)}
                    />
                    <YAxis 
                      type="category"
                      dataKey="name"
                      stroke="oklch(0.6 0 0)"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      width={100}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'oklch(0.12 0 0)',
                        border: '1px solid oklch(0.22 0 0)',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number) => [formatCurrency(value), 'Receita']}
                    />
                    <Bar 
                      dataKey="receita" 
                      radius={[0, 4, 4, 0]}
                    >
                      {revenueByStatus.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={COLORS[entry.status as keyof typeof COLORS] || COLORS.pendente}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-foreground">
              Resumo Mensal
            </CardTitle>
            <CardDescription>
              Visão geral das métricas do mês atual
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-border/30 bg-secondary/30 p-4">
                <p className="text-sm text-muted-foreground">Taxa de Pagamento</p>
                <p className="mt-1 text-2xl font-bold text-success">
                  {stats.totalClients > 0 
                    ? Math.round((stats.paidClients / stats.totalClients) * 100)
                    : 0}%
                </p>
              </div>
              <div className="rounded-lg border border-border/30 bg-secondary/30 p-4">
                <p className="text-sm text-muted-foreground">Ticket Médio</p>
                <p className="mt-1 text-2xl font-bold text-foreground">
                  {formatCurrency(
                    clients.length > 0
                      ? clients.reduce((sum, c) => sum + c.monthly_price, 0) / clients.length
                      : 0
                  )}
                </p>
              </div>
              <div className="rounded-lg border border-border/30 bg-secondary/30 p-4">
                <p className="text-sm text-muted-foreground">Clientes Pagos</p>
                <p className="mt-1 text-2xl font-bold text-foreground">
                  {stats.paidClients}
                </p>
              </div>
              <div className="rounded-lg border border-border/30 bg-secondary/30 p-4">
                <p className="text-sm text-muted-foreground">Clientes Pendentes</p>
                <p className="mt-1 text-2xl font-bold text-warning">
                  {stats.pendingClients}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
