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
import { formatCurrency } from '@/lib/validation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const COLORS = {
  basico: 'oklch(0.65 0.12 200)',
  intermediario: 'oklch(0.75 0.15 85)',
  premium: 'oklch(0.75 0.15 165)'
}

const planLabels: Record<string, string> = {
  basico: 'Básico',
  intermediario: 'Intermediário',
  premium: 'Premium'
}

export default function ReportsPage() {
  const { clients, getStats } = useClients()
  const stats = getStats()

  // Plan distribution data
  const planDistribution = useMemo(() => {
    const distribution = clients.reduce((acc, client) => {
      acc[client.plan] = (acc[client.plan] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return Object.entries(distribution).map(([plan, count]) => ({
      name: planLabels[plan] || plan,
      value: count,
      plan
    }))
  }, [clients])

  // Revenue by plan
  const revenueByPlan = useMemo(() => {
    const revenue = clients.reduce((acc, client) => {
      if (client.status === 'pago') {
        acc[client.plan] = (acc[client.plan] || 0) + client.monthlyValue
      }
      return acc
    }, {} as Record<string, number>)

    return Object.entries(revenue).map(([plan, value]) => ({
      name: planLabels[plan] || plan,
      receita: value,
      plan
    }))
  }, [clients])

  // Monthly stats
  const monthlyStats = useMemo(() => {
    return [
      { label: 'Receita Total', value: formatCurrency(stats.totalReceived), icon: DollarSign, color: 'text-success' },
      { label: 'Pendente', value: formatCurrency(stats.totalPending), icon: TrendingUp, color: 'text-warning' },
      { label: 'Total Clientes', value: stats.totalClients.toString(), icon: Users, color: 'text-primary' }
    ]
  }, [stats])

  return (
    <div className="space-y-6">
      {/* Header */}
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

      {/* Quick Stats */}
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

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Plan Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-foreground">
                Distribuição por Plano
              </CardTitle>
              <CardDescription>
                Quantidade de clientes em cada plano
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={planDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {planDistribution.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={COLORS[entry.plan as keyof typeof COLORS] || COLORS.basico}
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

        {/* Revenue by Plan */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-foreground">
                Receita por Plano
              </CardTitle>
              <CardDescription>
                Receita mensal de cada plano (clientes pagos)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueByPlan} layout="vertical">
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
                      {revenueByPlan.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={COLORS[entry.plan as keyof typeof COLORS] || COLORS.basico}
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

      {/* Summary Table */}
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
                      ? clients.reduce((sum, c) => sum + c.monthlyValue, 0) / clients.length
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
