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

function buildLocalDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function parseLocalDate(value: string, fallback: Date): Date {
  if (!value || value === "null") {
    return fallback;
  }

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return fallback;
  }
  return buildLocalDate(year, month, day);
}

function getValidDueDate(year: number, month: number, dueDay: number): Date {
  const candidate = buildLocalDate(year, month, dueDay);
  if (candidate.getMonth() !== month - 1) {
    return buildLocalDate(year, month + 1, 0);
  }
  return candidate;
}

export function parseReferenceDate(
  referenceDate: string,
  year: number,
  month: number,
): Date {
  const fallback = buildLocalDate(year, month, 1);
  if (!referenceDate || referenceDate === "null") {
    return fallback;
  }
  const parsed = parseLocalDate(referenceDate, fallback);
  return isNaN(parsed.getTime()) ? fallback : parsed;
}

export function calculateFirstDueDate(
  dueDay: number,
  baseDate: Date,
): Date {
  if (!baseDate || isNaN(baseDate.getTime())) {
    throw new Error("calculateFirstDueDate requires a valid baseDate (client.created_at)");
  }
  const date = new Date(baseDate);
  date.setHours(12, 0, 0, 0);

  return getValidDueDate(date.getFullYear(), date.getMonth() + 2, dueDay);
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

  // Check for overpaid FIRST - before checking for paid
  if (paidAmount > expectedAmount) {
    return "overpaid";
  }
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
  baseDate?: Date,
): NormalizedBillingCycle {
  const expectedAmount = Number(cycle.expected_amount) || 0;
  const paidAmount = Number(cycle.paid_amount) || 0;

  const referenceDate = parseReferenceDate(
    (cycle.reference_date as string) || "",
    Number(cycle.cycle_year) || (baseDate || new Date()).getFullYear(),
    Number(cycle.cycle_month) || (baseDate || new Date()).getMonth() + 1,
  );

  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth() + 1;

  let dueDate: Date;
  if (cycle.due_date && cycle.due_date !== "null") {
    dueDate = parseLocalDate(
      cycle.due_date as string,
      calculateDueDate(year, month),
    );
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
): { hasCurrent: boolean; cycle: NormalizedBillingCycle | null } {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const existingCycle = cycles.find(
    (c) => c.year === currentYear && c.month === currentMonth && !c.isVirtual,
  );

  return { 
    hasCurrent: !!existingCycle, 
    cycle: existingCycle || null 
  };
}

export function createVirtualCurrentCycle(
  monthlyPrice: number,
  dueDay: number,
  clientId: string,
  baseDate: Date,
): NormalizedBillingCycle {
  throw new Error("createVirtualCurrentCycle should NEVER be called - frontend must never generate cycles");
}

export interface ClientBillingInfo {
  id: string;
  created_at: string;
  monthly_price: number;
  due_day?: number;
  billing_type?: string;
  total_installments?: number;
  number_of_cycles?: number;
}

function generateCyclesFromCreatedAt(
  client: ClientBillingInfo,
  upToDate?: Date,
): NormalizedBillingCycle[] {
  const dueDay = client.due_day || 5;
  const totalInstallments = client.total_installments || client.number_of_cycles || 24;
  const createdDate = new Date(client.created_at);
  
  if (isNaN(createdDate.getTime())) {
    console.log('[normalize] Invalid createdDate:', client.created_at);
    return [];
  }

  console.log('[normalize] Generating from createdDate:', createdDate.toISOString(), 'client.created_at:', client.created_at);

  // Generate cycles for 24 months from created_at
  const cycles: NormalizedBillingCycle[] = [];

  for (let i = 0; i < totalInstallments; i++) {
    // Start from NEXT month after created_at
    const cycleDate = new Date(createdDate);
    cycleDate.setMonth(cycleDate.getMonth() + i + 1);
    cycleDate.setDate(1);
    
    const year = cycleDate.getFullYear();
    const month = cycleDate.getMonth() + 1;
    const referenceDate = buildLocalDate(year, month, 1);
    const dueDate = getValidDueDate(year, month, dueDay);
    
    const status = computeStatus(0, client.monthly_price, dueDate);

    console.log('[normalize] Generated cycle:', { year, month, dueDate: dueDate?.toISOString(), status });

    cycles.push({
      id: `generated-${client.id}-${year}-${month}`,
      clientId: client.id,
      year,
      month,
      referenceDate,
      dueDate,
      expectedAmount: client.monthly_price,
      paidAmount: 0,
      status,
      isVirtual: true,
      createdAt: createdDate,
      updatedAt: null,
    });
  }

  return cycles;
}

function mergeCyclesWithDB(
  generated: NormalizedBillingCycle[],
  dbCycles: NormalizedBillingCycle[],
): NormalizedBillingCycle[] {
  const merged = new Map<string, NormalizedBillingCycle>();
  
  console.log('[normalize] DB cycles:', dbCycles.length);
  console.log('[normalize] Generated cycles:', generated.length);
  
  // Primeiro: adicionar TODOS os ciclos do DB (fonte da verdade)
  // dbCycles aqui já passaram por normalizeCycle, então usam year/month
  for (const dbCycle of dbCycles) {
    const year = dbCycle.year;
    const month = dbCycle.month;
    
    // Validar
    if (!year || isNaN(year) || !month || isNaN(month)) {
      console.log('[normalize] Skipping invalid DB cycle:', dbCycle.id, year, month);
      continue;
    }
    
    const key = `${year}-${String(month).padStart(2, "0")}`;
    const paidAmount = dbCycle.paidAmount;
    const expectedAmount = dbCycle.expectedAmount;
    const status = dbCycle.status || computeStatus(paidAmount, expectedAmount, dbCycle.dueDate);
    
    console.log('[normalize] Matched DB cycle:', key, 'paid:', paidAmount, 'status:', status);
    
    merged.set(key, {
      id: dbCycle.id,
      clientId: dbCycle.clientId,
      year: dbCycle.year,
      month: dbCycle.month,
      referenceDate: dbCycle.referenceDate,
      dueDate: dbCycle.dueDate,
      expectedAmount: dbCycle.expectedAmount,
      paidAmount: dbCycle.paidAmount,
      status: dbCycle.status,
      isVirtual: false,
      createdAt: dbCycle.createdAt,
      updatedAt: dbCycle.updatedAt,
    });
  }
  
  // Segundo: preencher lacunas com ciclos gerados
  for (const genCycle of generated) {
    const key = `${genCycle.year}-${String(genCycle.month).padStart(2, "0")}`;
    
    if (!merged.has(key)) {
      merged.set(key, genCycle);
      console.log('[normalize] Filled gap with generated:', key);
    }
  }
  
  const result = [...merged.values()].sort(
    (a, b) => a.referenceDate.getTime() - b.referenceDate.getTime(),
  );
  
  console.log('[normalize] Final result:', result.length);
  
  return result;
}

export function normalizeAndSortCycles(
  dbCycles: (BillingCycle | Record<string, unknown>)[],
  client?: ClientBillingInfo | null,
): NormalizedBillingCycle[] {
  if (!client) {
    return dbCycles.map((cycle) => normalizeCycle(cycle));
  }

  const generatedCycles = generateCyclesFromCreatedAt(client);
  
  if (dbCycles.length === 0) {
    return generatedCycles;
  }

  const dbNormalized = dbCycles.map((cycle) => normalizeCycle(cycle));
  const merged = mergeCyclesWithDB(generatedCycles, dbNormalized as NormalizedBillingCycle[]);
  
  console.log('[normalize] Final cycles count:', merged.length);
  console.log('[normalize] Sample:', merged.slice(0,3).map(c => `${c.year}-${c.month}:${c.status}:${c.paidAmount}/${c.expectedAmount}`));
  
  return merged;
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
        totalPaid += cycle.paidAmount;
        paidCyclesCount++;
        break;
      case "overpaid":
        totalPaid += cycle.paidAmount;
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
