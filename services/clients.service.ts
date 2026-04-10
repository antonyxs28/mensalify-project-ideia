import { supabase } from "@/lib/supabase/client";
import type { Client } from "@/lib/types";
import type { CreateClientData } from "@/services/clients/types";

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();

  console.log("[SERVICE] Session check - has session:", !!session);
  console.log("[SERVICE] Session check - has access_token:", !!session?.access_token);
  console.log("[SERVICE] Session check - has refresh_token:", !!session?.refresh_token);

  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
    headers["x-refresh-token"] = session.refresh_token || "";
    console.log("[SERVICE] Adding Authorization header with token");
    console.log("[SERVICE] Adding refresh token header");
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

export async function fetchClients(): Promise<Client[]> {
  const headers = await getAuthHeaders();

  const response = await fetch("/api/clients", {
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    const error = await safeJsonParse(response);
    console.error("[clients.service] fetchClients failed:", response.status, error);
    throw new Error(error.error || `Server error: ${response.status}`);
  }

  const data = await response.json();
  console.log("[clients.service] fetchClients success, count:", data.data?.length || 0);
  return data.data || [];
}

export async function createClient(data: CreateClientData): Promise<Client> {
  const headers = await getAuthHeaders();

  console.log("[clients.service] createClient - sending:", {
    name: data.name,
    monthlyPrice: data.monthly_price,
  });

  const response = await fetch("/api/clients", {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify({
      name: data.name,
      email: data.email,
      phone: data.phone,
      monthly_price: data.monthly_price,
    }),
  });

  if (!response.ok) {
    const error = await safeJsonParse(response);
    console.error("[clients.service] createClient failed:", response.status, error);
    throw new Error(error.error || `Server error: ${response.status}`);
  }

  const result = await response.json();
  console.log("[clients.service] createClient success:", result.data?.id);
  return result.data;
}

export async function updateClient(
  id: string,
  data: Partial<CreateClientData>,
): Promise<Client> {
  const headers = await getAuthHeaders();

  const response = await fetch(`/api/clients/${id}`, {
    method: "PUT",
    headers,
    credentials: "include",
    body: JSON.stringify({
      name: data.name,
      email: data.email,
      phone: data.phone,
      monthly_price: data.monthly_price,
    }),
  });

  if (!response.ok) {
    const error = await safeJsonParse(response);
    throw new Error(error.error || `Server error: ${response.status}`);
  }

  const result = await response.json();
  return result.data;
}

export async function deleteClient(id: string): Promise<void> {
  const headers = await getAuthHeaders();

  const response = await fetch(`/api/clients/${id}`, {
    method: "DELETE",
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    const error = await safeJsonParse(response);
    throw new Error(error.error || `Server error: ${response.status}`);
  }
}