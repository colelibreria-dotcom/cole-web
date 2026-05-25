import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function isVisible(producto) {
  const activo = producto.activo;
  const visibleWeb = producto.visible_web;
  const visibleEnWeb = producto.visible_en_web;

  if (activo === false) return false;

  const hasVisibleField = visibleWeb !== undefined || visibleEnWeb !== undefined;
  if (!hasVisibleField) return true;

  return visibleWeb === true || visibleEnWeb === true;
}

function mapProducto(producto) {
  const precio =
    producto.precio_venta ??
    producto.precio ??
    producto.precio_final ??
    producto.precio_publico ??
    0;

  const categoria =
    producto.categoria ||
    producto.rubro ||
    producto.familia ||
    producto.linea ||
    "General";

  const codigo =
    producto.codigo_barras ||
    producto.codigo_interno ||
    producto.codigo ||
    String(producto.id);

  return {
    id: producto.id,
    code: codigo,
    codigo_barras: producto.codigo_barras || "",
    codigo_interno: producto.codigo_interno || producto.codigo || "",
    name: producto.nombre || producto.descripcion || "Producto sin nombre",
    category: categoria,
    marca: producto.marca || "",
    price: Math.round(Number(precio || 0)),
    oldPrice: producto.precio_anterior ? Number(producto.precio_anterior) : null,
    stock: Number(producto.stock_actual ?? producto.stock ?? 0),
    image: producto.imagen_url || producto.imagen || producto.foto_url || producto.icono || "📦",
    imageUrl: producto.imagen_url || producto.imagen || producto.foto_url || "",
    imagen_url: producto.imagen_url || producto.imagen || producto.foto_url || "",
    badge: producto.destacado ? "Destacado" : null,
  };
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("productos")
      .select("*")
      .order("nombre", { ascending: true });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    const productos = (data || [])
      .filter(isVisible)
      .map(mapProducto)
      .filter((producto) => producto.price > 0);

    return NextResponse.json({ ok: true, productos });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error.message || "Error al cargar productos" },
      { status: 500 }
    );
  }
}
