import { z } from "zod";

export interface BillingCycle {
  id: string;
  client_id: string;
  cycle_year: number;
  cycle_month: number;
  reference_date?: string;
  due_date?: string;
  expected_amount: number;
  paid_amount: number;
  status?: "pending" | "paid" | "overdue" | "partial";
  created_at?: string;
  updated_at?: string | null;
}

export interface BillingCycleWithPayments extends BillingCycle {
  payments: Payment[];
}

export interface Payment {
  id: string;
  client_id: string;
  billing_cycle_id: string | null;
  month: string;
  amount: number;
  paid: boolean;
  paid_at: string | null;
  created_at: string;
}

export interface NormalizedBillingCycle {
  id: string;
  clientId: string;
  year: number;
  month: number;
  referenceDate: Date;
  dueDate: Date;
  expectedAmount: number;
  paidAmount: number;
  status: "pending" | "paid" | "overdue" | "partial";
  isVirtual: boolean;
  createdAt: Date;
  updatedAt: Date | null;
}

export const cycleStatusSchema = z.enum(["pending", "paid", "overdue", "partial"]);

export const updateCycleSchema = z.object({
  status: cycleStatusSchema.optional(),
  expected_amount: z.number().positive().optional(),
  paid_amount: z.number().min(0).optional(),
});

export type UpdateCycleInput = z.infer<typeof updateCycleSchema>;

export const paymentSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
});

export type PaymentInput = z.infer<typeof paymentSchema>;

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}