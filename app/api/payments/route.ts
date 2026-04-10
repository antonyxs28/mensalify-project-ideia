import { NextResponse } from "next/server";

import { getAuthenticatedContext } from "@/services/clients/auth";

function getCurrentMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function getCurrentMonthForDb(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

export async function POST(req: Request) {
  try {
    console.log("[API] POST /payments - Starting");

    const { supabase, userId } = await getAuthenticatedContext();
    console.log("[API] POST /payments - User ID:", userId);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { client_id, month, paid = true } = body as {
      client_id?: string;
      month?: string;
      paid?: boolean;
    };

    if (!client_id) {
      return NextResponse.json({ error: "client_id is required" }, { status: 400 });
    }

    const monthStr = month || getCurrentMonthForDb();

    console.log("[API] POST /payments - client_id:", client_id, "month:", monthStr);

    const { data: existingPayment } = await supabase
      .from("payments")
      .select("id")
      .eq("client_id", client_id)
      .eq("month", monthStr)
      .single();

    let result;
    if (existingPayment) {
      const { data, error } = await supabase
        .from("payments")
        .update({
          paid,
          paid_at: paid ? new Date().toISOString() : null,
        })
        .eq("id", existingPayment.id)
        .select()
        .single();

      if (error) {
        console.error("[API] POST /payments - Update error:", error);
        return NextResponse.json(
          { error: `Failed to update payment: ${error.message}` },
          { status: 400 },
        );
      }
      result = data;
    } else {
      const { data, error } = await supabase
        .from("payments")
        .insert({
          client_id,
          month: monthStr,
          paid,
          paid_at: paid ? new Date().toISOString() : null,
        })
        .select()
        .single();

      if (error) {
        console.error("[API] POST /payments - Insert error:", error);
        return NextResponse.json(
          { error: `Failed to create payment: ${error.message}` },
          { status: 400 },
        );
      }
      result = data;
    }

    console.log("[API] POST /payments - Success, id:", result?.id);
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    console.error("[API] POST /payments - Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}