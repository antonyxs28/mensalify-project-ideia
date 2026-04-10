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

  if (cycle.client_id !== clientId) {
    return { success: false, error: "Cycle does not belong to this client" };
  }

  // Determine if this is a full payment (paying the remaining amount)
  const remainingAmount = cycle.expected_amount - cycle.paid_amount;
  const isFullPayment = paymentInput.amount >= remainingAmount;

  // For full payment, set paid amount to expected amount
  // For partial payment, add to existing paid amount
  const newPaidAmount = isFullPayment
    ? cycle.expected_amount
    : cycle.paid_amount + paymentInput.amount;

  const newStatus = computeStatus(
    newPaidAmount,
    cycle.expected_amount,
    cycle.due_date,
  );

  const paymentMonth = `${cycle.cycle_year}-${String(cycle.cycle_month).padStart(2, "0")}-01`;
  const { data: existingPayment } = await supabase
    .from("payments")
    .select("id, amount")
    .eq("client_id", clientId)
    .eq("month", paymentMonth)
    .maybeSingle();

  let payment: Record<string, unknown> | null = null;

  if (existingPayment) {
    const updatedAmount = existingPayment.amount + paymentInput.amount;
    const { data: updatedPayment, error: paymentError } = await supabase
      .from("payments")
      .update({
        amount: updatedAmount,
        paid: updatedAmount >= cycle.expected_amount,
        paid_at:
          updatedAmount >= cycle.expected_amount
            ? new Date().toISOString()
            : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingPayment.id)
      .select()
      .single();

    if (paymentError) {
      return { success: false, error: paymentError.message };
    }

    payment = updatedPayment;
  } else {
    const { data: insertedPayment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        client_id: clientId,
        billing_cycle_id: cycleId,
        month: paymentMonth,
        amount: paymentInput.amount,
        paid: newPaidAmount >= cycle.expected_amount,
        paid_at: newStatus === "paid" ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (paymentError) {
      return { success: false, error: paymentError.message };
    }

    payment = insertedPayment;
  }

  const { error: updateError } = await supabase
    .from("billing_cycles")
    .update({
      paid_amount: newPaidAmount,
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", cycleId);

  if (updateError) {
    console.warn(
      "[payCycle] Failed to update cycle status:",
      updateError.message,
    );
  }

  const { data: updatedCycle } = await supabase
    .from("billing_cycles")
    .select("*")
    .eq("id", cycleId)
    .single();

  console.log("[payCycle] DEBUG - Updated cycle:", {
    id: cycleId,
    paid_amount: newPaidAmount,
    expected_amount: cycle.expected_amount,
    status: newStatus,
    due_date: cycle.due_date,
  });

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
