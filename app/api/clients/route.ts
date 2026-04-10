import { NextResponse } from "next/server";

import { getAuthenticatedContext } from "@/services/clients/auth";
import { listClients } from "@/services/clients/list-clients.service";
import { createClient } from "@/services/clients/create-client.service";
import { createClientSchema } from "@/services/clients/types";

export async function GET() {
  try {
    console.log("[API] GET /clients - Starting");

    const { supabase, userId } = await getAuthenticatedContext();
    console.log("[API] GET /clients - User ID:", userId);

    const result = await listClients(supabase, userId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    console.log(
      "[API] GET /clients - Success, count:",
      result.data?.length || 0,
    );
    return NextResponse.json({ data: result.data });
  } catch (error) {
    console.error("[API] GET /clients - Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    console.log("[API] POST /clients - Starting");

    const { supabase, userId } = await getAuthenticatedContext();
    console.log("[API] POST /clients - User ID:", userId);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = createClientSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map((e) => e.message).join(", ");
      return NextResponse.json({ error: errors }, { status: 400 });
    }

    console.log(
      "[API] POST /clients - Calling createClient with user.id:",
      userId,
    );
    const result = await createClient({
      supabase,
      userId,
      data: parsed.data,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    console.log("[API] POST /clients - Success, id:", result.data?.id);
    return NextResponse.json({ data: result.data }, { status: 201 });
  } catch (error) {
    console.error("[API] POST /clients - Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}