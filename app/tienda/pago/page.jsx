export const dynamic = "force-dynamic";

export default async function PagoTiendaPage({ searchParams }) {
  const params = await searchParams;
  const estado = params?.estado || "pendiente";
  const pedido = params?.pedido || "";

  const textos = {
    aprobado: {
      titulo: "Pago recibido",
      mensaje: "Tu pedido quedó pagado. Vamos a prepararlo para retiro en COLE.",
    },
    pendiente: {
      titulo: "Pago pendiente",
      mensaje: "Mercado Pago todavía está procesando el pago. Te avisaremos cuando quede confirmado.",
    },
    rechazado: {
      titulo: "Pago no completado",
      mensaje: "El pago no se completó. Podés volver a la tienda e intentar nuevamente.",
    },
  };

  const info = textos[estado] || textos.pendiente;

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f6f7f9", padding: 24, fontFamily: "Arial, sans-serif" }}>
      <section style={{ width: "min(520px, 100%)", background: "white", borderRadius: 28, padding: 28, boxShadow: "0 20px 60px rgba(15,23,42,.12)", textAlign: "center" }}>
        <h1 style={{ margin: 0, color: "#111827", fontSize: 34 }}>{info.titulo}</h1>
        {pedido && <p style={{ color: "#0f172a", fontWeight: 900, fontSize: 18 }}>Pedido #{pedido}</p>}
        <p style={{ color: "#475569", lineHeight: 1.5 }}>{info.mensaje}</p>
        <a href="/" style={{ display: "inline-block", marginTop: 16, borderRadius: 16, padding: "13px 18px", background: "#111827", color: "white", textDecoration: "none", fontWeight: 900 }}>Volver a la tienda</a>
      </section>
    </main>
  );
}
