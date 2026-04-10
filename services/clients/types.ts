import { z } from "zod";

export interface Client {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  monthly_price: number;
  created_at: string;
  updated_at: string | null;
}

export interface CreateClientData {
  name: string;
  email?: string;
  phone?: string;
  monthly_price: number | string;
}

export const createClientSchema = z.object({
  name: z.string().min(1, "Name is required").trim(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  monthly_price: z.union([z.string(), z.number()]).refine((val) => {
    const num = typeof val === "string" ? Number(val) : val;
    return !isNaN(num) && num > 0;
  }, "Price must be a positive number"),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;

export const updateClientSchema = createClientSchema.partial();

export type UpdateClientInput = z.infer<typeof updateClientSchema>;

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}