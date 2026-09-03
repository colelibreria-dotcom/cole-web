import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    const { data: managedBanners, error: managedError } = await supabase
      .from("banners_tienda")
      .select("titulo, imagen_url, orden")
      .eq("activo", true)
      .order("orden", { ascending: true })
      .order("created_at", { ascending: true });

    if (!managedError) {
      return NextResponse.json(
        { ok: true, banners: (managedBanners || []).map((banner) => ({ src: banner.imagen_url, alt: banner.titulo || "Banner COLE" })) },
        { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate", Pragma: "no-cache", Expires: "0" } }
      );
    }

    // Mantiene las imágenes incluidas en el sitio hasta que se ejecute la
    // migración de banners administrables en Supabase.
    const bannersDir = path.join(process.cwd(), "public", "banners");

    if (!fs.existsSync(bannersDir)) {
      return NextResponse.json({ ok: true, banners: [] });
    }

    const files = fs
      .readdirSync(bannersDir)
      .filter((file) => EXTENSIONS.has(path.extname(file).toLowerCase()))
      .sort((a, b) => a.localeCompare(b, "es", { numeric: true }));

    const banners = files.map((file) => ({
      src: `/banners/${file}`,
      alt: file.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "),
    }));

    return NextResponse.json(
      { ok: true, banners },
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
      { ok: false, error: error.message || "Error al cargar banners" },
      { status: 500 }
    );
  }
}
