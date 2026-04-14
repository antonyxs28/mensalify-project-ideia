import { type SupabaseClient } from "@supabase/supabase-js";
import { type Client, type ServiceResult, type ClientBillingInfo } from "@/lib/types";
import { type CreateClientData } from "./types";

function buildLocalDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function getValidDueDate(year: number, month: number, dueDay: number): Date {
  const candidate = buildLocalDate(year, month, dueDay);
  if (candidate.getMonth() !== month - 1) {
    return buildLocalDate(year, month + 1, 0);
  }
  return candidate;
}

function parseClientBaseDate(createdAt?: string | null): Date {
  if (!createdAt) {
    const fallback = new Date();
    fallback.setHours(12, 0, 0, 0);
    return fallback;
  }

  const createdDate = new Date(createdAt);
  if (isNaN(createdDate.getTime())) {
    const fallback = new Date();
    fallback.setHours(12, 0, 0, 0);
    return fallback;
  }

  createdDate.setHours(12, 0, 0, 0);
  return createdDate;
}

function getFirstDueDate(dueDay: number, createdAt: string): Date {
  const base = new Date(createdAt);
  // Always start from the next month after creation
  return new Date(base.getFullYear(), base.getMonth() + 1, dueDay, 12, 0, 0, 0);
}

export async function rebuildClientBillingCycles(
  supabase: SupabaseClient,
  client: ClientBillingInfo,
): Promise<ServiceResult<{ rebuilt: number }>> {
  const dueDay = Number(client.due_day || 5);
  const billingType = client.billing_type || "monthly";
  const totalInstallments =
    client.total_installments || client.number_of_cycles || 1;

  const cycles = [];
  let currentDueDate = getFirstDueDate(dueDay, client.created_at);

  for (let i = 0; i < totalInstallments; i++) {
    const cycleYear = currentDueDate.getFullYear();
    const cycleMonth = currentDueDate.getMonth() + 1;
    const referenceDate = buildLocalDate(cycleYear, cycleMonth, 1);

    cycles.push({
      client_id: client.id,
      cycle_year: cycleYear,
      cycle_month: cycleMonth,
      reference_date: formatLocalDate(referenceDate),
      due_date: formatLocalDate(currentDueDate),
      expected_amount: client.monthly_price,
      paid_amount: 0,
      status: "pending" as const,
    });

    if (billingType === "monthly") {
      currentDueDate = new Date(
        currentDueDate.getFullYear(),
        currentDueDate.getMonth() + 1,
        dueDay, 12, 0, 0, 0,
      );
    } else if (billingType === "weekly") {
      currentDueDate = new Date(
        currentDueDate.getTime() + 7 * 24 * 60 * 60 * 1000,
      );
    } else if (billingType === "yearly") {
      currentDueDate = new Date(
        currentDueDate.getFullYear() + 1,
        currentDueDate.getMonth(),
        dueDay, 12, 0, 0, 0,
      );
    }
  }

  // Busca ciclos existentes para preservar paid_amount
  const { data: existingCycles } = await supabase
    .from("billing_cycles")
    .select("cycle_year, cycle_month, paid_amount, status")
    .eq("client_id", client.id);

  const existingMap = new Map(
    (existingCycles || []).map((c: any) => [
      `${c.cycle_year}-${c.cycle_month}`,
      { paid_amount: c.paid_amount, status: c.status },
    ])
  );

  // Mescla preservando pagamentos existentes
  const cyclesToUpsert = cycles.map((cycle) => {
    const key = `${cycle.cycle_year}-${cycle.cycle_month}`;
    const existing = existingMap.get(key);
    return existing
      ? { ...cycle, paid_amount: existing.paid_amount, status: existing.status }
      : cycle;
  });

  // Delete apenas ciclos que NÃO existem no novo set (ciclos órfãos)
  const { error: deleteError } = await supabase
    .from("billing_cycles")
    .delete()
    .eq("client_id", client.id)
    .not(
      "cycle_month",
      "in",
      `(${cyclesToUpsert.map((c) => c.cycle_month).join(",")})`,
    );

  if (deleteError) {
    return { success: false, error: deleteError.message };
  }

  if (cyclesToUpsert.length > 0) {
    const { error: upsertError } = await supabase
      .from("billing_cycles")
      .upsert(cyclesToUpsert, {
        onConflict: "client_id,cycle_year,cycle_month",
        ignoreDuplicates: false,
      });

    if (upsertError) {
      return { success: false, error: upsertError.message };
    }
  }

  return { success: true, data: { rebuilt: cyclesToUpsert.length } };
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

  if (process.env.NODE_ENV === 'development') {
    console.log("[DEBUG] Insert data:", JSON.stringify(insertData));
  }

  const { data: result, error } = await supabase
    .from("clients")
    .insert(insertData)
    .select()
    .single();

  if (process.env.NODE_ENV === 'development') {
    console.log(
      "[DEBUG] Supabase insert result:",
      result ? JSON.stringify(result) : "null",
    );
    console.log(
      "[DEBUG] Supabase insert error:",
      error ? JSON.stringify(error) : "null",
    );
  }

  if (error) {
    console.error("[DB] createClient - Full error:", JSON.stringify(error));
    console.error("[DB] createClient - Error code:", error.code);
    return {
      success: false,
      error: `Failed to create client: ${error.message}`,
    };
  }

  if (process.env.NODE_ENV === 'development') {
    console.log("[DB] createClient - Result:", JSON.stringify(result));
  }

  if (result && totalInstallments > 0) {
    const dueDay = (insertData.due_day as number) || 5;
    const billingTypeName = (insertData.billing_type as string) || "monthly";

    const cycles = [];
    let currentDueDate = getFirstDueDate(dueDay, result.created_at);

    for (let i = 0; i < totalInstallments; i++) {
      const cycleYear = currentDueDate.getFullYear();
      const cycleMonth = currentDueDate.getMonth() + 1;
      const referenceDate = buildLocalDate(cycleYear, cycleMonth, 1);

      cycles.push({
        client_id: result.id,
        cycle_year: cycleYear,
        cycle_month: cycleMonth,
        reference_date: formatLocalDate(referenceDate),
        due_date: formatLocalDate(currentDueDate),
        expected_amount: monthlyPriceNum,
        paid_amount: 0,
        status: "pending" as const,
      });

      // Advance to next cycle based on billing type
      if (billingTypeName === "monthly") {
        currentDueDate = new Date(
          currentDueDate.getFullYear(),
          currentDueDate.getMonth() + 1,
          dueDay,
          12,
          0,
          0,
          0,
        );
      } else if (billingTypeName === "weekly") {
        currentDueDate = new Date(
          currentDueDate.getTime() + 7 * 24 * 60 * 60 * 1000,
        );
      } else if (billingTypeName === "yearly") {
        currentDueDate = new Date(
          currentDueDate.getFullYear() + 1,
          currentDueDate.getMonth(),
          dueDay,
          12,
          0,
          0,
          0,
        );
      }
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(
        "[DEBUG] Generating cycles:",
        cycles.map((c) => ({
          year: c.cycle_year,
          month: c.cycle_month,
          due_date: c.due_date,
          expected: c.expected_amount,
        })),
      );
    }

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
