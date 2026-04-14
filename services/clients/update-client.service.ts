import { type SupabaseClient } from "@supabase/supabase-js";
import { Client, ServiceResult, UpdateClientInput } from "./types";
import { rebuildClientBillingCycles } from "./create-client.service";
import { logDev } from "@/lib/utils";

interface UpdateClientParams {
  supabase: SupabaseClient;
  userId: string;
  clientId: string;
  data: UpdateClientInput;
}

export async function updateClient({
  supabase,
  userId,
  clientId,
  data,
}: UpdateClientParams): Promise<ServiceResult<Client>> {
  logDev("[DEBUG] updateClient - clientId:", clientId, "userId:", userId);

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) {
    updateData.name = data.name.trim();
  }
  if (data.email !== undefined) {
    updateData.email = data.email?.trim() || null;
  }
  if (data.phone !== undefined) {
    updateData.phone = data.phone?.trim() || null;
  }
  if (data.monthly_price !== undefined) {
    const priceNum =
      typeof data.monthly_price === "string"
        ? Number(data.monthly_price)
        : data.monthly_price;
    if (isNaN(priceNum) || priceNum <= 0) {
      return { success: false, error: "monthly_price must be a positive number" };
    }
    updateData.monthly_price = priceNum;
  }

  if (data.due_day !== undefined) {
    const dueDayNum = typeof data.due_day === "string" ? Number(data.due_day) : data.due_day;
    if (isNaN(dueDayNum) || dueDayNum < 1 || dueDayNum > 31) {
      return { success: false, error: "due_day must be between 1 and 31" };
    }
    updateData.due_day = dueDayNum;
  }

  if (data.billing_type !== undefined) {
    updateData.billing_type = data.billing_type;
  }

  if (data.total_installments !== undefined) {
    if (data.total_installments < 1 || data.total_installments > 120) {
      return { success: false, error: "total_installments must be between 1 and 120" };
    }
    updateData.total_installments = data.total_installments;
  }

  if (data.number_of_cycles !== undefined) {
    if (data.number_of_cycles !== null && (data.number_of_cycles < 1 || data.number_of_cycles > 120)) {
      return { success: false, error: "number_of_cycles must be between 1 and 120" };
    }
    updateData.number_of_cycles = data.number_of_cycles;
  }

  if (data.created_at !== undefined) {
    updateData.created_at = data.created_at;
  }

  const rebuildFields = [
    "created_at",
    "due_day",
    "billing_type",
    "total_installments",
    "number_of_cycles",
  ];
  let shouldRebuildCycles = false;

  for (const field of rebuildFields) {
    if (data[field as keyof UpdateClientInput] !== undefined) {
      shouldRebuildCycles = true;
      break;
    }
  }

  if (Object.keys(updateData).length === 0) {
    return { success: false, error: "No fields to update" };
  }

  const { data: result, error } = await supabase
    .from("clients")
    .update(updateData)
    .eq("id", clientId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    console.error("[DB] updateClient - Full error:", JSON.stringify(error));
    return {
      success: false,
      error: `Failed to update client: ${error.message}`,
    };
  }

  if (shouldRebuildCycles && result) {
    const clientBeforeUpdate = { ...result };
    
    const rebuildResult = await rebuildClientBillingCycles(supabase, {
      id: clientId,
      monthly_price: Number(result.monthly_price),
      created_at: result.created_at,
      due_day: result.due_day,
      billing_type: result.billing_type,
      total_installments: result.total_installments,
      number_of_cycles: result.number_of_cycles,
    });

    if (!rebuildResult.success) {
      console.error(
        "[DB] updateClient - Failed to rebuild billing cycles, rolling back client update:",
        rebuildResult.error,
      );

      const { error: rollbackError } = await supabase
        .from("clients")
        .update({
          name: clientBeforeUpdate.name,
          email: clientBeforeUpdate.email,
          phone: clientBeforeUpdate.phone,
          monthly_price: clientBeforeUpdate.monthly_price,
          due_day: clientBeforeUpdate.due_day,
          billing_type: clientBeforeUpdate.billing_type,
          total_installments: clientBeforeUpdate.total_installments,
          number_of_cycles: clientBeforeUpdate.number_of_cycles,
        })
        .eq("id", clientId)
        .eq("user_id", userId);

      if (rollbackError) {
        console.error("[DB] updateClient - Rollback failed, DB may be inconsistent:", rollbackError);
        return {
          success: false,
          error: `Critical: Update failed and rollback failed. Manual intervention required. Original error: ${rebuildResult.error}`,
        };
      }

      return {
        success: false,
        error: `Failed to rebuild billing cycles: ${rebuildResult.error}. Client update has been rolled back.`,
      };
    }
  }

  logDev("[DB] updateClient - Result:", JSON.stringify(result));
  return { success: true, data: result };
}
