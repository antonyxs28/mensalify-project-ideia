// Input validation and sanitization utilities

/**
 * Sanitize string input to prevent XSS attacks
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim()
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Validate password strength
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
export function isStrongPassword(password: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (password.length < 8) {
    errors.push('A senha deve ter pelo menos 8 caracteres')
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('A senha deve conter pelo menos uma letra maiúscula')
  }
  if (!/[a-z]/.test(password)) {
    errors.push('A senha deve conter pelo menos uma letra minúscula')
  }
  if (!/\d/.test(password)) {
    errors.push('A senha deve conter pelo menos um número')
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('A senha deve conter pelo menos um caractere especial')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Validate name (minimum 2 characters, letters, spaces, accents and common special chars)
 */
export function isValidName(name: string): boolean {
  return name.length >= 2 && /^[\p{L}\s'-]+$/u.test(name.trim())
}

/**
 * Validate monetary value (positive number)
 */
export function isValidMonetaryValue(value: number): boolean {
  return typeof value === 'number' && value > 0 && isFinite(value)
}

/**
 * Format currency to BRL
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value)
}

/**
 * Format date to Brazilian format
 */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(date))
}

/**
 * Parse monetary input string to number
 */
export function parseMonetaryInput(input: string): number {
  const cleaned = input.replace(/[^\d,]/g, '').replace(',', '.')
  return parseFloat(cleaned) || 0
}
