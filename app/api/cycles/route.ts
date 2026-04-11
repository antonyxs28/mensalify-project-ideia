import { NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/services/clients/auth";
import { getClient } from "@/services/clients";

export async function POST(req: Request) {
  try {
    const { supabase, userId } = await getAuthenticatedContext();

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const {
      client_id,
      cycle_year,
      cycle_month,
      expected_amount,
    } = body as {
      client_id: string;
      cycle_year: number;
      cycle_month: number;
      expected_amount?: number;
    };

    if (!client_id || !cycle_year || !cycle_month) {
      return NextResponse.json(
        { error: "client_id, cycle_year and cycle_month are required" },
        { status: 400 }
      );
    }

    const clientResult = await getClient(supabase, userId, client_id);
    if (!clientResult.success) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const client = clientResult.data;
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const expectedAmount = expected_amount || client.monthly_price;
    const dueDate = new Date(cycle_year, cycle_month - 1, 5);
    const dueDateStr = dueDate.toISOString().split("T")[0];

    const { data: cycle, error: cycleError } = await supabase
      .from("billing_cycles")
      .upsert(
        {
          client_id,
          cycle_year,
          cycle_month,
          due_date: dueDateStr,
          expected_amount: expectedAmount,
          paid_amount: 0,
          status: "pending",
        },
        { onConflict: "client_id,cycle_year,cycle_month" }
      )
      .select()
      .single();

    if (cycleError) {
      console.error("[API] POST /cycles - Cycle error:", cycleError);
      return NextResponse.json(
        { error: `Failed to create cycle: ${cycleError.message}` },
        { status: 400 }
      );
    }

    return NextResponse.json({ data: cycle }, { status: 201 });
  } catch (error) {
    console.error("[API] POST /cycles - Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}