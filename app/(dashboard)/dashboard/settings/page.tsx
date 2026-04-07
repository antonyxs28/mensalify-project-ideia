'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { User, Mail, Lock, Bell, Shield, Loader2, Check } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

import { useAuth } from '@/contexts/auth-context'
import { isValidEmail, isValidName, isStrongPassword, sanitizeInput } from '@/lib/validation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { FieldGroup, Field, FieldLabel, FieldError } from '@/components/ui/field'
import { Separator } from '@/components/ui/separator'

export default function SettingsPage() {
  const { user, updateProfile } = useAuth()
  
  const [name, setName] = useState(user?.name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)
  const [profileErrors, setProfileErrors] = useState<{ name?: string }>({})

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)
  const [passwordErrors, setPasswordErrors] = useState<{ 
    current?: string
    new?: string
    confirm?: string 
  }>({})

  const [emailNotifications, setEmailNotifications] = useState(true)
  const [paymentReminders, setPaymentReminders] = useState(true)
  const [weeklyReport, setWeeklyReport] = useState(false)

  useEffect(() => {
    if (user) {
      setName(user.name || '')
      setEmail(user.email || '')
    }
  }, [user])

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const errors: typeof profileErrors = {}
    const sanitizedName = sanitizeInput(name)
    
    if (!sanitizedName || !isValidName(sanitizedName)) {
      errors.name = 'Digite um nome válido'
    }
    
    setProfileErrors(errors)
    if (Object.keys(errors).length > 0) return
    
    setIsUpdatingProfile(true)
    
    try {
      const result = await updateProfile(sanitizedName || '')
      if (result.success) {
        toast.success('Perfil atualizado com sucesso!')
      } else {
        toast.error(result.error || 'Erro ao atualizar perfil')
      }
    } catch {
      toast.error('Ocorreu um erro inesperado')
    } finally {
      setIsUpdatingProfile(false)
    }
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const errors: typeof passwordErrors = {}
    
    if (!currentPassword) {
      errors.current = 'Digite sua senha atual'
    }
    
    const passwordCheck = isStrongPassword(newPassword)
    if (!passwordCheck.isValid) {
      errors.new = passwordCheck.errors[0]
    }
    
    if (newPassword !== confirmPassword) {
      errors.confirm = 'As senhas não coincidem'
    }
    
    setPasswordErrors(errors)
    if (Object.keys(errors).length > 0) return
    
    setIsUpdatingPassword(true)
    
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })
      
      if (error) {
        toast.error(error.message || 'Erro ao atualizar senha')
      } else {
        toast.success('Senha atualizada com sucesso!')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      }
    } catch {
      toast.error('Ocorreu um erro inesperado')
    } finally {
      setIsUpdatingPassword(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">
          Configurações
        </h1>
        <p className="mt-1 text-muted-foreground">
          Gerencie seu perfil e preferências
        </p>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Profile Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg font-semibold text-foreground">
                  Perfil
                </CardTitle>
              </div>
              <CardDescription>
                Atualize suas informações pessoais
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateProfile}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="profile-name">Nome</FieldLabel>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="profile-name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="pl-10"
                        disabled={isUpdatingProfile}
                      />
                    </div>
                    {profileErrors.name && <FieldError>{profileErrors.name}</FieldError>}
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="profile-email">Email</FieldLabel>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="profile-email"
                        type="email"
                        value={email}
                        className="pl-10"
                        disabled
                      />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      O email não pode ser alterado
                    </p>
                  </Field>

                  <Button type="submit" disabled={isUpdatingProfile} className="w-full">
                    {isUpdatingProfile ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Salvar Alterações
                      </>
                    )}
                  </Button>
                </FieldGroup>
              </form>
            </CardContent>
          </Card>
        </motion.div>

        {/* Password Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg font-semibold text-foreground">
                  Segurança
                </CardTitle>
              </div>
              <CardDescription>
                Altere sua senha de acesso
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdatePassword}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="current-password">Senha Atual</FieldLabel>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="current-password"
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="pl-10"
                        disabled={isUpdatingPassword}
                      />
                    </div>
                    {passwordErrors.current && <FieldError>{passwordErrors.current}</FieldError>}
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="new-password">Nova Senha</FieldLabel>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="new-password"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="pl-10"
                        disabled={isUpdatingPassword}
                      />
                    </div>
                    {passwordErrors.new && <FieldError>{passwordErrors.new}</FieldError>}
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="confirm-password">Confirmar Nova Senha</FieldLabel>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pl-10"
                        disabled={isUpdatingPassword}
                      />
                    </div>
                    {passwordErrors.confirm && <FieldError>{passwordErrors.confirm}</FieldError>}
                  </Field>

                  <Button type="submit" disabled={isUpdatingPassword} className="w-full">
                    {isUpdatingPassword ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Atualizando...
                      </>
                    ) : (
                      <>
                        <Shield className="mr-2 h-4 w-4" />
                        Atualizar Senha
                      </>
                    )}
                  </Button>
                </FieldGroup>
              </form>
            </CardContent>
          </Card>
        </motion.div>

        {/* Notification Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2"
        >
          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg font-semibold text-foreground">
                  Notificações
                </CardTitle>
              </div>
              <CardDescription>
                Configure suas preferências de notificação
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Notificações por Email</p>
                  <p className="text-sm text-muted-foreground">
                    Receba atualizações importantes por email
                  </p>
                </div>
                <Switch
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                  aria-label="Ativar notificações por email"
                />
              </div>
              
              <Separator className="bg-border/50" />
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Lembretes de Pagamento</p>
                  <p className="text-sm text-muted-foreground">
                    Receba lembretes sobre pagamentos pendentes
                  </p>
                </div>
                <Switch
                  checked={paymentReminders}
                  onCheckedChange={setPaymentReminders}
                  aria-label="Ativar lembretes de pagamento"
                />
              </div>
              
              <Separator className="bg-border/50" />
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Relatório Semanal</p>
                  <p className="text-sm text-muted-foreground">
                    Receba um resumo semanal das suas métricas
                  </p>
                </div>
                <Switch
                  checked={weeklyReport}
                  onCheckedChange={setWeeklyReport}
                  aria-label="Ativar relatório semanal"
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
