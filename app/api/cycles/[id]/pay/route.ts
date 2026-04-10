import { NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/services/clients/auth";
import { payCycle, paymentSchema, getCycle } from "@/services/billing-cycles";
import { getClient } from "@/services/clients";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const { id: cycleId } = await params;
    console.log("[API] POST /cycles/[id]/pay - cycleId:", cycleId);

    const { supabase, userId } = await getAuthenticatedContext();

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = paymentSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map((e) => e.message).join(", ");
      return NextResponse.json({ error: errors }, { status: 400 });
    }

    try {
      const cycleResult = await getCycle(supabase, cycleId);
      if (!cycleResult.success || !cycleResult.data) {
        return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
      }

      const clientResult = await getClient(supabase, userId, cycleResult.data.client_id);
      if (!clientResult.success) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }

      const payResult = await payCycle(supabase, cycleId, parsed.data, cycleResult.data.client_id);
      if (!payResult.success) {
        return NextResponse.json({ error: payResult.error }, { status: 400 });
      }

      return NextResponse.json({ data: payResult.data }, { status: 201 });
    } catch (cycleError) {
      console.warn("[API] Billing system error:", cycleError);
      return NextResponse.json({ error: "Billing system not available" }, { status: 503 });
    }
  } catch (error) {
    console.error("[API] POST /cycles/[id]/pay - Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}