'use client'

import { supabase } from '@/lib/supabase/client'
import type { User } from '@/lib/types'

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
  subscribeToAuthChanges: (callback: (user: User | null) => void) => () => void
}

async function fetchProfile(userId: string, email: string): Promise<{ name: string }> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching profile:', error)
    return { name: email.split('@')[0] }
  }

  return { name: profile?.name || email.split('@')[0] }
}

export const authService: AuthService = {
  async login(email: string, password: string): Promise<AuthResult> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password
    })

    if (error) {
      return { success: false, error: error.message }
    }

    if (!data.user || !data.session) {
      return { success: false, error: 'Falha ao criar sessão' }
    }

    const profileData = await fetchProfile(data.user.id, data.user.email || '')
    
    const user: User = {
      id: data.user.id,
      email: data.user.email || '',
      name: profileData.name
    }

    return { success: true, user }
  },

  async register(name: string, email: string, password: string): Promise<AuthResult> {
    const { data, error } = await supabase.auth.signUp({
      email: email.toLowerCase().trim(),
      password,
      options: {
        data: {
          name: name.trim()
        }
      }
    })

    if (error) {
      return { success: false, error: error.message }
    }

    if (!data.user) {
      return { success: false, error: 'Falha ao criar usuário' }
    }

    const user: User = {
      id: data.user.id,
      email: data.user.email || '',
      name: name.trim()
    }

    return { success: true, user }
  },

  async logout(): Promise<void> {
    await supabase.auth.signOut()
  },

  async getSession(): Promise<User | null> {
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (error || !session?.user) {
      return null
    }

    const profileData = await fetchProfile(session.user.id, session.user.email || '')
    
    return {
      id: session.user.id,
      email: session.user.email || '',
      name: profileData.name
    }
  },

  async getCurrentUser(): Promise<User | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    return {
      id: user.id,
      email: user.email || '',
      name: user.email?.split('@')[0] || ''
    }
  },

  async updateProfile(userId: string, name: string): Promise<AuthResult> {
    const { error } = await supabase
      .from('profiles')
      .update({ name: name.trim() })
      .eq('id', userId)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  },

  subscribeToAuthChanges(callback: (user: User | null) => void): () => void {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const profileData = await fetchProfile(session.user.id, session.user.email || '')
        callback({
          id: session.user.id,
          email: session.user.email || '',
          name: profileData.name
        })
      } else if (event === 'SIGNED_OUT') {
        callback(null)
      }
    })

    return subscription.unsubscribe
  }
}