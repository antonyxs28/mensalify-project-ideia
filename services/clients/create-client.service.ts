import { type SupabaseClient } from "@supabase/supabase-js";
import { Client, CreateClientInput, ServiceResult } from "./types";

interface CreateClientParams {
  supabase: SupabaseClient;
  userId: string;
  data: CreateClientInput;
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

  const insertData = {
    user_id: userId,
    name: data.name.trim(),
    email: data.email?.trim() || null,
    phone: data.phone?.trim() || null,
    monthly_price: monthlyPriceNum,
  };

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
  return { success: true, data: result };
}