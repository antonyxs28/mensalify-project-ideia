import { SupabaseClient } from "@supabase/supabase-js";
import { getCycle, updateCycle } from "./cycles.service";
import type { ServiceResult, PaymentInput } from "./types";

function computeStatus(paidAmount: number, expectedAmount: number, dueDate: string): "pending" | "paid" | "overdue" | "partial" {
  const today = new Date().toISOString().split("T")[0];
  const isOverdue = today > dueDate;

  if (paidAmount >= expectedAmount) {
    return "paid";
  }
  if (paidAmount > 0) {
    return isOverdue ? "overdue" : "partial";
  }
  return isOverdue ? "overdue" : "pending";
}

export async function payCycle(
  supabase: SupabaseClient,
  cycleId: string,
  paymentInput: PaymentInput,
  clientId: string
): Promise<ServiceResult<{ payment: any; cycle: any }>> {
  const cycleResult = await getCycle(supabase, cycleId);
  if (!cycleResult.success || !cycleResult.data) {
    return { success: false, error: cycleResult.error || "Cycle not found" };
  }

  const cycle = cycleResult.data;
  
  if (cycle.client_id !== clientId) {
    return { success: false, error: "Cycle does not belong to this client" };
  }

  const newPaidAmount = cycle.paid_amount + paymentInput.amount;
  const newStatus = computeStatus(newPaidAmount, cycle.expected_amount, cycle.due_date);

  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .insert({
      client_id: clientId,
      billing_cycle_id: cycleId,
      month: `${cycle.cycle_year}-${String(cycle.cycle_month).padStart(2, "0")}-01`,
      amount: paymentInput.amount,
      paid: newPaidAmount >= cycle.expected_amount,
      paid_at: newStatus === "paid" ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (paymentError) {
    return { success: false, error: paymentError.message };
  }

  const { data: updatedCycle } = await supabase
    .from("billing_cycles")
    .select("*")
    .eq("id", cycleId)
    .single();

  if (!updatedCycle) {
    return { success: false, error: "Failed to fetch updated cycle" };
  }

  return {
    success: true,
    data: {
      payment,
      cycle: updatedCycle,
    },
  };
}