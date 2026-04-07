'use client'

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { User as SupabaseUser, AuthState } from '@/lib/types'

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  updateProfile: (name: string) => Promise<{ success: boolean; error?: string }>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true
  })

  const fetchProfile = useCallback(async (userId: string, email: string) => {
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
  }, [])

  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session?.user) {
          const user = session.user
          const profileData = await fetchProfile(user.id, user.email || '')
          
          setState({
            user: {
              id: user.id,
              email: user.email || '',
              name: profileData.name
            },
            isAuthenticated: true,
            isLoading: false
          })
        } else {
          setState(prev => ({ ...prev, isLoading: false }))
        }
      } catch (error) {
        console.error('Auth initialization error:', error)
        setState(prev => ({ ...prev, isLoading: false }))
      }
    }

    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const user = session.user
        const profileData = await fetchProfile(user.id, user.email || '')
        
        setState({
          user: {
            id: user.id,
            email: user.email || '',
            name: profileData.name
          },
          isAuthenticated: true,
          isLoading: false
        })
      } else {
        setState({
          user: null,
          isAuthenticated: false,
          isLoading: false
        })
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [fetchProfile])

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password
      })

      if (error) {
        return { success: false, error: error.message }
      }

      if (data.user) {
        const profileData = await fetchProfile(data.user.id, data.user.email || '')
        
        setState({
          user: {
            id: data.user.id,
            email: data.user.email || '',
            name: profileData.name
          },
          isAuthenticated: true,
          isLoading: false
        })
      }

      return { success: true }
    } catch (error) {
      console.error('Login error:', error)
      return { success: false, error: 'Ocorreu um erro inesperado. Tente novamente.' }
    }
  }, [fetchProfile])

  const register = useCallback(async (name: string, email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
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

      if (data.user) {
        setState({
          user: {
            id: data.user.id,
            email: data.user.email || '',
            name: name.trim()
          },
          isAuthenticated: true,
          isLoading: false
        })
      }

      return { success: true }
    } catch (error) {
      console.error('Registration error:', error)
      return { success: false, error: 'Ocorreu um erro inesperado. Tente novamente.' }
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await supabase.auth.signOut()
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false
      })
      router.push('/login')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }, [router])

  const updateProfile = useCallback(async (name: string): Promise<{ success: boolean; error?: string }> => {
    if (!state.user) {
      return { success: false, error: 'Usuário não autenticado' }
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ name: name.trim() })
        .eq('id', state.user.id)

      if (error) {
        return { success: false, error: error.message }
      }

      setState(prev => ({
        ...prev,
        user: prev.user ? { ...prev.user, name: name.trim() } : null
      }))

      return { success: true }
    } catch (error) {
      console.error('Profile update error:', error)
      return { success: false, error: 'Ocorreu um erro inesperado. Tente novamente.' }
    }
  }, [state.user])

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
