import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getMPConfig, requireMPToken, readMPResponse } from "@/lib/mercadoPagoServer";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function precioComercial(value) {
  return Math.round(Number(value || 0));
}

function cleanText(value) {
  return String(value || "").trim();
}

function getBaseUrl(request) {
  const url = new URL(request.url);
  return process.env.NEXT_PUBLIC_SITE_URL || `${url.protocol}//${url.host}`;
}

function normalizarMetodoPago(value) {
  const metodo = cleanText(value).toLowerCase();
  return metodo === "mercado_pago" ? "mercado_pago" : "pagar_al_retirar";
}

async function actualizarPedidoSeguro(id, payload) {
  const { error } = await supabase.from("pedidos_web").update(payload).eq("id", id);
  if (!error) return;

  // Si todavía no se ejecutó el SQL de columnas Mercado Pago, no bloqueamos el pedido.
  const fallback = { ...payload };
  delete fallback.mercado_pago_preference_id;
  delete fallback.mercado_pago_init_point;
  delete fallback.mercado_pago_sandbox_init_point;
  delete fallback.mercado_pago_external_reference;
  delete fallback.updated_at;

  await supabase.from("pedidos_web").update(fallback).eq("id", id);
}

async function crearPreferenciaMercadoPago({ request, pedido, items, clienteEmail }) {
  const mpConfig = await getMPConfig();
  const accessToken = requireMPToken(mpConfig);
  const baseUrl = getBaseUrl(request);
  const externalReference = `pedido_web:${pedido.id}`;

  const preferenceBody = {
    external_reference: externalReference,
    notification_url: `${baseUrl}/api/mercadopago/webhook`,
    back_urls: {
      success: `${baseUrl}/tienda/pago?estado=aprobado&pedido=${encodeURIComponent(pedido.numero_pedido || pedido.id)}`,
      pending: `${baseUrl}/tienda/pago?estado=pendiente&pedido=${encodeURIComponent(pedido.numero_pedido || pedido.id)}`,
      failure: `${baseUrl}/tienda/pago?estado=rechazado&pedido=${encodeURIComponent(pedido.numero_pedido || pedido.id)}`,
    },
    auto_return: "approved",
    payer: clienteEmail ? { email: clienteEmail } : undefined,
    metadata: {
      pedido_web_id: String(pedido.id),
      numero_pedido: pedido.numero_pedido,
      origen: "cole_tienda_web",
    },
    items: items.map((item) => ({
      id: String(item.producto_id || item.codigo_barras || item.codigo_interno || item.nombre_producto),
      title: item.nombre_producto,
      quantity: Number(item.cantidad || 1),
      unit_price: precioComercial(item.precio_unitario || 0),
      currency_id: "ARS",
    })),
  };

  const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(preferenceBody),
  });

  const mpData = await readMPResponse(mpRes);
  if (!mpRes.ok) {
    throw new Error(
      mpData?.message || mpData?.error || "Mercado Pago no pudo crear la preferencia de pago."
    );
  }

  await actualizarPedidoSeguro(pedido.id, {
    mercado_pago_preference_id: mpData.id || null,
    mercado_pago_init_point: mpData.init_point || null,
    mercado_pago_sandbox_init_point: mpData.sandbox_init_point || null,
    mercado_pago_external_reference: externalReference,
    estado_pago: "pendiente_pago",
    metodo_pago: "mercado_pago",
    updated_at: new Date().toISOString(),
  });

  return mpData;
}

export async function POST(request) {
  try {
    const body = await request.json();

    const clienteNombre = cleanText(body.cliente_nombre || body.nombre_cliente);
    const clienteTelefono = cleanText(body.cliente_telefono || body.telefono_cliente);
    const clienteEmail = cleanText(body.cliente_email || body.email_cliente);
    const observaciones = cleanText(body.observaciones);
    const metodoPago = normalizarMetodoPago(body.metodo_pago);
    const items = Array.isArray(body.items) ? body.items : [];

    if (!clienteNombre) {
      return NextResponse.json({ ok: false, error: "Falta el nombre del cliente." }, { status: 400 });
    }

    if (!clienteTelefono) {
      return NextResponse.json({ ok: false, error: "Falta el teléfono del cliente." }, { status: 400 });
    }

    if (items.length === 0) {
      return NextResponse.json({ ok: false, error: "El carrito está vacío." }, { status: 400 });
    }

    if (metodoPago === "mercado_pago" && !clienteEmail) {
      return NextResponse.json(
        { ok: false, error: "Para pagar online con Mercado Pago necesitamos un email." },
        { status: 400 }
      );
    }

    const itemsLimpios = items.map((item) => {
      const cantidad = Number(item.cantidad || 1);
      const precioUnitario = precioComercial(item.precio_unitario || 0);

      return {
        producto_id: item.producto_id || null,
        codigo_barras: cleanText(item.codigo_barras || item.codigo),
        codigo_interno: cleanText(item.codigo_interno),
        nombre_producto: cleanText(item.nombre_producto || item.nombre || "Producto"),
        cantidad,
        precio_unitario: precioUnitario,
        subtotal: cantidad * precioUnitario,
        stock_actual: Number(item.stock_actual || 0),
      };
    });

    const total = precioComercial(itemsLimpios.reduce((sum, item) => sum + Number(item.subtotal || 0), 0));
    const numeroPedido = `WEB-${Date.now()}`;

    const pedidoPayload = {
      numero_pedido: numeroPedido,
      cliente_nombre: clienteNombre,
      cliente_telefono: clienteTelefono,
      cliente_email: clienteEmail || null,
      observaciones: observaciones || null,
      total,
      estado: "nuevo",
      estado_pago: "pendiente_pago",
      metodo_pago: metodoPago,
      estado_facturacion: "pendiente",
      nombre_cliente: clienteNombre,
      telefono_cliente: clienteTelefono,
      email_cliente: clienteEmail || null,
    };

    const { data: pedido, error: pedidoError } = await supabase
      .from("pedidos_web")
      .insert(pedidoPayload)
      .select("*")
      .single();

    if (pedidoError) {
      return NextResponse.json({ ok: false, error: pedidoError.message }, { status: 500 });
    }

    const itemsPayload = itemsLimpios.map((item) => ({ ...item, pedido_web_id: pedido.id }));
    const { error: itemsError } = await supabase.from("pedido_web_items").insert(itemsPayload);

    if (itemsError) {
      await supabase.from("pedidos_web").delete().eq("id", pedido.id);
      return NextResponse.json({ ok: false, error: itemsError.message }, { status: 500 });
    }

    if (metodoPago === "mercado_pago") {
      try {
        const preferencia = await crearPreferenciaMercadoPago({ request, pedido, items: itemsLimpios, clienteEmail });
        return NextResponse.json({
          ok: true,
          pedido: { ...pedido, metodo_pago: "mercado_pago" },
          mercado_pago: {
            preference_id: preferencia.id,
            checkout_url: preferencia.init_point,
            sandbox_checkout_url: preferencia.sandbox_init_point,
          },
        });
      } catch (error) {
        await supabase.from("pedido_web_items").delete().eq("pedido_web_id", pedido.id);
        await supabase.from("pedidos_web").delete().eq("id", pedido.id);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, pedido });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error.message || "Error al crear pedido" },
      { status: 500 }
    );
  }
}
