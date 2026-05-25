import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getMPConfig, requireMPToken, readMPResponse } from "@/lib/mercadoPagoServer";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function extraerPaymentId(url, body) {
  return (
    url.searchParams.get("id") ||
    url.searchParams.get("data.id") ||
    body?.data?.id ||
    body?.id ||
    body?.resource?.split("/").pop() ||
    ""
  );
}

function esNotificacionPago(url, body) {
  const topic = url.searchParams.get("topic") || url.searchParams.get("type") || body?.topic || body?.type || body?.action;
  return String(topic || "").includes("payment") || !!body?.data?.id;
}

function pedidoIdDesdeReferencia(reference, payment) {
  const ref = String(reference || payment?.external_reference || "");
  const match = ref.match(/pedido_web:(\d+)/);
  if (match) return Number(match[1]);
  const metadataId = payment?.metadata?.pedido_web_id;
  return metadataId ? Number(metadataId) : null;
}

async function actualizarPedidoPagoSeguro(id, payload) {
  const { error } = await supabase.from("pedidos_web").update(payload).eq("id", id);
  if (!error) return;

  const fallback = { ...payload };
  delete fallback.mercado_pago_payment_id;
  delete fallback.mercado_pago_status;
  delete fallback.mercado_pago_status_detail;
  delete fallback.paid_at;
  delete fallback.updated_at;
  await supabase.from("pedidos_web").update(fallback).eq("id", id);
}

async function procesarPago(paymentId) {
  const mpConfig = await getMPConfig();
  const accessToken = requireMPToken(mpConfig);

  const res = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const payment = await readMPResponse(res);
  if (!res.ok) throw new Error(payment?.message || "No se pudo leer el pago de Mercado Pago.");

  const pedidoId = pedidoIdDesdeReferencia(payment.external_reference, payment);
  if (!pedidoId) return { ok: true, ignored: true, reason: "No corresponde a pedido web" };

  const status = String(payment.status || "");
  const statusDetail = String(payment.status_detail || "");
  const common = {
    metodo_pago: "mercado_pago",
    mercado_pago_payment_id: String(payment.id || paymentId),
    mercado_pago_status: status,
    mercado_pago_status_detail: statusDetail,
    updated_at: new Date().toISOString(),
  };

  if (status === "approved") {
    await actualizarPedidoPagoSeguro(pedidoId, {
      ...common,
      estado_pago: "pagado",
      estado: "en_preparacion",
      paid_at: payment.date_approved || new Date().toISOString(),
    });
    return { ok: true, pedido_id: pedidoId, status };
  }

  if (["cancelled", "rejected", "refunded", "charged_back"].includes(status)) {
    await actualizarPedidoPagoSeguro(pedidoId, {
      ...common,
      estado_pago: status === "refunded" ? "devuelto" : "rechazado",
    });
    return { ok: true, pedido_id: pedidoId, status };
  }

  await actualizarPedidoPagoSeguro(pedidoId, {
    ...common,
    estado_pago: "pendiente_pago",
  });

  return { ok: true, pedido_id: pedidoId, status };
}

export async function POST(request) {
  try {
    const url = new URL(request.url);
    const body = await request.json().catch(() => ({}));

    if (!esNotificacionPago(url, body)) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const paymentId = extraerPaymentId(url, body);
    if (!paymentId) return NextResponse.json({ ok: true, ignored: true, reason: "sin payment id" });

    const result = await procesarPago(paymentId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error webhook Mercado Pago:", error);
    // Mercado Pago reintenta si respondemos error. Para evitar duplicados violentos, respondemos 200 y logueamos.
    return NextResponse.json({ ok: true, error: error.message || "Error procesando webhook" });
  }
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const paymentId = extraerPaymentId(url, {});
    if (paymentId) return NextResponse.json(await procesarPago(paymentId));
    return NextResponse.json({ ok: true, service: "COLE Mercado Pago webhook" });
  } catch (error) {
    return NextResponse.json({ ok: true, error: error.message || "Error procesando webhook" });
  }
}
