import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("combos")
      .select("id, nombre, descripcion, precio_venta, combo_items(cantidad, orden, productos(id, nombre, imagen_url, precio_venta, activo))")
      .eq("activo", true)
      .eq("visible_web", true)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const combos = (data || []).map((combo) => ({
      ...combo,
      items: (combo.combo_items || []).filter((item) => item.productos?.activo !== false).sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0)),
    }));
    return NextResponse.json({ ok: true, combos }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    // Until the SQL migration is applied the storefront keeps working normally.
    return NextResponse.json({ ok: true, combos: [], pending_setup: true });
  }
}
