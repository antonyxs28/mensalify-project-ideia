"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";

async function getClientAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();

  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
    headers["x-refresh-token"] = session.refresh_token || "";
  }

  return headers;
}

export interface BillingCycle {
  id: string;
  client_id: string;
  cycle_year: number;
  cycle_month: number;
  due_date: string;
  expected_amount: number;
  paid_amount: number;
  status: "pending" | "paid" | "overdue" | "partial";
  created_at: string;
  updated_at: string | null;
}

export interface BillingPayment {
  id: string;
  client_id: string;
  billing_cycle_id: string | null;
  month: string;
  amount: number;
  paid: boolean;
  paid_at: string | null;
  created_at: string;
}

export interface BillingStats {
  totalReceived: number;
  totalExpected: number;
  overdueCycles: number;
  currentMonthRevenue: number;
  totalCycles: number;
  paidCycles: number;
  pendingCycles: number;
  partialCycles: number;
}

export function useBillingStats() {
  const [stats, setStats] = useState<BillingStats>({
    totalReceived: 0,
    totalExpected: 0,
    overdueCycles: 0,
    currentMonthRevenue: 0,
    totalCycles: 0,
    paidCycles: 0,
    pendingCycles: 0,
    partialCycles: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const headers = await getClientAuthHeaders();
      const response = await fetch("/api/billing/stats", {
        headers,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch billing stats");
      }

      const result = await response.json();
      setStats(result.data || stats);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load stats";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, isLoading, error, refetch: fetchStats };
}

export function useClientCycles(clientId: string) {
  const [cycles, setCycles] = useState<BillingCycle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCycles = useCallback(async () => {
    if (!clientId) return;
    
    try {
      setIsLoading(true);
      setError(null);

      const headers = await getClientAuthHeaders();
      console.log("[useClientCycles] Fetching cycles for clientId:", clientId);
      
      const response = await fetch(`/api/clients/${clientId}/cycles`, {
        headers,
        credentials: "include",
      });

      console.log("[useClientCycles] Response status:", response.status);

      if (!response.ok) {
        const text = await response.text();
        console.error("[useClientCycles] Error response:", text);
        throw new Error(text || "Failed to fetch cycles");
      }

      const result = await response.json();
      console.log("[useClientCycles] Raw result:", result);
      console.log("[useClientCycles] Cycles data:", result.data);
      setCycles(result.data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load cycles";
      console.error("[useClientCycles] Catch error:", message);
      setError(message);
      setCycles([]);
    } finally {
      setIsLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchCycles();
  }, [fetchCycles]);

  return { cycles, isLoading, error, refetch: fetchCycles };
}

export function useCyclePayments(cycleId: string) {
  const [cycle, setCycle] = useState<BillingCycle | null>(null);
  const [payments, setPayments] = useState<BillingPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!cycleId) return;

    try {
      setIsLoading(true);
      setError(null);

      const headers = await getClientAuthHeaders();
      const response = await fetch(`/api/cycles/${cycleId}`, {
        headers,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch cycle");
      }

      const result = await response.json();
      setCycle(result.data?.cycle || null);
      setPayments(result.data?.payments || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load payments";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [cycleId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { cycle, payments, isLoading, error, refetch: fetchData };
}

export function useAddPayment() {
  const [isLoading, setIsLoading] = useState(false);

  const addPayment = useCallback(
    async (cycleId: string, amount: number): Promise<{ success: boolean; error?: string }> => {
      try {
        setIsLoading(true);

        const headers = await getClientAuthHeaders();
        const response = await fetch(`/api/cycles/${cycleId}/pay`, {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify({ amount }),
        });

        if (!response.ok) {
          const text = await response.text();
          const parsed = JSON.parse(text);
          throw new Error(parsed.error || "Failed to add payment");
        }

        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to add payment";
        return { success: false, error: message };
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return { addPayment, isLoading };
}