import { SupabaseClient } from "@supabase/supabase-js";
import type { BillingCycle, ServiceResult } from "./types";

export async function listClientCycles(
  supabase: SupabaseClient,
  clientId: string
): Promise<ServiceResult<BillingCycle[]>> {
  const { data, error } = await supabase
    .from("billing_cycles")
    .select("*")
    .eq("client_id", clientId)
    .order("cycle_year", { ascending: false })
    .order("cycle_month", { ascending: false });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: data || [] };
}

export async function getCycle(
  supabase: SupabaseClient,
  cycleId: string
): Promise<ServiceResult<BillingCycle>> {
  const { data, error } = await supabase
    .from("billing_cycles")
    .select("*")
    .eq("id", cycleId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return { success: false, error: "Cycle not found" };
    }
    return { success: false, error: error.message };
  }

  return { success: true, data };
}

export async function getCycleWithPayments(
  supabase: SupabaseClient,
  cycleId: string
): Promise<ServiceResult<{ cycle: BillingCycle; payments: any[] }>> {
  const { data: cycle, error: cycleError } = await supabase
    .from("billing_cycles")
    .select("*")
    .eq("id", cycleId)
    .single();

  if (cycleError) {
    return { success: false, error: cycleError.message };
  }

  const { data: payments, error: paymentsError } = await supabase
    .from("payments")
    .select("*")
    .eq("billing_cycle_id", cycleId)
    .order("created_at", { ascending: true });

  if (paymentsError) {
    return { success: false, error: paymentsError.message };
  }

  return { success: true, data: { cycle, payments: payments || [] } };
}

export async function updateCycle(
  supabase: SupabaseClient,
  cycleId: string,
  updates: {
    status?: "pending" | "paid" | "overdue" | "partial";
    expected_amount?: number;
    paid_amount?: number;
  }
): Promise<ServiceResult<BillingCycle>> {
  const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() };
  
  if (updates.status) {
    updatePayload.status = updates.status;
  }
  if (updates.expected_amount !== undefined) {
    updatePayload.expected_amount = updates.expected_amount;
  }
  if (updates.paid_amount !== undefined) {
    updatePayload.paid_amount = updates.paid_amount;
  }

  const { data, error } = await supabase
    .from("billing_cycles")
    .update(updatePayload)
    .eq("id", cycleId)
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data };
}

export async function deleteCycle(
  supabase: SupabaseClient,
  cycleId: string
): Promise<ServiceResult<void>> {
  const { error } = await supabase
    .from("billing_cycles")
    .delete()
    .eq("id", cycleId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}