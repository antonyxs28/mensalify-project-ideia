import { NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/services/clients/auth";
import { listClients } from "@/services/clients";

export async function GET(req: Request) {
  try {
    const { supabase, userId } = await getAuthenticatedContext();

    const clientsResult = await listClients(supabase, userId);
    if (!clientsResult.success || !clientsResult.data) {
      return NextResponse.json({ error: "Failed to fetch clients" }, { status: 500 });
    }

    const clientIds = clientsResult.data.map((c) => c.id);

    if (clientIds.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const { data: payments, error } = await supabase
      .from("payments")
      .select("*")
      .in("client_id", clientIds)
      .order("month", { ascending: false });

    if (error) {
      console.error("[API] GET /payments/all - Error:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: payments || [] });
  } catch (error) {
    console.error("[API] GET /payments/all - Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
