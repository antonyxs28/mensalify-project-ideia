"use client";

import { useState, useEffect, useCallback } from "react";
import type { Client, ClientFormData, DashboardStats, ChartData, PaymentStatus } from "@/lib/types";
import { generateLastNMonths, computeCycleStatus, logDev } from "@/lib/utils";

interface ClientWithStatus extends Client {
  status: PaymentStatus;
  monthKey: string;
  paidCycles: number;
  totalCycles: number;
}

const getMonthKey = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

async function getClientAuthHeaders(): Promise<HeadersInit> {
  const response = await fetch('/api/auth/session', { credentials: 'include' });
  const data = await response.json();
  const session = data.session;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
    headers["x-refresh-token"] = session.refresh_token || "";
  }

  return headers;
}

async function safeJsonParse(response: Response): Promise<{ error?: string }> {
  try {
    const text = await response.text();
    if (!text) return {};
    return JSON.parse(text);
  } catch {
    return { error: `Non-JSON response: ${response.status}` };
  }
}

export function useClients() {
  const [clients, setClients] = useState<ClientWithStatus[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClients = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const headers = await getClientAuthHeaders();
      const response = await fetch('/api/clients', {
        headers,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch clients');
      }

      const result = await response.json();
      const clients: Client[] = result.data || [];

      if (clients.length === 0) {
        setClients([]);
        setChartData(
          generateLastNMonths(6).map((m) => ({
            month: m,
            monthKey: m,
            received: 0,
            expected: 0,
          })),
        );
        setIsLoading(false);
        return;
      }

      const clientIds = clients.map((c) => c.id);
      const currentMonthKey = getMonthKey();

      const cyclesResponse = await fetch(`/api/cycles/bulk?clientIds=${clientIds.join(',')}`, {
        headers,
        credentials: 'include',
      });

      let allCycles: any[] = [];
      if (cyclesResponse.ok) {
        const cyclesResult = await cyclesResponse.json();
        allCycles = cyclesResult.data || [];
      } else if (process.env.NODE_ENV === "development") {
        console.error("[useClients] fetchCycles error: API request failed");
      }

      const computedCycles = (allCycles || []).map((cycle) => ({
        ...cycle,
        status: computeCycleStatus(
          cycle.paid_amount,
          cycle.expected_amount,
          cycle.due_date,
        ),
      }));

      const cyclesByClient = computedCycles.reduce(
        (acc: Record<string, { total: number; paid: number }>, cycle) => {
          if (!acc[cycle.client_id]) {
            acc[cycle.client_id] = { total: 0, paid: 0 };
          }
          acc[cycle.client_id].total += 1;
          if (cycle.status === "paid") {
            acc[cycle.client_id].paid += 1;
          }
          return acc;
        },
        {},
      );

      const chartDataMap = computedCycles.reduce<Record<string, ChartData>>(
        (acc, cycle) => {
          const monthKey = `${cycle.cycle_year}-${String(cycle.cycle_month).padStart(2, "0")}`;
          if (!acc[monthKey]) {
            acc[monthKey] = {
              month: monthKey,
              monthKey,
              received: 0,
              expected: 0,
            };
          }
          acc[monthKey].expected += Number(cycle.expected_amount) || 0;
          acc[monthKey].received += Number(cycle.paid_amount) || 0;
          return acc;
        },
        {},
      );

      const last6Months = generateLastNMonths(6);
      const allCycleMonths = computedCycles.map(
        (cycle) =>
          `${cycle.cycle_year}-${String(cycle.cycle_month).padStart(2, "0")}`,
      );
      const allMonths = [
        ...new Set([...last6Months, ...allCycleMonths]),
      ].sort();
      const newChartData = allMonths.map((monthKey) => {
        const existing = chartDataMap[monthKey];
        return (
          existing || { month: monthKey, monthKey, received: 0, expected: 0 }
        );
      });

      setChartData(newChartData);

      const clientsWithStatus: ClientWithStatus[] = clients.map((client) => {
        const clientCycles = cyclesByClient[client.id] || { total: 0, paid: 0 };
        const isAllPaid =
          clientCycles.total > 0 && clientCycles.paid === clientCycles.total;
        return {
          ...client,
          status: isAllPaid ? "pago" : "pendente",
          monthKey: currentMonthKey,
          paidCycles: clientCycles.paid,
          totalCycles: clientCycles.total,
        };
      });

      setClients(clientsWithStatus);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load clients";
      if (process.env.NODE_ENV === "development") {
        console.error("[useClients] fetchClients error:", message);
      }
      setError(message);
      setClients([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const addClient = useCallback(
    async (
      data: ClientFormData,
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const headers = await getClientAuthHeaders();
        const response = await fetch('/api/clients', {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify({
            name: data.name,
            email: data.email,
            phone: data.phone,
            monthly_price: data.monthly_price,
            due_day: data.due_day,
            billing_type: data.billing_type,
            number_of_cycles: data.number_of_cycles ? parseInt(String(data.number_of_cycles), 10) : null,
            total_installments: data.number_of_cycles ? parseInt(String(data.number_of_cycles), 10) : null,
          }),
        });

        if (!response.ok) {
          const error = await safeJsonParse(response);
          throw new Error(error.error || 'Failed to create client');
        }

        return { success: true };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to create client";
        if (process.env.NODE_ENV === "development") {
          console.error("[useClients] addClient error:", message);
        }
        return { success: false, error: message };
      }
    },
    [],
  );

  const updateClient = useCallback(
    async (
      id: string,
      data: Partial<ClientFormData>,
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const headers = await getClientAuthHeaders();
        const response = await fetch(`/api/clients/${id}`, {
          method: 'PUT',
          headers,
          credentials: 'include',
          body: JSON.stringify({
            name: data.name,
            email: data.email,
            phone: data.phone,
            monthly_price: data.monthly_price,
            due_day: data.due_day,
            billing_type: data.billing_type,
            number_of_cycles: data.number_of_cycles ? parseInt(String(data.number_of_cycles), 10) : null,
            total_installments: data.number_of_cycles ? parseInt(String(data.number_of_cycles), 10) : null,
          }),
        });

        if (!response.ok) {
          const error = await safeJsonParse(response);
          throw new Error(error.error || 'Failed to update client');
        }

        await fetchClients();
        return { success: true };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to update client";
        if (process.env.NODE_ENV === "development") {
          console.error("[useClients] updateClient error:", message);
        }
        return { success: false, error: message };
      }
    },
    [fetchClients],
  );

  const deleteClient = useCallback(
    async (id: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const headers = await getClientAuthHeaders();
        const response = await fetch(`/api/clients/${id}`, {
          method: 'DELETE',
          headers,
          credentials: 'include',
        });

        if (!response.ok) {
          const error = await safeJsonParse(response);
          throw new Error(error.error || 'Failed to delete client');
        }

        await fetchClients();
        return { success: true };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to delete client";
        if (process.env.NODE_ENV === "development") {
          console.error("[useClients] deleteClient error:", message);
        }
        return { success: false, error: message };
      }
    },
    [fetchClients],
  );

  const markAsPaid = useCallback(
    async (id: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const headers = await getClientAuthHeaders();

        const response = await fetch(`/api/clients/${id}/cycles`, {
          headers,
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Failed to fetch cycles');
        }

        const result = await response.json();
        const cycles = result.data || [];
        
        const latestCycle = cycles.sort((a: any, b: any) => {
          if (a.cycle_year !== b.cycle_year) return b.cycle_year - a.cycle_year;
          return b.cycle_month - a.cycle_month;
        })[0];

        const cycleId = latestCycle?.id;
        if (!cycleId) {
          return { success: false, error: "No billing cycle found for client" };
        }

        const payResponse = await fetch(`/api/cycles/${cycleId}/pay`, {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify({ amount: 0 }),
        });

        if (!payResponse.ok) {
          const error = await safeJsonParse(payResponse);
          throw new Error(error.error || "Failed to mark as paid");
        }

        const payResult = await payResponse.json();
        logDev("[useClients] markAsPaid success:", payResult.data?.cycle?.id);
        await fetchClients();
        return { success: true };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to mark as paid";
        if (process.env.NODE_ENV === "development") {
          console.error("[useClients] markAsPaid error:", message);
        }
        return { success: false, error: message };
      }
    },
    [fetchClients],
  );

  const getStats = useCallback((): DashboardStats => {
    const totalClients = clients.length;
    const paidClients = clients.filter((c) => c.status === "pago").length;
    const pendingClients = totalClients - paidClients;

    const totalExpected = clients.reduce(
      (sum, c) => sum + (c.monthly_price || 0),
      0,
    );
    const totalReceived = clients
      .filter((c) => c.status === "pago")
      .reduce((sum, c) => sum + (c.monthly_price || 0), 0);

    return {
      totalReceived,
      totalPending: totalExpected - totalReceived,
      totalClients,
      paidClients,
      pendingClients,
    };
  }, [clients]);

  const getChartData = useCallback((): ChartData[] => {
    return chartData;
  }, [chartData]);

  const refetch = useCallback(() => fetchClients(), [fetchClients]);

  return {
    clients,
    chartData,
    isLoading,
    error,
    addClient,
    updateClient,
    deleteClient,
    markAsPaid,
    getStats,
    getChartData,
    refetch,
  };
}
