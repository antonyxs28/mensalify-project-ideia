import type { BillingCycle, NormalizedBillingCycle } from "./types";

export function getCurrentMonthKey(): { year: number; month: number } {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  };
}

export function getMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function parseReferenceDate(
  referenceDate: string,
  year: number,
  month: number,
): Date {
  if (!referenceDate || referenceDate === "null") {
    return new Date(year, month - 1, 1);
  }
  const date = new Date(referenceDate);
  if (isNaN(date.getTime())) {
    return new Date(year, month - 1, 1);
  }
  return date;
}

function getValidDueDate(year: number, month: number, dueDay: number): Date {
  const candidate = new Date(year, month - 1, dueDay);
  if (candidate.getMonth() !== month - 1) {
    return new Date(year, month, 0);
  }
  return candidate;
}

export function calculateFirstDueDate(dueDay: number = 5): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const currentMonthDay = getValidDueDate(
    today.getFullYear(),
    today.getMonth() + 1,
    dueDay,
  );

  if (currentMonthDay >= today) {
    return currentMonthDay;
  }

  return getValidDueDate(today.getFullYear(), today.getMonth() + 2, dueDay);
}

export function calculateDueDate(
  year: number,
  month: number,
  dueDay: number = 5,
): Date {
  return getValidDueDate(year, month, dueDay);
}

const OVERDUE_LIMITS = {
  weekly: 7,
  monthly: 30,
  yearly: 365,
};

export function computeStatus(
  paidAmount: number,
  expectedAmount: number,
  dueDate: Date,
  billingType: string = "monthly",
): NormalizedBillingCycle["status"] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);

  const daysOverdue = Math.floor(
    (today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24),
  );
  const limit =
    OVERDUE_LIMITS[billingType as keyof typeof OVERDUE_LIMITS] ||
    OVERDUE_LIMITS.monthly;
  const isOverdue = daysOverdue > limit;
  const isCriticallyOverdue = daysOverdue > limit * 2;

  if (paidAmount >= expectedAmount && paidAmount > 0) {
    return "paid";
  }
  if (paidAmount > 0) {
    return isCriticallyOverdue ? "overdue" : "partial";
  }
  return isCriticallyOverdue ? "overdue" : "pending";
}

export function normalizeCycle(
  cycle: BillingCycle | Record<string, unknown>,
  isVirtual: boolean = false,
): NormalizedBillingCycle {
  const expectedAmount = Number(cycle.expected_amount) || 0;
  const paidAmount = Number(cycle.paid_amount) || 0;

  const referenceDate = parseReferenceDate(
    (cycle.reference_date as string) || "",
    Number(cycle.cycle_year) || new Date().getFullYear(),
    Number(cycle.cycle_month) || new Date().getMonth() + 1,
  );

  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth() + 1;

  let dueDate: Date;
  if (cycle.due_date && cycle.due_date !== "null") {
    dueDate = new Date(cycle.due_date as string);
    if (isNaN(dueDate.getTime())) {
      dueDate = calculateDueDate(year, month);
    }
  } else {
    dueDate = calculateDueDate(year, month);
  }

  const status = computeStatus(paidAmount, expectedAmount, dueDate);
  const createdAt = cycle.created_at
    ? new Date(cycle.created_at as string)
    : new Date();
  const updatedAt =
    cycle.updated_at && cycle.updated_at !== "null"
      ? new Date(cycle.updated_at as string)
      : null;

  return {
    id: String(cycle.id || ""),
    clientId: String(cycle.client_id || ""),
    year,
    month,
    referenceDate,
    dueDate,
    expectedAmount,
    paidAmount,
    status,
    isVirtual,
    createdAt,
    updatedAt,
  };
}

export function detectCurrentMonth(
  cycles: NormalizedBillingCycle[],
  dueDay: number = 5,
): { hasCurrent: boolean; cycle: NormalizedBillingCycle | null } {
  const firstDue = calculateFirstDueDate(dueDay);
  const currentYear = firstDue.getFullYear();
  const currentMonth = firstDue.getMonth() + 1;

  console.log("[normalize] detectCurrentMonth - looking for:", {
    currentYear,
    currentMonth,
  });
  console.log(
    "[normalize] detectCurrentMonth - available cycles:",
    cycles.map((c) => `${c.year}-${String(c.month).padStart(2, "0")}`),
  );

  const existingCycle = cycles.find(
    (c) => c.year === currentYear && c.month === currentMonth,
  );

  if (existingCycle) {
    console.log("[normalize] detectCurrentMonth - FOUND existing cycle:", {
      id: existingCycle.id,
      year: existingCycle.year,
      month: existingCycle.month,
      isVirtual: existingCycle.isVirtual,
    });
    return { hasCurrent: true, cycle: existingCycle };
  }

  console.log(
    "[normalize] detectCurrentMonth - NO cycle found for current month",
  );
  return { hasCurrent: false, cycle: null };
}

