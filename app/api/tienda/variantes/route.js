import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const ids = String(searchParams.get("producto_ids") || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    if (ids.length === 0) {
      return NextResponse.json({ ok: true, variantes: [] }, { headers: { "Cache-Control": "no-store" } });
    }

    const { data, error } = await supabase
      .from("producto_variantes")
      .select("*")
      .in("producto_id", ids)
      .eq("activo", true)
      .order("orden", { ascending: true })
      .order("nombre", { ascending: true });

    if (error) throw error;

    return NextResponse.json(
      { ok: true, variantes: data || [] },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("GET /api/tienda/variantes:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Error al cargar variantes" },
      { status: 500 }
    );
  }
}
