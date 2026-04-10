import { SupabaseClient } from "@supabase/supabase-js";
import type { BillingCycle, ServiceResult } from "./types";

interface Client {
  id: string;
  monthly_price: number;
  billing_start_date: string | null;
  is_active: boolean;
  user_id: string;
}

interface PaymentRecord {
  id: string;
  amount: number;
  billing_cycle_id: string | null;
  paid_at: string | null;
  created_at: string;
}

function computeStatus(
  paidAmount: number,
  expectedAmount: number,
  dueDate: string
): BillingCycle["status"] {
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

export function calculateCycleStatus(
  cycle: Pick<BillingCycle, "paid_amount" | "expected_amount" | "due_date">
): BillingCycle["status"] {
  return computeStatus(cycle.paid_amount, cycle.expected_amount, cycle.due_date);
}

function calculateDueDate(cycleYear: number, cycleMonth: number): string {
  const nextMonth = new Date(cycleYear, cycleMonth - 1 + 1, 1);
  const dueDate = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 5);
  return dueDate.toISOString().split("T")[0];
}

export async function generateBillingCycles(
  supabase: SupabaseClient,
  client: Client,
  options: { upToMonth?: Date } = {}
): Promise<ServiceResult<{ generated: number; existing: number }>> {
  const upToDate = options.upToMonth || new Date();
  
  if (!client.is_active || !client.billing_start_date) {
    return { success: true, data: { generated: 0, existing: 0 } };
  }

  const startDate = new Date(client.billing_start_date);
  const endDate = new Date(upToDate);

  if (startDate > endDate) {
    return { success: true, data: { generated: 0, existing: 0 } };
  }

  const startYear = startDate.getFullYear();
  const startMonth = startDate.getMonth() + 1;
  const endYear = endDate.getFullYear();
  const endMonth = endDate.getMonth() + 1;

  const cycles: Array<{
    client_id: string;
    cycle_year: number;
    cycle_month: number;
    due_date: string;
    expected_amount: number;
    paid_amount: number;
    status: "pending";
  }> = [];

  for (let year = startYear; year <= endYear; year++) {
    const monthStart = year === startYear ? startMonth : 1;
    const monthEnd = year === endYear ? endMonth : 12;

    for (let month = monthStart; month <= monthEnd; month++) {
      cycles.push({
        client_id: client.id,
        cycle_year: year,
        cycle_month: month,
        due_date: calculateDueDate(year, month),
        expected_amount: client.monthly_price,
        paid_amount: 0,
        status: "pending",
      });
    }
  }

  if (cycles.length === 0) {
    return { success: true, data: { generated: 0, existing: 0 } };
  }

  const { data: existingCycles, error: fetchError } = await supabase
    .from("billing_cycles")
    .select("cycle_year, cycle_month")
    .eq("client_id", client.id)
    .gte("cycle_year", startYear)
    .lte("cycle_year", endYear);

  if (fetchError) {
    return { success: false, error: fetchError.message };
  }

  const existingSet = new Set(
    (existingCycles || []).map((c) => `${c.cycle_year}-${c.cycle_month}`)
  );

  const newCycles = cycles.filter(
    (c) => !existingSet.has(`${c.cycle_year}-${c.cycle_month}`)
  );

  if (newCycles.length > 0) {
    const { error: insertError } = await supabase
      .from("billing_cycles")
      .upsert(newCycles, {
        onConflict: "client_id,cycle_year,cycle_month",
        ignoreDuplicates: true,
      });

    if (insertError) {
      return { success: false, error: insertError.message };
    }
  }

  return {
    success: true,
    data: {
      generated: newCycles.length,
      existing: cycles.length - newCycles.length,
    },
  };
}

