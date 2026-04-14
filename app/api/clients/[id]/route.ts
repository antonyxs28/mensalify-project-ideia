import { NextResponse } from "next/server";

import { getAuthenticatedContext } from "@/services/clients/auth";
import { getClient } from "@/services/clients/get-client.service";
import { updateClient } from "@/services/clients/update-client.service";
import { deleteClient } from "@/services/clients/delete-client.service";
import { updateClientSchema } from "@/services/clients/types";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (process.env.NODE_ENV === 'development') {
      console.log("[API] GET /clients/[id] - Starting, id:", id);
    }

    const { supabase, userId } = await getAuthenticatedContext();
    if (process.env.NODE_ENV === 'development') {
      console.log("[API] GET /clients/[id] - User ID:", userId);
    }

    const result = await getClient(supabase, userId, id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    return NextResponse.json({ data: result.data });
  } catch (error) {
    console.error("[API] GET /clients/[id] - Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (process.env.NODE_ENV === 'development') {
      console.log("[API] PUT /clients/[id] - Starting, id:", id);
    }

    const { supabase, userId } = await getAuthenticatedContext();
    if (process.env.NODE_ENV === 'development') {
      console.log("[API] PUT /clients/[id] - User ID:", userId);
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = updateClientSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map((e) => e.message).join(", ");
      return NextResponse.json({ error: errors }, { status: 400 });
    }

    const result = await updateClient({
      supabase,
      userId,
      clientId: id,
      data: parsed.data,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ data: result.data });
  } catch (error) {
    console.error("[API] PUT /clients/[id] - Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (process.env.NODE_ENV === 'development') {
      console.log("[API] DELETE /clients/[id] - Starting, id:", id);
    }

    const { supabase, userId } = await getAuthenticatedContext();
    if (process.env.NODE_ENV === 'development') {
      console.log("[API] DELETE /clients/[id] - User ID:", userId);
    }

    const result = await deleteClient({
      supabase,
      userId,
      clientId: id,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] DELETE /clients/[id] - Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}