import { NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/services/clients/auth";
import { getClient } from "@/services/clients";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { id: paymentId } = await params;
    const { supabase, userId } = await getAuthenticatedContext();

    const { data: payment, error: fetchError } = await supabase
      .from("payments")
      .select("*, client:clients!inner(id, user_id)")
      .eq("id", paymentId)
      .single();

    if (fetchError || !payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    if (payment.client?.user_id !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    return NextResponse.json({ data: payment });
  } catch (error) {
    console.error("[API] GET /payments/[id] - Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const { id: paymentId } = await params;
    const { supabase, userId } = await getAuthenticatedContext();

    const { data: payment, error: fetchError } = await supabase
      .from("payments")
      .select("*, client:clients!inner(id, user_id)")
      .eq("id", paymentId)
      .single();

    if (fetchError || !payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    if (payment.client?.user_id !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { paid, paid_at } = body as {
      paid?: boolean;
      paid_at?: string | null;
    };

    const updateData: Record<string, unknown> = {};
    if (paid !== undefined) updateData.paid = paid;
    if (paid_at !== undefined) updateData.paid_at = paid_at;
    else if (paid === true && paid_at === undefined) updateData.paid_at = new Date().toISOString();
    else if (paid === false) updateData.paid_at = null;

    const { data, error } = await supabase
      .from("payments")
      .update(updateData)
      .eq("id", paymentId)
      .select()
      .single();

    if (error) {
      console.error("[API] PATCH /payments/[id] - Error:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("[API] PATCH /payments/[id] - Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const { id: paymentId } = await params;
    const { supabase, userId } = await getAuthenticatedContext();

    const { data: payment, error: fetchError } = await supabase
      .from("payments")
      .select("*, client:clients!inner(id, user_id)")
      .eq("id", paymentId)
      .single();

    if (fetchError || !payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    if (payment.client?.user_id !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { error } = await supabase
      .from("payments")
      .delete()
      .eq("id", paymentId);

    if (error) {
      console.error("[API] DELETE /payments/[id] - Error:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] DELETE /payments/[id] - Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
