'use client'

import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { authService } from '@/services/auth.service'
import type { AuthState, User } from '@/lib/types'

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  updateProfile: (name: string) => Promise<{ success: boolean; error?: string }>
}

const AuthContext = createContext<AuthContextType | null>(null)

const AUTH_TIMEOUT_MS = 10000

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true
  })
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const initialized = useRef(false)

  const stopLoading = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setState(prev => ({ ...prev, isLoading: false }))
  }, [])

  const setAuthenticated = useCallback((user: User) => {
    stopLoading()
    setState({
      user,
      isAuthenticated: true,
      isLoading: false
    })
  }, [stopLoading])

  const setUnauthenticated = useCallback(() => {
    stopLoading()
    setState({
      user: null,
      isAuthenticated: false,
      isLoading: false
    })
  }, [stopLoading])

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const initAuth = async () => {
      timeoutRef.current = setTimeout(() => {
        console.warn('Auth initialization timeout - forcing stop loading')
        setUnauthenticated()
      }, AUTH_TIMEOUT_MS)

      try {
        const user = await authService.getSession()
        
        if (user) {
          setAuthenticated(user)
        } else {
          setUnauthenticated()
        }
      } catch (error) {
        console.error('Auth initialization error:', error)
        setUnauthenticated()
      }
    }

    initAuth()

    const unsubscribe = authService.subscribeToAuthChanges((user) => {
      if (user) {
        setAuthenticated(user)
      } else {
        setUnauthenticated()
      }
    })

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      unsubscribe()
    }
  }, [setAuthenticated, setUnauthenticated])

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const result = await authService.login(email, password)
    
    if (result.success && result.user) {
      setAuthenticated(result.user)
    }
    
    return result
  }, [setAuthenticated])

  const register = useCallback(async (name: string, email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const result = await authService.register(name, email, password)
    
    if (result.success && result.user) {
      setAuthenticated(result.user)
    }
    
    return result
  }, [setAuthenticated])

  const logout = useCallback(async () => {
    await authService.logout()
    setState({
      user: null,
      isAuthenticated: false,
      isLoading: false
    })
    router.replace('/login')
  }, [router])

  const updateProfile = useCallback(async (name: string): Promise<{ success: boolean; error?: string }> => {
    if (!state.user) {
      return { success: false, error: 'Usuário não autenticado' }
    }

    const result = await authService.updateProfile(state.user.id, name)
    
    if (result.success) {
      setState(prev => ({
        ...prev,
        user: prev.user ? { ...prev.user, name: name.trim() } : null
      }))
    }
    
    return result
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