export type PaymentStatus = 'pago' | 'pendente'

export interface User {
  id: string
  email: string
  name: string
  createdAt?: Date
}

export interface AuthResult {
  success: boolean
  error?: string
  user?: User
}

export interface AuthService {
  login: (email: string, password: string) => Promise<AuthResult>
  register: (name: string, email: string, password: string) => Promise<AuthResult>
  logout: () => Promise<void>
  getSession: () => Promise<User | null>
  getCurrentUser: () => Promise<User | null>
  updateProfile: (userId: string, name: string) => Promise<AuthResult>
  resendConfirmation: (email: string) => Promise<AuthResult>
  subscribeToAuthChanges: (callback: (user: User | null) => void) => () => void
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

export interface BillingCycle {
  id: string
  client_id: string
  cycle_year: number
  cycle_month: number
  reference_date?: string
  due_date?: string
  expected_amount: number
  paid_amount: number
  status?: "pending" | "paid" | "overdue" | "partial" | "overpaid"
  created_at?: string
  updated_at?: string | null
}

export interface BillingPayment {
  id: string
  client_id: string
  billing_cycle_id: string | null
  month: string
  amount: number
  paid: boolean
  paid_at: string | null
  created_at: string
}

export interface ServiceResult<T> {
  success: boolean
  data?: T
  error?: string
}

export interface ClientBillingInfo {
  id: string
  monthly_price: number
  created_at: string
  due_day?: number
  billing_type?: string | null
  total_installments?: number
  number_of_cycles?: number | null
}

export interface ClientFinancialSummary {
  clientId: string
  clientName: string
  totalExpected: number
  totalPaid: number
  pendingAmount: number
  overdueAmount: number
  paidCycles: number
  totalCycles: number
  nextDueDate?: string
}

export interface PaymentRecord {
  id: string
  amount: number
  billing_cycle_id: string | null
  paid_at: string | null
  created_at: string
}