export async function addPaymentToCycle(
  supabase: SupabaseClient,
  cycleId: string,
  amount: number,
  options: { skipStatusUpdate?: boolean } = {}
): Promise<ServiceResult<BillingCycle>> {
  const { data: cycle, error: fetchError } = await supabase
    .from("billing_cycles")
    .select("*")
    .eq("id", cycleId)
    .single();

  if (fetchError || !cycle) {
    return { success: false, error: "Cycle not found" };
  }

  const newPaidAmount = cycle.paid_amount + amount;
  const newStatus = computeStatus(newPaidAmount, cycle.expected_amount, cycle.due_date);

  const monthStr = `${cycle.cycle_year}-${String(cycle.cycle_month).padStart(2, "0")}-01`;

  const { error: paymentError } = await supabase.from("payments").insert({
    client_id: cycle.client_id,
    billing_cycle_id: cycleId,
    month: monthStr,
    amount,
    paid: newPaidAmount >= cycle.expected_amount,
    paid_at: newStatus === "paid" ? new Date().toISOString() : null,
  });

  if (paymentError) {
    return { success: false, error: paymentError.message };
  }

  if (!options.skipStatusUpdate) {
    const { error: updateError } = await supabase
      .from("billing_cycles")
      .update({
        paid_amount: newPaidAmount,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", cycleId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }
  }

  const { data: updatedCycle } = await supabase
    .from("billing_cycles")
    .select("*")
    .eq("id", cycleId)
    .single();

  return { success: true, data: updatedCycle! };
}

interface ClientFinancialSummary {
  totalExpected: number;
  totalPaid: number;
  totalPending: number;
  totalOverdue: number;
  totalCycles: number;
  paidCycles: number;
  pendingCycles: number;
  partialCycles: number;
  overdueCycles: number;
  averagePaymentTime: number | null;
  nextPaymentDue: {
    cycleId: string;
    amount: number;
    dueDate: string;
  } | null;
}

export async function computeClientFinancialSummary(
  supabase: SupabaseClient,
  clientId: string
): Promise<ServiceResult<ClientFinancialSummary>> {
  const { data: cycles, error: cyclesError } = await supabase
    .from("billing_cycles")
    .select("*")
    .eq("client_id", clientId)
    .order("cycle_year", { ascending: true })
    .order("cycle_month", { ascending: true });

  if (cyclesError) {
    return { success: false, error: cyclesError.message };
  }

  const summary: ClientFinancialSummary = {
    totalExpected: 0,
    totalPaid: 0,
    totalPending: 0,
    totalOverdue: 0,
    totalCycles: 0,
    paidCycles: 0,
    pendingCycles: 0,
    partialCycles: 0,
    overdueCycles: 0,
    averagePaymentTime: null,
    nextPaymentDue: null,
  };

  const paymentTimes: number[] = [];

  const { data: allPayments, error: paymentsError } = await supabase
    .from("payments")
    .select("id, amount, billing_cycle_id, paid_at, created_at")
    .eq("client_id", clientId)
    .not("paid_at", "is", null);

  if (!paymentsError && allPayments) {
    const paidCycleIds = new Set(
      allPayments
        .filter((p: PaymentRecord) => p.paid_at)
        .map((p: PaymentRecord) => p.billing_cycle_id)
    );

    for (const cycle of cycles || []) {
      if (paidCycleIds.has(cycle.id) && cycle.due_date) {
        const cyclePayments = allPayments.filter(
          (p: PaymentRecord) => p.billing_cycle_id === cycle.id && p.paid_at
        );
        if (cyclePayments.length > 0) {
          const lastPaidAt = new Date(
            cyclePayments[cyclePayments.length - 1].paid_at!
          );
          const dueDate = new Date(cycle.due_date);
          const diffDays = Math.floor(
            (lastPaidAt.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
          );
          if (diffDays >= 0) {
            paymentTimes.push(diffDays);
          }
        }
      }
    }
  }

  for (const cycle of cycles || []) {
    summary.totalCycles++;
    summary.totalExpected += cycle.expected_amount;
    summary.totalPaid += cycle.paid_amount;

    switch (cycle.status) {
      case "paid":
        summary.paidCycles++;
        break;
      case "pending":
        summary.pendingCycles++;
        summary.totalPending += cycle.expected_amount - cycle.paid_amount;
        break;
      case "partial":
        summary.partialCycles++;
        summary.totalPending += cycle.expected_amount - cycle.paid_amount;
        break;
      case "overdue":
        summary.overdueCycles++;
        summary.totalOverdue += cycle.expected_amount - cycle.paid_amount;
        break;
    }
  }

  if (paymentTimes.length > 0) {
    const avgTime =
      paymentTimes.reduce((sum, t) => sum + t, 0) / paymentTimes.length;
    summary.averagePaymentTime = Math.round(avgTime);
  }

  const pendingOrPartial = (cycles || []).filter(
    (c) => c.status === "pending" || c.status === "partial" || c.status === "overdue"
  );

  if (pendingOrPartial.length > 0) {
    const next = pendingOrPartial[0];
    summary.nextPaymentDue = {
      cycleId: next.id,
      amount: next.expected_amount - next.paid_amount,
      dueDate: next.due_date,
    };
  }

  return { success: true, data: summary };
}