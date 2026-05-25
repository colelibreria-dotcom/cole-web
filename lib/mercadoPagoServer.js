import { createClient } from "@supabase/supabase-js";

function getSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Faltan variables de entorno de Supabase.");
  return createClient(url, key);
}

export async function getMPConfig() {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("mercado_pago_config").select("*").eq("id", 1).maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function saveMPConfig(updates) {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("mercado_pago_config")
    .upsert({ id: 1, ...updates, updated_at: new Date().toISOString() })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export function requireMPToken(config) {
  if (!config?.access_token) throw new Error("Falta configurar el Access Token de Mercado Pago.");
  return config.access_token;
}

export function getCajaActual(config, cajaOverride) {
  const caja = String(cajaOverride || config?.caja_actual || "Caja1").trim().toLowerCase();
  return caja === "caja2" ? "Caja2" : "Caja1";
}

export function getCajaConfig(config, cajaNombre) {
  const caja = getCajaActual(config, cajaNombre);
  if (caja === "Caja2") {
    return {
      nombre: config.caja2_nombre || "Caja2",
      external_store_id: config.caja2_external_store_id || "74192547",
      external_pos_id: config.caja2_external_pos_id || "CAJA2",
      pos_id: config.caja2_pos_id || "125682555",
      point_device_id: config.caja2_point_device_id || "NEWLAND_N950__N950NCC904507910",
      point_order_id: config.caja2_point_order_id || "",
    };
  }
  return {
    nombre: config.caja1_nombre || "Caja1",
    external_store_id: config.caja1_external_store_id || "74192547",
    external_pos_id: config.caja1_external_pos_id || "CAJA1",
    pos_id: config.caja1_pos_id || "3989436",
    point_device_id: config.caja1_point_device_id || "NEWLAND_N950__N950NCC804224187",
    point_order_id: config.caja1_point_order_id || "",
  };
}

export function pointOrderColumn(cajaNombre) {
  return getCajaActual({}, cajaNombre) === "Caja2" ? "caja2_point_order_id" : "caja1_point_order_id";
}

export function maskSecret(value) {
  if (!value) return "";
  const text = String(value);
  if (text.length <= 12) return "********";
  return `${text.slice(0, 8)}...${text.slice(-6)}`;
}

export async function readMPResponse(res) {
  const text = await res.text();
  try { return text ? JSON.parse(text) : null; } catch { return text; }
}
