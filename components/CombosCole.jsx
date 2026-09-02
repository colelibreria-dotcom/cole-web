"use client";

import { useEffect, useState } from "react";

const WHATSAPP = "5492246441486";
const price = (value) => Math.round(Number(value || 0)).toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

export default function CombosCole() {
  const [combos, setCombos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/tienda/combos", { cache: "no-store" })
      .then((response) => response.json())
      .then((body) => setCombos(body.combos || []))
      .catch(() => setCombos([]))
      .finally(() => setLoading(false));
  }, []);

  return <main className="combos-page">
    <header><a href="/" aria-label="Volver a COLE"><img src="/logo-web.png" alt="COLE" /></a><a href="/">Volver al catálogo</a></header>
    <section className="combos-hero"><span>Combos COLE</span><h1>Todo junto, listo para elegir.</h1><p>Una selección de artículos con un precio especial para resolver compras completas.</p></section>
    <section className="combos-content">
      {loading && <p className="combos-empty">Cargando combos...</p>}
      {!loading && combos.length === 0 && <div className="combos-empty"><h2>Próximamente, combos para vos.</h2><p>Consultanos y armamos una combinación según lo que necesitás.</p></div>}
      <div className="combos-grid">{combos.map((combo) => <article key={combo.id} className="combo-card">
        <div className="combo-images">{combo.items.slice(0, 4).map((item) => <img key={item.productos.id} src={item.productos.imagen_url || item.productos.imagen || "/placeholder-product.png"} alt="" />)}</div>
        <div className="combo-body"><h2>{combo.nombre}</h2>{combo.descripcion && <p>{combo.descripcion}</p>}<ul>{combo.items.map((item) => <li key={item.productos.id}>{Number(item.cantidad || 1)} x {item.productos.nombre}</li>)}</ul><strong>{price(combo.precio_venta)}</strong><a target="_blank" rel="noopener noreferrer" href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(`Hola COLE, quiero consultar el ${combo.nombre}.`)}`}>Consultar combo</a></div>
      </article>)}</div>
    </section>
    <style jsx>{`.combos-page{min-height:100vh;background:#f4f8fb;color:#10233d;font-family:Inter,Arial,sans-serif}.combos-page header{height:76px;width:min(1180px,calc(100% - 40px));margin:auto;display:flex;align-items:center;justify-content:space-between}.combos-page header img{width:86px;height:54px;object-fit:contain}.combos-page header a{color:#1f2937;text-decoration:none;font-size:14px;font-weight:800}.combos-hero{background:#dff1fb;padding:62px max(20px,calc((100% - 1180px)/2));border-top:1px solid #d1e7f3}.combos-hero span{color:#09699a;font-size:13px;font-weight:900;text-transform:uppercase}.combos-hero h1{margin:8px 0;font-size:44px}.combos-hero p{margin:0;max-width:600px;color:#40536b;font-size:18px;line-height:1.5}.combos-content{width:min(1180px,calc(100% - 40px));margin:34px auto 60px}.combos-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.combo-card{overflow:hidden;border:1px solid #d8e2e8;border-radius:8px;background:#fff}.combo-images{min-height:170px;display:grid;grid-template-columns:repeat(2,1fr);gap:1px;background:#e8f0f4}.combo-images img{width:100%;height:120px;object-fit:contain;background:#fff;padding:8px}.combo-body{padding:18px}.combo-body h2{margin:0;font-size:20px}.combo-body p{color:#64748b;font-size:14px}.combo-body ul{padding-left:18px;color:#40536b;font-size:13px;line-height:1.55}.combo-body strong{display:block;font-size:25px;margin:14px 0}.combo-body a{display:inline-block;background:#0b6fa4;color:#fff;border-radius:7px;padding:10px 14px;text-decoration:none;font-weight:850}.combos-empty{padding:36px;text-align:center;border:1px solid #dbe5eb;border-radius:8px;background:#fff;color:#52616e}.combos-empty h2{margin:0;color:#10233d}@media(max-width:760px){.combos-page header,.combos-content{width:calc(100% - 24px)}.combos-hero{padding:42px 12px}.combos-hero h1{font-size:34px}.combos-grid{grid-template-columns:1fr}}`}</style>
  </main>;
}
