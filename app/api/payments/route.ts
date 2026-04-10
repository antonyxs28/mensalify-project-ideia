import { NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/services/clients/auth";

function calculateFirstDueDate(dueDay: number = 5): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const currentMonthDay = new Date(today.getFullYear(), today.getMonth(), dueDay);
  
  if (currentMonthDay >= today) {
    return currentMonthDay;
  }
  return new Date(today.getFullYear(), today.getMonth() + 1, dueDay);
}

function getMonthStr(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}-01`;
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

    const { client_id, month, amount: customAmount } = body as {
      client_id?: string;
      month?: string;
      amount?: number;
    };

    if (!client_id) {
      return NextResponse.json({ error: "client_id is required" }, { status: 400 });
    }

    const { data: client } = await supabase
      .from("clients")
      .select("id, monthly_price, due_day")
      .eq("id", client_id)
      .eq("user_id", userId)
      .single();

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    let year: number, monthPart: number;
    
    if (month) {
      const [y, m] = month.split("-").slice(0, 2).map(Number);
      year = y;
      monthPart = m;
    } else {
      const firstDue = calculateFirstDueDate(client.due_day || 5);
      year = firstDue.getFullYear();
      monthPart = firstDue.getMonth() + 1;
    }

    const monthStr = getMonthStr(year, monthPart);
    const now = new Date();

    console.log("[API] POST /payments - Processing payment:", {
      client_id,
      year,
      monthPart,
      monthStr,
      customAmount,
      monthlyPrice: client.monthly_price,
    });

    const { data: billingCycle } = await supabase
      .from("billing_cycles")
      .select("id, cycle_year, cycle_month, expected_amount, paid_amount")
      .eq("client_id", client_id)
      .eq("cycle_year", year)
      .eq("cycle_month", monthPart)
      .maybeSingle();

    const amount = customAmount || client.monthly_price;
    let newPaidAmount: number;
    let expectedAmount: number;
    let result: Record<string, unknown> | null = null;

    if (billingCycle) {
      const currentPaid = billingCycle.paid_amount || 0;
      const remaining = billingCycle.expected_amount - currentPaid;
      const paymentToApply = Math.min(amount, remaining);
      newPaidAmount = currentPaid + paymentToApply;
      expectedAmount = billingCycle.expected_amount;
    } else {
      newPaidAmount = Math.min(amount, amount);
      expectedAmount = amount;
    }

    const isFullPayment = newPaidAmount >= expectedAmount && newPaidAmount >= (billingCycle?.expected_amount || amount);
    const cycleStatus = isFullPayment 
      ? "paid" 
      : "partial";

    const dueDateStr = `${year}-${String(monthPart).padStart(2, "0")}-05`;

    console.log("[API] POST /payments - Payment calculations:", {
      billingCycleExists: !!billingCycle,
      currentPaidAmount: billingCycle?.paid_amount || 0,
      newAmount: amount,
      newPaidAmount,
      expectedAmount,
      isFullPayment,
      cycleStatus,
    });

    if (billingCycle) {
      const { data: updatedCycle, error } = await supabase
        .from("billing_cycles")
        .update({
          paid_amount: newPaidAmount,
          status: cycleStatus,
          updated_at: now.toISOString(),
        })
        .eq("id", billingCycle.id)
        .select()
        .single();

      if (error) {
        console.error("[API] POST /payments - Update cycle error:", error);
        return NextResponse.json(
          { error: `Failed to update cycle: ${error.message}` },
          { status: 400 },
        );
      }
      result = updatedCycle;
    } else {
      const { data: insertedCycle, error: insertError } = await supabase
        .from("billing_cycles")
        .insert({
          client_id,
          cycle_year: year,
          cycle_month: monthPart,
          due_date: dueDateStr,
          expected_amount: expectedAmount,
          paid_amount: newPaidAmount,
          status: cycleStatus,
        })
        .select()
        .single();

      if (insertError) {
        console.error("[API] POST /payments - Insert cycle error:", insertError);
        return NextResponse.json(
          { error: `Failed to create cycle: ${insertError.message}` },
          { status: 400 },
        );
      }
      result = insertedCycle;
    }

    const paymentRecord = {
      client_id,
      billing_cycle_id: result?.id || null,
      month: monthStr,
      amount: newPaidAmount,
      paid: isFullPayment,
      paid_at: isFullPayment ? now.toISOString() : null,
    };

    const { data: existingPayment } = await supabase
      .from("payments")
      .select("id")
      .eq("client_id", client_id)
      .eq("month", monthStr)
      .maybeSingle();

    if (existingPayment) {
      const { error } = await supabase
        .from("payments")
        .update(paymentRecord)
        .eq("id", existingPayment.id);

      if (error) {
        console.error("[API] POST /payments - Update payment error:", error);
      }
    } else {
      const { error } = await supabase
        .from("payments")
        .insert(paymentRecord);

      if (error) {
        console.error("[API] POST /payments - Insert payment error:", error);
      }
    }

    console.log("[API] POST /payments - Success:", {
      client_id,
      year,
      monthPart,
      newPaidAmount,
      expectedAmount,
      cycleStatus,
    });

    return NextResponse.json({ 
      data: { 
        ...result, 
        paid_amount: newPaidAmount,
        status: cycleStatus,
      } 
    }, { status: 201 });
  } catch (error) {
    console.error("[API] POST /payments - Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}