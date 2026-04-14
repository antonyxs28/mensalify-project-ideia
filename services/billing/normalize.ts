import type { BillingCycle, NormalizedBillingCycle, ClientBillingInfo } from "./types";
import { computeCycleStatus } from "@/lib/utils";

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

  const status = computeCycleStatus(paidAmount, expectedAmount, dueDate ? dueDate.toISOString().split('T')[0] : '');
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

function generateCyclesFromCreatedAt(
  client: ClientBillingInfo,
  upToDate?: Date,
): NormalizedBillingCycle[] {
  const dueDay = client.due_day || 5;
  
  const createdDate = new Date(client.created_at);
  
  if (isNaN(createdDate.getTime())) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[normalize] Invalid createdDate:', client.created_at);
    }
    return [];
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('[normalize] Generating from createdDate:', createdDate.toISOString());
  }

  const cycles: NormalizedBillingCycle[] = [];
  const maxCycles = 12;

  for (let i = 0; i < maxCycles; i++) {
    const cycleDate = new Date(createdDate);
    cycleDate.setMonth(cycleDate.getMonth() + i + 1);
    cycleDate.setDate(1);
    
    const year = cycleDate.getFullYear();
    const month = cycleDate.getMonth() + 1;
    const referenceDate = buildLocalDate(year, month, 1);
    const dueDate = getValidDueDate(year, month, dueDay);
    
    const status = computeCycleStatus(0, client.monthly_price, dueDate ? dueDate.toISOString().split('T')[0] : '');

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
  isInstallment: boolean,
  maxCycles?: number,
): NormalizedBillingCycle[] {
  const merged = new Map<string, NormalizedBillingCycle>();
  
  if (process.env.NODE_ENV === 'development') {
    console.log('[normalize] DB cycles:', dbCycles.length);
    console.log('[normalize] Generated cycles:', generated.length, 'maxCycles:', maxCycles, 'isInstallment:', isInstallment);
  }
  
  // Primeiro: adicionar TODOS os ciclos do DB (fonte da verdade)
  for (const dbCycle of dbCycles) {
    const year = dbCycle.year;
    const month = dbCycle.month;
    
    if (!year || isNaN(year) || !month || isNaN(month)) {
      continue;
    }
    
    const key = `${year}-${String(month).padStart(2, "0")}`;
    const paidAmount = dbCycle.paidAmount;
    const expectedAmount = dbCycle.expectedAmount;
    const status = dbCycle.status || computeCycleStatus(paidAmount, expectedAmount, dbCycle.dueDate ? dbCycle.dueDate.toISOString().split('T')[0] : '');
    
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
  
  // Para installment: NÃO adicionar ciclos gerados automaticamente
  // Os ciclos são apenas os que existem no banco de dados
  if (!isInstallment) {
    // Segundo (apenas para recurring): preencher lacunas APENAS até o limite de ciclos
    for (const genCycle of generated) {
      if (maxCycles && merged.size >= maxCycles) {
        if (process.env.NODE_ENV === 'development') {
          console.log('[normalize] Stopped filling gaps - reached maxCycles limit:', maxCycles);
        }
        break;
      }
      
      const key = `${genCycle.year}-${String(genCycle.month).padStart(2, "0")}`;
      
      if (!merged.has(key)) {
        merged.set(key, genCycle);
      }
    }
  }
  
  const result = [...merged.values()].sort(
    (a, b) => a.referenceDate.getTime() - b.referenceDate.getTime(),
  );
  
  if (process.env.NODE_ENV === 'development') {
    console.log('[normalize] Final result:', result.length);
  }
  
  return result;
}

export function normalizeAndSortCycles(
  dbCycles: (BillingCycle | Record<string, unknown>)[],
  client?: ClientBillingInfo | null,
): NormalizedBillingCycle[] {
  if (!client) {
    return dbCycles.map((cycle) => normalizeCycle(cycle));
  }

  // Determinar tipo baseado em dados reais do cliente, NÃO em billing_type
  // Se tem parcelas/ciclos definidos OU existem ciclos no banco → é INSTALLMENT
  const isInstallment =
    (client.total_installments && client.total_installments > 0) ||
    (client.number_of_cycles && client.number_of_cycles > 0) ||
    dbCycles.length > 0;

  // Definir totalCycles: para installment usar o número de parcelas, senão 12
  const totalCycles = isInstallment
    ? client.total_installments ?? client.number_of_cycles ?? dbCycles.length
    : 12;

  const billingType = client.billing_type || 'monthly';

  const generatedCycles = generateCyclesFromCreatedAt(client);
  
  // Se não há ciclos gerados (installment sem limite) mas há ciclos no banco
  if (generatedCycles.length === 0 && dbCycles.length > 0) {
    const dbNormalized = dbCycles.map((cycle) => normalizeCycle(cycle));
    return dbNormalized.slice(0, totalCycles);
  }
  
  if (dbCycles.length === 0) {
    return generatedCycles.slice(0, totalCycles);
  }

  const dbNormalized = dbCycles.map((cycle) => normalizeCycle(cycle));
  const merged = mergeCyclesWithDB(generatedCycles, dbNormalized as NormalizedBillingCycle[], !!isInstallment, totalCycles);
  const finalCycles = merged.slice(0, totalCycles);
  
  if (process.env.NODE_ENV === 'development') {
    console.log('[normalize] isInstallment:', isInstallment);
    console.log('[normalize] totalCycles:', totalCycles);
    console.log('[normalize] Final cycles count:', finalCycles.length);
    console.log('[normalize] Sample:', merged.slice(0,3).map(c => `${c.year}-${c.month}:${c.status}:${c.paidAmount}/${c.expectedAmount}`));
  }
  
  return finalCycles;
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
