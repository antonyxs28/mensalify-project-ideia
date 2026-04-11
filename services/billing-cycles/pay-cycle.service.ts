import { SupabaseClient } from "@supabase/supabase-js";
import { getCycle, updateCycle } from "./cycles.service";
import type { ServiceResult, PaymentInput } from "./types";

function computeStatus(
  paidAmount: number,
  expectedAmount: number,
  dueDate?: string,
): "pending" | "paid" | "overdue" | "partial" {
  const today = new Date().toISOString().split("T")[0];
  const isOverdue = dueDate ? today > dueDate : false;

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
  clientId: string,
): Promise<ServiceResult<{ payment: any; cycle: any }>> {
  const cycleResult = await getCycle(supabase, cycleId);
  if (!cycleResult.success || !cycleResult.data) {
    return { success: false, error: cycleResult.error || "Cycle not found" };
  }

  const cycle = cycleResult.data;

  const recentPaymentCount = await supabase
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("billing_cycle_id", cycleId)
    .gte("created_at", new Date(Date.now() - 2000).toISOString());

  if (recentPaymentCount.count && recentPaymentCount.count > 0) {
    return { success: false, error: "Concurrent payment detected. Please wait 2 seconds before retrying." };
  }

  if (cycle.client_id !== clientId) {
    return { success: false, error: "Cycle does not belong to this client" };
  }

  const remainingAmount = cycle.expected_amount - cycle.paid_amount;
  const isFullPayment = paymentInput.amount >= remainingAmount;

  const newPaidAmount = isFullPayment
    ? cycle.expected_amount
    : cycle.paid_amount + paymentInput.amount;

  const newStatus = computeStatus(
    newPaidAmount,
    cycle.expected_amount,
    cycle.due_date,
  );

  const paymentMonth = `${cycle.cycle_year}-${String(cycle.cycle_month).padStart(2, "0")}-01`;

  const { data: upsertedPayment, error: paymentError } = await supabase
    .from("payments")
    .upsert(
      {
        client_id: clientId,
        billing_cycle_id: cycleId,
        month: paymentMonth,
        amount: newPaidAmount,
        paid: newPaidAmount >= cycle.expected_amount,
        paid_at: newStatus === "paid" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "client_id,month" }
    )
    .select()
    .single();

  if (paymentError) {
    return { success: false, error: paymentError.message };
  }

  const payment = upsertedPayment;

  const { error: updateError } = await supabase
    .from("billing_cycles")
    .update({
      paid_amount: newPaidAmount,
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", cycleId);

  if (updateError) {
    console.warn("[payCycle] Failed to update cycle status:", updateError.message);
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