import { NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/services/clients/auth";
import { listClients } from "@/services/clients";

export async function GET(req: Request) {
  try {
    const { supabase, userId } = await getAuthenticatedContext();

    const { searchParams } = new URL(req.url);
    const clientIdsParam = searchParams.get("clientIds");

    if (!clientIdsParam) {
      return NextResponse.json(
        { error: "clientIds are required" },
        { status: 400 }
      );
    }

    const clientIds = clientIdsParam.split(",").filter(Boolean);

    if (clientIds.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const { data: allCycles, error } = await supabase
      .from("billing_cycles")
      .select("client_id, cycle_year, cycle_month, paid_amount, expected_amount, due_date")
      .in("client_id", clientIds);

    if (error) {
      console.error("[API] GET /cycles/bulk - Error:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: allCycles || [] });
  } catch (error) {
    console.error("[API] GET /cycles/bulk - Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
