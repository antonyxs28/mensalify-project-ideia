import { z } from "zod";

export interface Client {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  monthly_price: number;
  due_day: number;
  billing_type: string | null;
  total_installments: number;
  number_of_cycles: number | null;
  created_at: string;
  updated_at: string | null;
}

export interface CreateClientData {
  name: string;
  email?: string;
  phone?: string;
  monthly_price: number | string;
  due_day?: number;
  billing_type?: "monthly" | "weekly" | "yearly";
  total_installments?: number;
  number_of_cycles?: number | null;
}

export const createClientSchema = z.object({
  name: z.string().min(1, "Name is required").trim(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  monthly_price: z.union([z.string(), z.number()]).refine((val) => {
    const num = typeof val === "string" ? Number(val) : val;
    return !isNaN(num) && num > 0;
  }, "Price must be a positive number"),
  due_day: z.number().int().min(1).max(31).optional(),
  billing_type: z.enum(["monthly", "weekly", "yearly"]).optional(),
  total_installments: z.number().int().min(1).optional(),
  number_of_cycles: z.number().int().min(1).nullable().optional(),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;

export const updateClientSchema = createClientSchema.partial();

export type UpdateClientInput = z.infer<typeof updateClientSchema>;

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}
