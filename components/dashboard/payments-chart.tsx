'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts'

import { useClients } from '@/contexts/clients-context'
import { formatCurrency } from '@/lib/validation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const COLORS = {
  received: '#22c55e',
  expected: '#94a3b8'
}

export function PaymentsChart() {
  const { clients, getChartData } = useClients()

  const data = useMemo(() => {
    return getChartData()
  }, [getChartData, clients])

  const hasData = useMemo(() => {
    return data.some(d => d.received > 0 || d.expected > 0)
  }, [data])

  if (!hasData) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-foreground">
              Receita Mensal
            </CardTitle>
            <CardDescription>
              Dados de pagamentos por mês
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-[300px] items-center justify-center text-muted-foreground">
              Nenhum pagamento registrado ainda
            </div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">
            Receita Mensal
          </CardTitle>
          <CardDescription>
            Pagamentos recebidos por mês
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                barGap={4}
              >
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
                  dy={10}
                />
                <YAxis 
                  stroke="oklch(0.6 0 0)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `R$${value / 1000}k`}
                  dx={-10}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'oklch(0.12 0 0)',
                    border: '1px solid oklch(0.22 0 0)',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)'
                  }}
                  labelStyle={{ color: 'oklch(0.95 0 0)', fontWeight: 600 }}
                  formatter={(value: number, name: string) => [
                    formatCurrency(value),
                    name === 'received' ? 'Recebido' : 'Previsto'
                  ]}
                  cursor={{ fill: 'oklch(0.15 0 0)' }}
                />
                <Legend 
                  wrapperStyle={{ paddingTop: '16px' }}
                  formatter={(value) => 
                    value === 'received' ? 'Recebido' : 'Previsto'
                  }
                />
                <Bar
                  dataKey="received"
                  name="received"
                  fill={COLORS.received}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={48}
                />
                <Bar
                  dataKey="expected"
                  name="expected"
                  fill={COLORS.expected}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={48}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
