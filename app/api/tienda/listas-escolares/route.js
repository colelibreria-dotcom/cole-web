import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function GET() {
  try {
    const { data: escuelas, error: escuelasError } = await supabase
      .from("escuelas")
      .select("id, nombre, localidad, orden")
      .eq("activo", true)
      .order("localidad", { ascending: true })
      .order("orden", { ascending: true })
      .order("nombre", { ascending: true });

    if (escuelasError) throw escuelasError;

    const { data: listas, error: listasError } = await supabase
      .from("listas_escolares")
      .select("id, escuela_id, titulo, nivel, curso, anio, descripcion, orden")
      .eq("activa", true)
      .order("orden", { ascending: true });

    if (listasError) throw listasError;

    const ids = (listas || []).map((lista) => lista.id);
    if (ids.length === 0) {
      return NextResponse.json({ ok: true, escuelas: escuelas || [], listas: [] }, { headers: { "Cache-Control": "no-store" } });
    }

    const { data: items, error: itemsError } = await supabase
      .from("lista_escolar_items")
      .select("id, lista_id, nombre, cantidad, orden, obligatorio, lista_escolar_opciones(id, nivel, producto_id, cantidad, orden, productos(nombre, precio_venta, imagen_url))")
      .in("lista_id", ids)
      .order("orden", { ascending: true });

    if (itemsError) throw itemsError;

    return NextResponse.json(
      { ok: true, escuelas: escuelas || [], listas: listas || [], items: items || [] },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || "No se pudieron cargar las listas escolares." }, { status: 500 });
  }
}
