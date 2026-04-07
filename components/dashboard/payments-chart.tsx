'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend } from 'recharts'

import { useClients } from '@/contexts/clients-context'
import { formatCurrency } from '@/lib/validation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function PaymentsChart() {
  const { clients, getStats } = useClients()
  const stats = getStats()

  const data = useMemo(() => {
    const months = ['Nov', 'Dez', 'Jan', 'Fev', 'Mar', 'Abr']
    
    return months.map((month, index) => {
      const monthlyReceived = stats.totalReceived
      const monthlyPending = stats.totalPending
      
      const variation = 1 + (index - 2) * 0.1
      
      return {
        month,
        received: Math.round(monthlyReceived * variation),
        pending: Math.round(monthlyPending * variation)
      }
    })
  }, [stats])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">
            Visão Geral de Pagamentos
          </CardTitle>
          <CardDescription>
            Receita mensal baseada em clientes pagos e pendentes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorReceived" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="oklch(0.75 0.15 165)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="oklch(0.75 0.15 165)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorPending" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="oklch(0.75 0.15 85)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="oklch(0.75 0.15 85)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  stroke="oklch(0.22 0 0)" 
                  vertical={false}
                />
                <XAxis 
                  dataKey="month" 
                  stroke="oklch(0.6 0 0)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  stroke="oklch(0.6 0 0)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'oklch(0.12 0 0)',
                    border: '1px solid oklch(0.22 0 0)',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)'
                  }}
                  labelStyle={{ color: 'oklch(0.95 0 0)' }}
                  formatter={(value: number, name: string) => [
                    formatCurrency(value),
                    name === 'received' ? 'Recebido' : 'Pendente'
                  ]}
                />
                <Legend 
                  formatter={(value) => value === 'received' ? 'Recebido' : 'Pendente'}
                  wrapperStyle={{ paddingTop: '20px' }}
                />
                <Area
                  type="monotone"
                  dataKey="received"
                  stroke="oklch(0.75 0.15 165)"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorReceived)"
                />
                <Area
                  type="monotone"
                  dataKey="pending"
                  stroke="oklch(0.75 0.15 85)"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorPending)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
