import { NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/services/clients/auth";
import { getClient } from "@/services/clients";

export async function GET(req: Request) {
  try {
    const { supabase, userId } = await getAuthenticatedContext();

    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");

    if (!clientId) {
      return NextResponse.json(
        { error: "clientId is required" },
        { status: 400 }
      );
    }

    const clientResult = await getClient(supabase, userId, clientId);
    if (!clientResult.success || !clientResult.data) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const { data: payments, error } = await supabase
      .from("payments")
      .select("*")
      .eq("client_id", clientId)
      .order("month", { ascending: false });

    if (error) {
      console.error("[API] GET /payments - Error:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: payments || [] });
  } catch (error) {
    console.error("[API] GET /payments - Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { supabase, userId } = await getAuthenticatedContext();

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { client_id, month, paid, paid_at } = body as {
      client_id: string;
      month: string;
      paid?: boolean;
      paid_at?: string | null;
    };

    if (!client_id || !month) {
      return NextResponse.json(
        { error: "client_id and month are required" },
        { status: 400 }
      );
    }

    const clientResult = await getClient(supabase, userId, client_id);
    if (!clientResult.success || !clientResult.data) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("payments")
      .insert({
        client_id,
        month,
        paid: paid ?? false,
        paid_at: paid_at ?? (paid ? new Date().toISOString() : null),
      })
      .select()
      .single();

    if (error) {
      console.error("[API] POST /payments - Error:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error("[API] POST /payments - Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
