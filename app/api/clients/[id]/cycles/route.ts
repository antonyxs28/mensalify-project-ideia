import { NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/services/clients/auth";
import { getClient } from "@/services/clients";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function computeStatus(paidAmount: number, expectedAmount: number, dueDate: string): "pending" | "paid" | "overdue" | "partial" {
  const today = new Date().toISOString().split("T")[0];
  const isOverdue = dueDate ? today > dueDate : false;

  if (paidAmount >= expectedAmount && paidAmount > 0) {
    return "paid";
  }
  if (paidAmount > 0) {
    return isOverdue ? "overdue" : "partial";
  }
  return isOverdue ? "overdue" : "pending";
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
      console.log("[API] Query billing_cycles for client_id:", clientId);
      
      const { data: cycles, error: cyclesError } = await supabase
        .from("billing_cycles")
        .select("*")
        .eq("client_id", clientId)
        .order("cycle_year", { ascending: false })
        .order("cycle_month", { ascending: false });

      console.log("[API] billing_cycles result:", { count: cycles?.length, error: cyclesError });

      if (cyclesError) {
        console.warn("[API] billing_cycles query error:", cyclesError.message);
        return NextResponse.json({ error: cyclesError.message }, { status: 500 });
      }

      if (cycles && cycles.length > 0) {
        console.log("[API] Returning cycles from billing_cycles table:", cycles.length);
        
        const processedCycles = cycles.map((cycle: any) => ({
          ...cycle,
          reference_date: cycle.reference_date || `${cycle.cycle_year}-${String(cycle.cycle_month).padStart(2, "0")}-01`,
          status: computeStatus(cycle.paid_amount, cycle.expected_amount, cycle.due_date),
        }));
        
        console.log("[API] DEBUG - Processed cycles:", processedCycles.map((c: any) => ({
          id: c.id,
          year: c.cycle_year,
          month: c.cycle_month,
          paid_amount: c.paid_amount,
          expected_amount: c.expected_amount,
          status: c.status,
        })));
        
        return NextResponse.json({ data: processedCycles });
      }

      console.log("[API] No cycles in billing_cycles table - returning empty array");
      return NextResponse.json({ data: [] });
    } catch (cycleError) {
      console.error("[API] billing_cycles error:", cycleError);
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