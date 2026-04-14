import { type SupabaseClient } from "@supabase/supabase-js";
import { Client, ServiceResult } from "./types";
import { logDev } from "@/lib/utils";

export async function listClients(
  supabase: SupabaseClient,
  userId: string,
): Promise<ServiceResult<Client[]>> {
  logDev("[DEBUG] Querying for user_id:", userId);

  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  logDev("[DEBUG] Supabase select result:", JSON.stringify(data));
  logDev("[DEBUG] Supabase select error:", error ? JSON.stringify(error) : "null");

  if (error) {
    console.error(
      "[DB] listClients - Full error:",
      JSON.stringify(error),
    );
    return { success: false, error: `Database error: ${error.message}` };
  }

  logDev("[DB] listClients - Got data:", data?.length || 0, "records");
  return { success: true, data: data || [] };
}