import { NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/services/clients/auth";
import { listClients } from "@/services/clients";

function computeStatus(
  paidAmount: number,
  expectedAmount: number,
  dueDate: string,
): "pending" | "paid" | "overdue" | "partial" {
  const today = new Date().toISOString().split("T")[0];
  const isOverdue = dueDate ? today > dueDate : false;

  if (paidAmount >= expectedAmount) return "paid";
  if (paidAmount > 0) return "partial";
  return isOverdue ? "overdue" : "pending";
}

export async function GET() {
  try {
    const { supabase, userId } = await getAuthenticatedContext();

    const clientsResult = await listClients(supabase, userId);
    if (!clientsResult.success || !clientsResult.data) {
      return NextResponse.json({ error: "Failed to fetch clients" }, { status: 500 });
    }

    const clients = clientsResult.data;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    let totalReceived = 0;
    let totalExpected = 0;
    let overdueCycles = 0;
    let currentMonthRevenue = 0;
    let totalCycles = 0;
    let paidCycles = 0;
    let pendingCycles = 0;
    let partialCycles = 0;

    // Busca todos os ciclos de uma vez só (sem N+1 queries)
    const clientIds = clients.map((c) => c.id);

    const { data: allCycles } = await supabase
      .from("billing_cycles")
      .select("client_id, cycle_year, cycle_month, due_date, expected_amount, paid_amount")
      .in("client_id", clientIds);

    for (const cycle of allCycles || []) {
      const status = computeStatus(
        cycle.paid_amount || 0,
        cycle.expected_amount || 0,
        cycle.due_date,
      );

      totalCycles++;
      totalExpected += cycle.expected_amount || 0;
      totalReceived += cycle.paid_amount || 0;

      switch (status) {
        case "paid":       paidCycles++;     break;
        case "pending":    pendingCycles++;  break;
        case "partial":    partialCycles++;  break;
        case "overdue":    overdueCycles++;  break;
      }

      if (
        cycle.cycle_year === currentYear &&
        cycle.cycle_month === currentMonth
      ) {
        currentMonthRevenue += cycle.paid_amount || 0;
      }
    }

    return NextResponse.json({
      data: {
        totalReceived,
        totalExpected,
        overdueCycles,
        currentMonthRevenue,
        totalCycles,
        paidCycles,
        pendingCycles,
        partialCycles,
      },
    });
  } catch (error) {
    console.error("[API] GET /billing/stats - Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}