export function createVirtualCurrentCycle(
  monthlyPrice: number,
  dueDay: number = 5,
  clientId: string = "",
): NormalizedBillingCycle {
  const firstDueDate = calculateFirstDueDate(dueDay);
  const year = firstDueDate.getFullYear();
  const month = firstDueDate.getMonth() + 1;
  const referenceDate = new Date(year, month - 1, 1);

  console.log("[normalize] createVirtualCurrentCycle - creating for:", {
    year,
    month,
    referenceDate: referenceDate.toISOString(),
    dueDate: firstDueDate.toISOString(),
    dueDay,
  });

  return {
    id: `virtual-${year}-${String(month).padStart(2, "0")}`,
    clientId,
    year,
    month,
    referenceDate,
    dueDate: firstDueDate,
    expectedAmount: monthlyPrice,
    paidAmount: 0,
    status: computeStatus(0, monthlyPrice, firstDueDate),
    isVirtual: true,
    createdAt: new Date(),
    updatedAt: null,
  };
}

export function normalizeAndSortCycles(
  dbCycles: (BillingCycle | Record<string, unknown>)[],
  monthlyPrice: number,
  dueDay: number = 5,
  clientId: string = "",
): NormalizedBillingCycle[] {
  console.log(
    "[normalize] normalizeAndSortCycles - INPUT dbCycles:",
    dbCycles.length,
  );
  console.log(
    "[normalize] normalizeAndSortCycles - dbCycles raw:",
    dbCycles.map((c) => ({
      id: c.id,
      year: c.cycle_year,
      month: c.cycle_month,
      reference_date: c.reference_date,
      due_date: c.due_date,
      expected_amount: c.expected_amount,
      paid_amount: c.paid_amount,
    })),
  );

  const normalizedCycles = dbCycles.map((cycle) =>
    normalizeCycle(cycle, false),
  );

  const firstValidDueDate = calculateFirstDueDate(dueDay);
  const firstValidReferenceDate = new Date(
    firstValidDueDate.getFullYear(),
    firstValidDueDate.getMonth(),
    1,
  );

  const validCycles = normalizedCycles.filter(
    (cycle) => cycle.referenceDate >= firstValidReferenceDate,
  );

  const { hasCurrent } = detectCurrentMonth(validCycles, dueDay);

  let allCycles = validCycles;
  if (!hasCurrent && monthlyPrice > 0) {
    const virtualCycle = createVirtualCurrentCycle(
      monthlyPrice,
      dueDay,
      clientId,
    );
    console.log("[normalize] normalizeAndSortCycles - created virtual cycle:", {
      id: virtualCycle.id,
      year: virtualCycle.year,
      month: virtualCycle.month,
      isVirtual: virtualCycle.isVirtual,
    });
    allCycles = [virtualCycle, ...validCycles];
  }

  const uniqueCycles = new Map<string, NormalizedBillingCycle>();
  for (const cycle of allCycles) {
    const key = `${cycle.year}-${String(cycle.month).padStart(2, "0")}`;
    if (!uniqueCycles.has(key)) {
      uniqueCycles.set(key, cycle);
    }
  }

  const sortedCycles = [...uniqueCycles.values()].sort(
    (a, b) => a.referenceDate.getTime() - b.referenceDate.getTime(),
  );

  console.log(
    "[normalize] normalizeAndSortCycles - OUTPUT cycles:",
    sortedCycles.map((c) => ({
      id: c.id,
      year: c.year,
      month: c.month,
      isVirtual: c.isVirtual,
      status: c.status,
    })),
  );

  return sortedCycles;
}

export function calculateStats(cycles: NormalizedBillingCycle[]): {
  totalCycles: number;
  totalExpected: number;
  totalPaid: number;
  totalPending: number;
  paidCycles: number;
  pendingCycles: number;
  partialCycles: number;
  overdueCycles: number;
} {
  let totalExpected = 0;
  let totalPaid = 0;
  let paidCyclesCount = 0;
  let pendingCycles = 0;
  let partialCycles = 0;
  let overdueCycles = 0;

  for (const cycle of cycles) {
    totalExpected += cycle.expectedAmount;

    switch (cycle.status) {
      case "paid":
        totalPaid += cycle.expectedAmount;
        paidCyclesCount++;
        break;
      case "pending":
        pendingCycles++;
        break;
      case "partial":
        totalPaid += cycle.paidAmount;
        partialCycles++;
        break;
      case "overdue":
        totalPaid += cycle.paidAmount;
        overdueCycles++;
        break;
    }
  }

  return {
    totalCycles: cycles.length,
    totalExpected,
    totalPaid,
    totalPending: totalExpected - totalPaid,
    paidCycles: paidCyclesCount,
    pendingCycles,
    partialCycles,
    overdueCycles,
  };
}
