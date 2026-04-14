import { type SupabaseClient } from "@supabase/supabase-js";
import { Client, ServiceResult } from "./types";

export async function getClient(
  supabase: SupabaseClient,
  userId: string,
  clientId: string,
): Promise<ServiceResult<Client>> {
  if (process.env.NODE_ENV === 'development') {
    console.log("[DEBUG] getClient - clientId:", clientId, "userId:", userId);
  }

  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .eq("user_id", userId)
    .single();

  if (error) {
    console.error("[DB] getClient - Full error:", JSON.stringify(error));
    return { success: false, error: `Client not found: ${error.message}` };
  }

  if (process.env.NODE_ENV === 'development') {
    console.log("[DB] getClient - Result:", JSON.stringify(data));
  }
  return { success: true, data };
}