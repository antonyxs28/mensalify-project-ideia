'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Mail, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { authService } from '@/services/auth.service'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

export default function ConfirmEmailPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get('email') || ''

  const [isResending, setIsResending] = useState(false)

  const handleResend = async () => {
    if (!email) return

    setIsResending(true)
    try {
      const result = await authService.resendConfirmation(email)

      if (result.success) {
        toast.success('Email resent successfully!')
      } else {
        toast.error('Failed to resend email. Try again.')
      }
    } catch {
      toast.error('Failed to resend email. Try again.')
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-md"
      >
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-foreground">Mensalify</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Subscription management simplified
          </p>
        </div>

        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="space-y-1">
            <div className="flex justify-center mb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Mail className="h-8 w-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl font-semibold text-center">
              Check your email
            </CardTitle>
            <CardDescription className="text-center">
              We sent a confirmation link to{' '}
              <span className="font-medium text-foreground">{email}</span>
            </CardDescription>
          </CardHeader>

          <CardContent>
            <p className="text-sm text-muted-foreground text-center">
              Click the link in the email to activate your account.
            </p>
          </CardContent>

          <CardFooter className="flex flex-col gap-4">
            <Button
              onClick={handleResend}
              className="w-full"
              disabled={isResending || !email}
              variant="outline"
            >
              {isResending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                'Resend email'
              )}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link
                href="/login"
                className="font-medium text-primary hover:underline"
              >
                Back to login
              </Link>
            </p>
          </CardFooter>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </motion.div>
    </div>
  )
}
