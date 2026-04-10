'use client'

import { motion } from 'framer-motion'

import { BillingStatsCards } from '@/components/dashboard/billing-stats-cards'
import { PaymentsChart } from '@/components/dashboard/payments-chart'
import { RecentClients } from '@/components/dashboard/recent-clients'

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">
          Dashboard
        </h1>
        <p className="mt-1 text-muted-foreground">
          Visão geral das suas assinaturas e pagamentos
        </p>
      </motion.div>

      {/* Billing Stats Cards */}
      <BillingStatsCards />

      {/* Charts and Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        <PaymentsChart />
        <RecentClients />
      </div>
    </div>
  )
}
