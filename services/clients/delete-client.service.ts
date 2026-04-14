import { type SupabaseClient } from "@supabase/supabase-js";
import { ServiceResult } from "./types";
import { logDev } from "@/lib/utils";

interface DeleteClientParams {
  supabase: SupabaseClient;
  userId: string;
  clientId: string;
}

export async function deleteClient({
  supabase,
  userId,
  clientId,
}: DeleteClientParams): Promise<ServiceResult<void>> {
  logDev("[DEBUG] deleteClient - clientId:", clientId, "userId:", userId);

  const { error } = await supabase
    .from("clients")
    .delete()
    .eq("id", clientId)
    .eq("user_id", userId);

  if (error) {
    console.error("[DB] deleteClient - Full error:", JSON.stringify(error));
    return {
      success: false,
      error: `Failed to delete client: ${error.message}`,
    };
  }

  logDev("[DB] deleteClient - Success");
  return { success: true };
}