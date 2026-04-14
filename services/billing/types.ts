import { z } from "zod";
import { type BillingCycle, type BillingPayment, type ServiceResult, type ClientBillingInfo } from "@/lib/types";

export { BillingCycle, BillingPayment, ServiceResult, ClientBillingInfo };

export interface BillingCycleWithPayments extends BillingCycle {
  payments: BillingPayment[];
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
  status: "pending" | "paid" | "overdue" | "partial" | "overpaid";
  isVirtual: boolean;
  createdAt: Date;
  updatedAt: Date | null;
}

export const cycleStatusSchema = z.enum(["pending", "paid", "overdue", "partial", "overpaid"]);

export const updateCycleSchema = z.object({
  status: z.enum(["pending", "paid", "overdue", "partial"]).optional(),
  expected_amount: z.number().positive().optional(),
  paid_amount: z.number().min(0).optional(),
});

export type UpdateCycleInput = z.infer<typeof updateCycleSchema>;

export const paymentSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
});

export type PaymentInput = z.infer<typeof paymentSchema>;