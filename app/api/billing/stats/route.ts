import { NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/services/clients/auth";
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

    for (const client of clients) {
      const { data: cycles } = await supabase
        .from("billing_cycles")
        .select("*, payments!billing_cycles_id(*)")
        .eq("client_id", client.id)
        .order("cycle_year", { ascending: false })
        .order("cycle_month", { ascending: false });

      if (cycles && cycles.length > 0) {
        for (const cycle of cycles) {
          totalCycles++;
          totalExpected += cycle.expected_amount || 0;
          totalReceived += cycle.paid_amount || 0;

          const status = cycle.status || 'pending';
          switch (status) {
            case 'paid':
              paidCycles++;
              break;
            case 'pending':
              pendingCycles++;
              break;
            case 'partial':
              partialCycles++;
              break;
            case 'overdue':
              overdueCycles++;
              break;
            default:
              pendingCycles++;
          }

          if (cycle.cycle_year === currentYear && cycle.cycle_month === currentMonth) {
            currentMonthRevenue += cycle.paid_amount || 0;
          }
        }
      } else {
        totalExpected += client.monthly_price || 0;
        
        const monthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
        const { data: payments } = await supabase
          .from("payments")
          .select("amount, paid, paid_at, month")
          .eq("client_id", client.id)
          .order("month", { ascending: false });

        if (payments && payments.length > 0) {
          totalCycles += payments.length;
          
          const currentMonthPayment = payments.find((p: any) => p.month === monthStr);
          if (currentMonthPayment) {
            if (currentMonthPayment.paid) {
              paidCycles++;
              currentMonthRevenue += currentMonthPayment.amount || 0;
            } else {
              pendingCycles++;
            }
          } else {
            pendingCycles++;
          }

          const paidPayments = payments.filter((p: any) => p.paid && p.amount);
          totalReceived += paidPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
        } else {
          totalCycles++;
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