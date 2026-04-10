"use client";

import { useState, useEffect, useCallback } from "react";
import type { Client, ClientFormData, DashboardStats, ChartData, PaymentStatus } from "@/lib/types";
import * as clientsService from "@/services/clients.service";
import { generateLastNMonths } from "@/lib/utils";

interface ClientWithStatus extends Client {
  status: PaymentStatus;
  monthKey: string;
}

const getMonthKey = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

export function useClients() {
  const [clients, setClients] = useState<ClientWithStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClients = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const data = await clientsService.fetchClients();
      
      const currentMonth = getMonthKey();
      const clientsWithStatus: ClientWithStatus[] = data.map((client) => ({
        ...client,
        status: "pendente" as PaymentStatus,
        monthKey: currentMonth,
      }));

      setClients(clientsWithStatus);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load clients";
      console.error("[useClients] fetchClients error:", message);
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
    async (data: ClientFormData): Promise<{ success: boolean; error?: string }> => {
      try {
        await clientsService.createClient({
          name: data.name,
          email: data.email,
          phone: data.phone,
          monthly_price: data.monthly_price,
        });
        
        await fetchClients();
        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create client";
        console.error("[useClients] addClient error:", message);
        return { success: false, error: message };
      }
    },
    [fetchClients]
  );

  const updateClient = useCallback(
    async (id: string, data: Partial<ClientFormData>): Promise<{ success: boolean; error?: string }> => {
      try {
        await clientsService.updateClient(id, data);
        await fetchClients();
        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update client";
        console.error("[useClients] updateClient error:", message);
        return { success: false, error: message };
      }
    },
    [fetchClients]
  );

  const deleteClient = useCallback(
    async (id: string): Promise<{ success: boolean; error?: string }> => {
      try {
        await clientsService.deleteClient(id);
        await fetchClients();
        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to delete client";
        console.error("[useClients] deleteClient error:", message);
        return { success: false, error: message };
      }
    },
    [fetchClients]
  );

  const markAsPaid = useCallback(
    async (id: string): Promise<{ success: boolean; error?: string }> => {
      console.log("[useClients] markAsPaid not implemented - needs payments service");
      return { success: false, error: "Not implemented" };
    },
    []
  );

  const getStats = useCallback((): DashboardStats => {
    const totalClients = clients.length;
    const paidClients = clients.filter((c) => c.status === "pago").length;
    const pendingClients = totalClients - paidClients;

    const totalExpected = clients.reduce((sum, c) => sum + (c.monthly_price || 0), 0);
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
    const allMonths = generateLastNMonths(6)
    
    const grouped = clients.reduce<Record<string, ChartData>>((acc, client) => {
      const month = client.monthKey
      if (!acc[month]) {
        acc[month] = { month, monthKey: month, received: 0, expected: 0 }
      }
      acc[month].expected += client.monthly_price || 0
      if (client.status === "pago") {
        acc[month].received += client.monthly_price || 0
      }
      return acc
    }, {})

    return allMonths.map((month) => {
      const existing = grouped[month]
      return existing || { month, monthKey: month, received: 0, expected: 0 }
    })
  }, [clients]);

  const refetch = useCallback(() => fetchClients(), [fetchClients]);

  return {
    clients,
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