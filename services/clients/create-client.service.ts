import { type SupabaseClient } from "@supabase/supabase-js";
import { Client, CreateClientData, ServiceResult } from "./types";

function getValidDueDate(year: number, month: number, dueDay: number): Date {
  const candidate = new Date(year, month - 1, dueDay);
  if (candidate.getMonth() !== month - 1) {
    return new Date(year, month, 0);
  }
  return candidate;
}

function getFirstValidDueDate(dueDay: number): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const currentMonthDue = getValidDueDate(
    today.getFullYear(),
    today.getMonth() + 1,
    dueDay,
  );

  if (currentMonthDue >= today) {
    return currentMonthDue;
  }

  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  return getValidDueDate(
    nextMonth.getFullYear(),
    nextMonth.getMonth() + 1,
    dueDay,
  );
}

function addMonths(year: number, month: number, amount: number) {
  const totalMonths = year * 12 + (month - 1) + amount;
  return {
    year: Math.floor(totalMonths / 12),
    month: (totalMonths % 12) + 1,
  };
}

interface CreateClientParams {
  supabase: SupabaseClient;
  userId: string;
  data: CreateClientData;
}

export async function createClient({
  supabase,
  userId,
  data,
}: CreateClientParams): Promise<ServiceResult<Client>> {
  const monthlyPriceNum =
    typeof data.monthly_price === "string"
      ? Number(data.monthly_price)
      : data.monthly_price;

  const insertData: Record<string, unknown> = {
    user_id: userId,
    name: data.name.trim(),
    email: data.email?.trim() || null,
    phone: data.phone?.trim() || null,
    monthly_price: monthlyPriceNum,
  };

  if (data.due_day !== undefined && data.due_day >= 1 && data.due_day <= 31) {
    insertData.due_day = data.due_day;
  } else {
    insertData.due_day = 5;
  }

  if (data.billing_type) {
    insertData.billing_type = data.billing_type;
  }

  const totalInstallments =
    data.total_installments || data.number_of_cycles || 1;
  const billingType = data.billing_type || "monthly";

  if (data.total_installments) {
    insertData.total_installments = data.total_installments;
  } else if (data.number_of_cycles) {
    insertData.number_of_cycles = data.number_of_cycles;
    insertData.total_installments = data.number_of_cycles;
  } else {
    insertData.total_installments = 1;
  }

  insertData.billing_type = billingType;

  console.log("[DEBUG] Insert data:", JSON.stringify(insertData));

  const { data: result, error } = await supabase
    .from("clients")
    .insert(insertData)
    .select()
    .single();

  console.log(
    "[DEBUG] Supabase insert result:",
    result ? JSON.stringify(result) : "null",
  );
  console.log(
    "[DEBUG] Supabase insert error:",
    error ? JSON.stringify(error) : "null",
  );

  if (error) {
    console.error("[DB] createClient - Full error:", JSON.stringify(error));
    console.error("[DB] createClient - Error code:", error.code);
    return {
      success: false,
      error: `Failed to create client: ${error.message}`,
    };
  }

  console.log("[DB] createClient - Result:", JSON.stringify(result));

  if (result && totalInstallments > 0) {
    const dueDay = (insertData.due_day as number) || 5;
    const billingTypeName = (insertData.billing_type as string) || "monthly";

    const cycles = [];
    let currentDate = getFirstValidDueDate(dueDay);

    for (let i = 0; i < totalInstallments; i++) {
      const cycleYear = currentDate.getFullYear();
      const cycleMonth = currentDate.getMonth() + 1;
      const referenceDate = new Date(cycleYear, cycleMonth - 1, 1);
      const dueDate = getValidDueDate(cycleYear, cycleMonth, dueDay);

      cycles.push({
        client_id: result.id,
        cycle_year: cycleYear,
        cycle_month: cycleMonth,
        reference_date: referenceDate.toISOString().split("T")[0],
        due_date: dueDate.toISOString().split("T")[0],
        expected_amount: monthlyPriceNum,
        paid_amount: 0,
        status: "pending" as const,
      });

      if (billingTypeName === "monthly") {
        const next = addMonths(cycleYear, cycleMonth, 1);
        currentDate = getValidDueDate(next.year, next.month, dueDay);
      } else if (billingTypeName === "weekly") {
        const next = new Date(currentDate);
        next.setDate(next.getDate() + 7);
        currentDate = next;
      } else if (billingTypeName === "yearly") {
        currentDate = getValidDueDate(cycleYear + 1, cycleMonth, dueDay);
      }
    }

    console.log(
      "[DEBUG] Generating cycles:",
      cycles.map((c) => ({
        year: c.cycle_year,
        month: c.cycle_month,
        due_date: c.due_date,
        expected: c.expected_amount,
      })),
    );

    if (cycles.length > 0) {
      const { error: cyclesError } = await supabase
        .from("billing_cycles")
        .upsert(cycles, { onConflict: "client_id,cycle_year,cycle_month" });

      if (cyclesError) {
        console.warn("[DB] Failed to create cycles:", cyclesError.message);
      }
    }
  }

  return { success: true, data: result };
}
