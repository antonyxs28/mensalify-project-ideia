import { z } from "zod";

export interface BillingCycle {
  id: string;
  client_id: string;
  cycle_year: number;
  cycle_month: number;
  due_date: string;
  expected_amount: number;
  paid_amount: number;
  status: "pending" | "paid" | "overdue" | "partial";
  created_at: string;
  updated_at: string | null;
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