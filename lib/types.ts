export type PaymentStatus = 'pago' | 'pendente'

export interface User {
  id: string
  email: string
  name: string
  createdAt?: Date
}

export interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
}

export interface Client {
  id: string
  user_id: string
  name: string
  email: string | null
  phone: string | null
  monthly_price: number
  due_day: number
  billing_type: string | null
  total_installments: number
  number_of_cycles: number | null
  created_at: string
  updated_at: string | null
}

export interface ClientWithStatus extends Client {
  status: PaymentStatus
  monthKey: string
  dueDate?: Date
  paidCycles?: number
  totalCycles?: number
}

export interface Payment {
  id: string
  client_id: string
  month: string
  paid: boolean
  paid_at: string | null
  created_at: string
}

export interface Profile {
  id: string
  name: string
  email: string
  created_at: string
}

export interface LoginFormData {
  email: string
  password: string
}

export interface RegisterFormData {
  name: string
  email: string
  password: string
  confirmPassword: string
}

export interface ClientFormData {
  name: string
  monthly_price: number
  email?: string
  phone?: string
  due_day?: number
  billing_type?: 'monthly' | 'weekly' | 'yearly'
  number_of_cycles?: number | null
}

export interface DashboardStats {
  totalReceived: number
  totalPending: number
  totalClients: number
  paidClients: number
  pendingClients: number
}

export interface PaymentChartData {
  month: string
  received: number
  pending: number
}

export interface ChartData {
  month: string
  monthKey: string
  received: number
  expected: number
}
