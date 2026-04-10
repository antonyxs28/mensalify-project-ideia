import { pgTable, uuid, text, numeric, timestamp, boolean, date, index, uniqueIndex } from 'drizzle-orm/pg-core'

// PROFILES - Extended user info (managed by Supabase trigger)
export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
})

// CLIENTS - Each user can have many clients
export const clients = pgTable('clients', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull(),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  monthlyPrice: numeric('monthly_price', { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
}, (table) => ({
  userIdIdx: index('idx_clients_user_id').on(table.userId)
}))

// PAYMENTS - Each client can have many payments (one per month)
export const payments = pgTable('payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  month: date('month').notNull(),
  paid: boolean('paid').default(false),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
}, (table) => ({
  clientMonthUnique: uniqueIndex('idx_payments_client_month').on(table.clientId, table.month),
  clientIdIdx: index('idx_payments_client_id').on(table.clientId),
  monthIdx: index('idx_payments_month').on(table.month)
}))

// TYPE OVERRIDES - Numeric returns string by default, we override to number
export type Profile = Omit<typeof profiles.$inferSelect, never>
export type NewProfile = typeof profiles.$inferInsert

export interface Client {
  id: string
  userId: string
  name: string
  email: string | null
  phone: string | null
  monthlyPrice: string // Drizzle numeric returns string
  createdAt: Date | null
  updatedAt: Date | null
}

export interface NewClient {
  userId: string
  name: string
  email?: string | null
  phone?: string | null
  monthlyPrice: string | number // Accept string or number for insert
}

export type Payment = Omit<typeof payments.$inferSelect, never>
export type NewPayment = typeof payments.$inferInsert