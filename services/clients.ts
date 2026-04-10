import { db } from '@/lib/db'
import { clients, type Client, type NewClient } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

// Types
export interface CreateClientInput {
  name: string
  email?: string
  phone?: string
  monthlyPrice: string | number
}

export interface UpdateClientInput {
  name?: string
  email?: string
  phone?: string
  monthlyPrice?: string | number
}

export interface ServiceResult<T> {
  success: boolean
  data?: T
  error?: string
}

// Error messages
const ERRORS = {
  NOT_FOUND: 'Client not found',
  CREATE_FAILED: 'Failed to create client',
  UPDATE_FAILED: 'Failed to update client',
  DELETE_FAILED: 'Failed to delete client',
  INVALID_INPUT: 'Invalid input data'
} as const

// GET ALL CLIENTS
export async function getClients(userId: string): Promise<ServiceResult<Client[]>> {
  try {
    const result = await db
      .select()
      .from(clients)
      .where(eq(clients.userId, userId))
      .orderBy(clients.createdAt)

    return { success: true, data: result }
  } catch (error) {
    console.error('Error fetching clients:', error)
    return { success: false, error: 'Failed to fetch clients' }
  }
}

// GET SINGLE CLIENT
export async function getClientById(clientId: string): Promise<ServiceResult<Client>> {
  try {
    const [result] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1)

    if (!result) {
      return { success: false, error: ERRORS.NOT_FOUND }
    }

    return { success: true, data: result }
  } catch (error) {
    console.error('Error fetching client:', error)
    return { success: false, error: 'Failed to fetch client' }
  }
}

// CREATE CLIENT
export async function createClient(
  userId: string,
  data: CreateClientInput
): Promise<ServiceResult<Client>> {
  try {
    // Validate input
    if (!data.name?.trim()) {
      return { success: false, error: 'Name is required' }
    }
    
    const priceStr = String(data.monthlyPrice)
    const priceNum = Number(priceStr)
    if (!priceNum || priceNum <= 0) {
      return { success: false, error: 'Valid monthly price is required' }
    }

    const [result] = await db
      .insert(clients)
      .values({
        userId,
        name: data.name.trim(),
        email: data.email?.trim() || null,
        phone: data.phone?.trim() || null,
        monthlyPrice: priceStr // Drizzle numeric expects string
      })
      .returning()

    return { success: true, data: result }
  } catch (error) {
    console.error('Error creating client:', error)
    return { success: false, error: ERRORS.CREATE_FAILED }
  }
}

// UPDATE CLIENT
export async function updateClient(
  clientId: string,
  data: UpdateClientInput
): Promise<ServiceResult<Client>> {
  try {
    // Check if client exists
    const [existing] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1)

    if (!existing) {
      return { success: false, error: ERRORS.NOT_FOUND }
    }

    // Build update object
    const updateData: Partial<typeof clients.$inferInsert> = {}

    if (data.name !== undefined) {
      if (!data.name.trim()) {
        return { success: false, error: 'Name cannot be empty' }
      }
      updateData.name = data.name.trim()
    }
    if (data.email !== undefined) {
      updateData.email = data.email?.trim() || null
    }
    if (data.phone !== undefined) {
      updateData.phone = data.phone?.trim() || null
    }
    if (data.monthlyPrice !== undefined) {
      const priceNum = Number(data.monthlyPrice)
      if (!priceNum || priceNum <= 0) {
        return { success: false, error: 'Monthly price must be positive' }
      }
      updateData.monthlyPrice = String(priceNum) // Drizzle numeric expects string
    }

    // Add updated_at timestamp
    updateData.updatedAt = new Date()

    const [result] = await db
      .update(clients)
      .set(updateData)
      .where(eq(clients.id, clientId))
      .returning()

    return { success: true, data: result }
  } catch (error) {
    console.error('Error updating client:', error)
    return { success: false, error: ERRORS.UPDATE_FAILED }
  }
}

// DELETE CLIENT
export async function deleteClient(clientId: string): Promise<ServiceResult<Client>> {
  try {
    // Check if client exists
    const [existing] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1)

    if (!existing) {
      return { success: false, error: ERRORS.NOT_FOUND }
    }

    const [result] = await db
      .delete(clients)
      .where(eq(clients.id, clientId))
      .returning()

    return { success: true, data: result }
  } catch (error) {
    console.error('Error deleting client:', error)
    return { success: false, error: ERRORS.DELETE_FAILED }
  }
}