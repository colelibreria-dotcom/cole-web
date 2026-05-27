import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

function mapProducto(producto, categoriasPorId) {
  const precio =
    producto.precio_venta ??
    producto.precio ??
    producto.precio_final ??
    producto.precio_publico ??
    0;

  const categoria =
    categoriasPorId[String(producto.categoria_id || "")] ||
    producto.categoria_nombre ||
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
    producto_id: producto.id,
    code: codigo,
    codigo_barras: producto.codigo_barras || "",
    codigo_interno: producto.codigo_interno || producto.codigo || "",
    name: producto.nombre || producto.descripcion || "Producto sin nombre",
    nombre: producto.nombre || producto.descripcion || "Producto sin nombre",
    category: categoria,
    categoria,
    categoria_id: producto.categoria_id || null,
    marca: producto.marca || "",
    price: Math.round(Number(precio || 0)),
    oldPrice: producto.precio_anterior ? Number(producto.precio_anterior) : null,
    stock: Number(producto.stock_actual ?? producto.stock ?? 0),
    image: producto.imagen_url || producto.imagen || producto.foto_url || producto.icono || "",
    imageUrl: producto.imagen_url || producto.imagen || producto.foto_url || "",
    imagen_url: producto.imagen_url || producto.imagen || producto.foto_url || "",
    updated_at: producto.updated_at || producto.imagen_updated_at || producto.created_at || "",
    imagen_version: producto.updated_at || producto.imagen_updated_at || producto.created_at || "",
    badge: producto.destacado ? "Destacado" : null,
  };
}

export async function GET() {
  try {
    const [{ data: productosData, error: productosError }, { data: categoriasData }] =
      await Promise.all([
        supabase
          .from("productos")
          .select("*")
          .order("nombre", { ascending: true }),
        supabase
          .from("categorias")
          .select("id, nombre"),
      ]);

    if (productosError) {
      return NextResponse.json(
        { ok: false, error: productosError.message },
        { status: 500 }
      );
    }

    const categoriasPorId = {};
    for (const categoria of categoriasData || []) {
      categoriasPorId[String(categoria.id)] = categoria.nombre;
    }

    const productos = (productosData || [])
      .filter(isVisible)
      .map((producto) => mapProducto(producto, categoriasPorId))
      .filter((producto) => producto.price > 0);

    return NextResponse.json(
      { ok: true, productos, generated_at: new Date().toISOString() },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error.message || "Error al cargar productos" },
      { status: 500 }
    );
  }
}
