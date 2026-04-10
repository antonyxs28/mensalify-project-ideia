import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

interface RevenueItem {
  date: string
  amount: number
}

interface MonthlyRevenue {
  month: string
  total: number
}

export function groupRevenueByMonth(data: RevenueItem[]): MonthlyRevenue[] {
  const grouped = data.reduce<Record<string, number>>((acc, item) => {
    const month = item.date.slice(0, 7)
    acc[month] = (acc[month] || 0) + item.amount
    return acc
  }, {})

  return Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, total]) => ({ month, total }))
}

function getMonthKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getFullYear(), date.getMonth() + months, 1)
  return result
}

export function generateLastNMonths(n: number): string[] {
  const months: string[] = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    months.push(getMonthKey(addMonths(now, -i)))
  }
  return months
}

export function fillMissingMonths(
  data: RevenueItem[],
  monthsCount: number = 6
): MonthlyRevenue[] {
  const allMonths = generateLastNMonths(monthsCount)
  
  const grouped = data.reduce<Record<string, number>>((acc, item) => {
    const month = item.date.slice(0, 7)
    acc[month] = (acc[month] || 0) + item.amount
    return acc
  }, {})

  return allMonths.map((month) => ({
    month,
    total: grouped[month] || 0,
  }))
}

const MONTH_NAMES = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
]

export function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-')
  const monthIndex = parseInt(month, 10) - 1
  return `${MONTH_NAMES[monthIndex]} ${year.slice(2)}`
}
