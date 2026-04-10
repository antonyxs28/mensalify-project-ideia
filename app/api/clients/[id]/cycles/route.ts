import { NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/services/clients/auth";
import { listClientCycles } from "@/services/billing-cycles";
import { getClient } from "@/services/clients";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { id: clientId } = await params;
    console.log("[API] GET /clients/[id]/cycles - clientId:", clientId);

    const { supabase, userId } = await getAuthenticatedContext();
    console.log("[API] User ID:", userId);

    const clientResult = await getClient(supabase, userId, clientId);
    console.log("[API] Client result:", clientResult);
    
    if (!clientResult.success || !clientResult.data) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    try {
      const cyclesResult = await listClientCycles(supabase, clientId);
      console.log("[API] Cycles result:", cyclesResult);
      
      if (!cyclesResult.success) {
        return NextResponse.json({ error: cyclesResult.error }, { status: 500 });
      }

      return NextResponse.json({ data: cyclesResult.data });
    } catch (cycleError) {
      console.warn("[API] billing_cycles table not available:", cycleError);
      return NextResponse.json({ data: [] });
    }
  } catch (error) {
    console.error("[API] GET /clients/[id]/cycles - Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}