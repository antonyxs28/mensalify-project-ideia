import { NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/services/clients/auth";
import { getCycleWithPayments, updateCycle, updateCycleSchema } from "@/services/billing";
import { getClient } from "@/services/clients";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { id: cycleId } = await params;
    if (process.env.NODE_ENV === 'development') {
      console.log("[API] GET /cycles/[id] - cycleId:", cycleId);
    }

    const { supabase, userId } = await getAuthenticatedContext();

    try {
      const cycleResult = await getCycleWithPayments(supabase, cycleId);
      if (!cycleResult.success || !cycleResult.data) {
        return NextResponse.json({ error: cycleResult.error || "Cycle not found" }, { status: 404 });
      }

      const clientResult = await getClient(supabase, userId, cycleResult.data.cycle.client_id);
      if (!clientResult.success) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }

      return NextResponse.json({ 
        data: {
          cycle: cycleResult.data.cycle,
          payments: cycleResult.data.payments,
        }
      });
    } catch (cycleError) {
      if (process.env.NODE_ENV === 'development') {
        console.warn("[API] billing_cycles not available:", cycleError);
      }
      return NextResponse.json({ error: "Billing system not available" }, { status: 503 });
    }
  } catch (error) {
    console.error("[API] GET /cycles/[id] - Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request, { params }: RouteParams) {
  try {
    const { id: cycleId } = await params;
    if (process.env.NODE_ENV === 'development') {
      console.log("[API] PUT /cycles/[id] - cycleId:", cycleId);
    }

    const { supabase, userId } = await getAuthenticatedContext();

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = updateCycleSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map((e) => e.message).join(", ");
      return NextResponse.json({ error: errors }, { status: 400 });
    }

    const cycleResult = await getCycleWithPayments(supabase, cycleId);
    if (!cycleResult.success || !cycleResult.data) {
      return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
    }

    const clientResult = await getClient(supabase, userId, cycleResult.data.cycle.client_id);
    if (!clientResult.success) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const updateResult = await updateCycle(supabase, cycleId, parsed.data);
    if (!updateResult.success) {
      return NextResponse.json({ error: updateResult.error }, { status: 400 });
    }

    return NextResponse.json({ data: updateResult.data });
  } catch (error) {
    console.error("[API] PUT /cycles/[id] - Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}