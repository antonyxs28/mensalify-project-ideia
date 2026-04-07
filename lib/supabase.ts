import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
})

export type Database = {
  public: {
    Tables: {
      clients: {
        Row: {
          id: string
          user_id: string
          name: string
          email: string
          phone: string
          monthly_price: number
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          email?: string
          phone?: string
          monthly_price: number
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          email?: string
          phone?: string
          monthly_price?: number
          created_at?: string
          updated_at?: string | null
        }
      }
      payments: {
        Row: {
          id: string
          client_id: string
          month: string
          paid: boolean
          paid_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          client_id: string
          month: string
          paid?: boolean
          paid_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          month?: string
          paid?: boolean
          paid_at?: string | null
          created_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          name: string
          email: string
          created_at: string
        }
        Insert: {
          id: string
          name: string
          email: string
          created_at?: string
        }
        Update: {
          name?: string
          email?: string
        }
      }
    }
  }
}
