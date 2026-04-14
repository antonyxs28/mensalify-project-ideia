import { type SupabaseClient } from "@supabase/supabase-js";
import { Client, ServiceResult } from "./types";

export async function listClients(
  supabase: SupabaseClient,
  userId: string,
): Promise<ServiceResult<Client[]>> {
  if (process.env.NODE_ENV === 'development') {
    console.log("[DEBUG] Querying for user_id:", userId);
  }

  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (process.env.NODE_ENV === 'development') {
    console.log("[DEBUG] Supabase select result:", JSON.stringify(data));
    console.log(
      "[DEBUG] Supabase select error:",
      error ? JSON.stringify(error) : "null",
    );
  }

  if (error) {
    console.error(
      "[DB] listClients - Full error:",
      JSON.stringify(error),
    );
    return { success: false, error: `Database error: ${error.message}` };
  }

  if (process.env.NODE_ENV === 'development') {
    console.log(
      "[DB] listClients - Got data:",
      data?.length || 0,
      "records",
    );
  }
  return { success: true, data: data || [] };
}