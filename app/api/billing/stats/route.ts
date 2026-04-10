import { NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/services/clients/auth";
import { computeClientFinancialSummary } from "@/services/billing-cycles/billing.service";
import { listClients } from "@/services/clients";

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

    try {
      for (const client of clients) {
        const summaryResult = await computeClientFinancialSummary(supabase, client.id);
        if (summaryResult.success && summaryResult.data) {
          const summary = summaryResult.data;
          totalReceived += summary.totalPaid;
          totalExpected += summary.totalExpected;
          overdueCycles += summary.overdueCycles;
          pendingCycles += summary.pendingCycles;
          partialCycles += summary.partialCycles;
          paidCycles += summary.paidCycles;
          totalCycles += summary.totalCycles;
        }

        const { data: currentCycle } = await supabase
          .from("billing_cycles")
          .select("paid_amount")
          .eq("client_id", client.id)
          .eq("cycle_year", currentYear)
          .eq("cycle_month", currentMonth)
          .maybeSingle();

        if (currentCycle) {
          currentMonthRevenue += currentCycle.paid_amount;
        }
      }
    } catch (billingError) {
      console.warn("[API] billing_cycles not available, using fallback:", billingError);
      
      for (const client of clients) {
        totalExpected += client.monthly_price;
        totalCycles++;
        
        const monthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
        const { data: currentPayment } = await supabase
          .from("payments")
          .select("paid")
          .eq("client_id", client.id)
          .eq("month", monthStr)
          .maybeSingle();
        
        if (currentPayment?.paid) {
          paidCycles++;
          totalReceived += client.monthly_price;
          currentMonthRevenue += client.monthly_price;
        } else {
          pendingCycles++;
        }
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