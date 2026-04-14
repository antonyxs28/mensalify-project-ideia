import { NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/services/clients/auth";

export async function GET() {
  try {
    const { supabase, userId } = await getAuthenticatedContext();
    
    const { data: { session } } = await supabase.auth.getSession();
    
    return NextResponse.json({ session });
  } catch (error) {
    console.error("[API] GET /auth/session - Error:", error);
    return NextResponse.json({ session: null });
  }
}
