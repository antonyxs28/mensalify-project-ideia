import { type SupabaseClient } from "@supabase/supabase-js";
import { Client, ServiceResult, UpdateClientInput } from "./types";

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
  console.log(
    "[DEBUG] updateClient - clientId:",
    clientId,
    "userId:",
    userId,
    "data:",
    JSON.stringify(data),
  );

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
    updateData.monthly_price = priceNum;
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

  console.log("[DB] updateClient - Result:", JSON.stringify(result));
  return { success: true, data: result };
}