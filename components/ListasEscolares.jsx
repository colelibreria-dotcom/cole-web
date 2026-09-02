"use client";

import { useEffect, useMemo, useState } from "react";

const WHATSAPP = "5492246441486";
const PLANES = [
  { id: "economica", title: "Económica", description: "La alternativa más conveniente." },
  { id: "recomendada", title: "Recomendada", description: "Equilibrio entre calidad y precio." },
  { id: "premium", title: "Premium", description: "Primeras marcas y mayor duración." },
];

function price(value) {
  return Math.round(Number(value || 0)).toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
}

export default function ListasEscolares() {
  const [data, setData] = useState({ escuelas: [], listas: [], items: [] });
  const [escuelaId, setEscuelaId] = useState("");
  const [listaId, setListaId] = useState("");
  const [plan, setPlan] = useState("recomendada");
  const [selected, setSelected] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/tienda/listas-escolares", { cache: "no-store" })
      .then((response) => response.json().then((body) => ({ response, body })))
      .then(({ response, body }) => {
        if (!response.ok || !body.ok) throw new Error(body.error || "No se pudieron cargar las listas.");
        setData(body);
      })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

  const listasDeEscuela = useMemo(
    () => data.listas.filter((lista) => !escuelaId || String(lista.escuela_id) === escuelaId),
    [data.listas, escuelaId]
  );
  const lista = data.listas.find((item) => String(item.id) === listaId) || listasDeEscuela[0] || null;
  const items = useMemo(() => data.items.filter((item) => String(item.lista_id) === String(lista?.id || "")), [data.items, lista]);

  useEffect(() => {
    if (!lista) return;
    const initial = {};
    for (const item of items) {
      const option = (item.lista_escolar_opciones || []).find((candidate) => candidate.nivel === plan);
      if (option) initial[item.id] = option.id;
    }
    setSelected(initial);
  }, [lista?.id, plan, items]);

  function selectPlan(planId) {
    setPlan(planId);
  }

  function toggleItem(item, option) {
    setSelected((current) => ({ ...current, [item.id]: current[item.id] === option.id ? "" : option.id }));
  }

  function openConsultation() {
    const selectedItems = items
      .map((item) => {
        const option = (item.lista_escolar_opciones || []).find((candidate) => candidate.id === selected[item.id]);
        if (!option) return "";
        return `- ${item.cantidad || 1} x ${option.productos?.nombre || item.nombre}`;
      })
      .filter(Boolean)
      .join("\n");
    const escuela = data.escuelas.find((item) => String(item.id) === String(lista?.escuela_id));
    const message = [
      "Hola COLE, quisiera consultar esta lista escolar.",
      escuela ? `Escuela: ${escuela.nombre}` : "",
      lista?.titulo ? `Lista: ${lista.titulo}` : "",
      "",
      selectedItems || "Quiero recibir ayuda para armarla.",
    ].filter(Boolean).join("\n");
    window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <main className="lists-page">
      <header className="lists-header"><a href="/" aria-label="Volver a COLE"><img src="/logo-web.png" alt="COLE" /></a><a href="/" className="lists-back">Volver al catálogo</a></header>
      <section className="lists-hero"><span>Listas escolares</span><h1>Armá tu lista a tu manera.</h1><p>Elegí una alternativa completa o combiná productos según lo que necesitás.</p></section>
      <section className="lists-content">
        {loading && <p className="lists-empty">Cargando listas escolares...</p>}
        {error && <p className="lists-empty">{error}</p>}
        {!loading && !error && data.escuelas.length === 0 && <div className="lists-empty"><h2>Estamos preparando las listas 2027</h2><p>Mandanos la lista de tu escuela por WhatsApp y te ayudamos a armarla.</p><a href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent("Hola COLE, quiero enviar una lista escolar.")}`} target="_blank" rel="noopener noreferrer">Consultar por WhatsApp</a></div>}
        {!loading && !error && data.escuelas.length > 0 && <>
          <div className="lists-selectors">
            <label>Escuela<select value={escuelaId} onChange={(event) => { setEscuelaId(event.target.value); setListaId(""); }}><option value="">Elegí una escuela</option>{data.escuelas.map((escuela) => <option key={escuela.id} value={escuela.id}>{escuela.nombre}{escuela.localidad ? ` - ${escuela.localidad}` : ""}</option>)}</select></label>
            <label>Curso o lista<select value={lista?.id || ""} onChange={(event) => setListaId(event.target.value)} disabled={listasDeEscuela.length === 0}><option value="">Elegí una lista</option>{listasDeEscuela.map((listaItem) => <option key={listaItem.id} value={listaItem.id}>{listaItem.titulo || `${listaItem.nivel || ""} ${listaItem.curso || ""}`.trim()}</option>)}</select></label>
          </div>
          {!lista ? <div className="lists-empty"><h2>Elegí una escuela</h2><p>Cuando su lista esté cargada, vas a poder elegir las tres alternativas.</p></div> : <>
            <div className="lists-intro"><div><h2>{lista.titulo}</h2><p>{lista.descripcion || "Elegí una alternativa o combiná artículos entre las tres columnas."}</p></div><button type="button" onClick={openConsultation}>Consultar selección</button></div>
            <div className="lists-plans">{PLANES.map((item) => <button type="button" key={item.id} onClick={() => selectPlan(item.id)} className={plan === item.id ? "active" : ""}><strong>{item.title}</strong><span>{item.description}</span></button>)}</div>
            <div className="lists-columns">{PLANES.map((planItem) => <section key={planItem.id} className={`lists-column ${plan === planItem.id ? "selected" : ""}`}><header><h2>{planItem.title}</h2><button type="button" onClick={() => selectPlan(planItem.id)}>Elegir completa</button></header>{items.map((item) => { const option = (item.lista_escolar_opciones || []).find((candidate) => candidate.nivel === planItem.id); if (!option) return <div key={item.id} className="lists-missing">{item.cantidad || 1} x {item.nombre}</div>; return <label key={item.id} className="lists-item"><input type="checkbox" checked={selected[item.id] === option.id} onChange={() => toggleItem(item, option)} /><span>{option.productos?.imagen_url && <img src={option.productos.imagen_url} alt="" />}<strong>{item.cantidad || 1} x {option.productos?.nombre || item.nombre}</strong><small>{price(option.productos?.precio_venta)}</small></span></label>; })}</section>)}</div>
          </>}
        </>}
      </section>
      <style jsx>{`
        .lists-page{min-height:100vh;background:#f4f8fb;color:#111827;font-family:Inter,Arial,sans-serif}.lists-header{width:min(1180px,calc(100% - 40px));margin:auto;height:76px;display:flex;align-items:center;justify-content:space-between}.lists-header img{width:86px;height:54px;object-fit:contain}.lists-back{color:#1f2937;text-decoration:none;font-size:14px;font-weight:800}.lists-hero{background:#dff1fb;padding:62px max(20px,calc((100% - 1180px)/2));border-top:1px solid #d1e7f3}.lists-hero span{color:#09699a;font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:.08em}.lists-hero h1{margin:8px 0;color:#10233d;font-size:44px;letter-spacing:0}.lists-hero p{margin:0;max-width:620px;color:#40536b;font-size:18px;line-height:1.5}.lists-content{width:min(1180px,calc(100% - 40px));margin:34px auto 60px}.lists-selectors{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px}.lists-selectors label{display:grid;gap:7px;color:#374151;font-size:13px;font-weight:850}.lists-selectors select{height:48px;border:1px solid #cbd5e1;border-radius:8px;padding:0 12px;background:#fff;color:#111827;font-size:15px}.lists-empty{padding:36px;background:#fff;border:1px solid #dbe5eb;border-radius:8px;text-align:center;color:#52616e}.lists-empty h2{margin:0;color:#111827}.lists-empty a,.lists-intro button{display:inline-block;margin-top:14px;border:0;border-radius:7px;background:#0b6fa4;color:#fff;padding:11px 15px;font-weight:850;text-decoration:none;cursor:pointer}.lists-intro{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;margin:12px 0 20px}.lists-intro h2{margin:0;font-size:25px}.lists-intro p{margin:6px 0 0;color:#64748b}.lists-plans{display:flex;gap:10px;margin-bottom:18px}.lists-plans button{flex:1;text-align:left;border:1px solid #cbd5e1;border-radius:8px;background:#fff;padding:13px;cursor:pointer}.lists-plans button.active{border-color:#0b6fa4;box-shadow:0 0 0 2px #bce5f8}.lists-plans strong,.lists-plans span{display:block}.lists-plans span{margin-top:3px;color:#64748b;font-size:12px}.lists-columns{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.lists-column{border:1px solid #d8e2e8;background:#fff;border-radius:8px;overflow:hidden}.lists-column.selected{border-color:#0b6fa4;box-shadow:0 0 0 2px #d5effb}.lists-column header{display:flex;align-items:center;justify-content:space-between;padding:16px;border-bottom:1px solid #e5edf1;background:#f9fcfe}.lists-column h2{margin:0;font-size:19px}.lists-column header button{border:0;background:transparent;color:#0b6fa4;font-weight:850;cursor:pointer}.lists-item{display:grid;grid-template-columns:auto 1fr;gap:10px;padding:13px;border-bottom:1px solid #eef2f5;cursor:pointer}.lists-item input{width:18px;height:18px;margin-top:3px;accent-color:#0b6fa4}.lists-item span{display:grid;grid-template-columns:42px 1fr;column-gap:9px;align-items:center}.lists-item img{width:42px;height:42px;grid-row:span 2;object-fit:contain}.lists-item strong{font-size:13px;line-height:1.25}.lists-item small{color:#0b6fa4;font-size:13px;font-weight:850}.lists-missing{padding:13px;color:#94a3b8;font-size:13px;border-bottom:1px solid #eef2f5}@media(max-width:760px){.lists-header,.lists-content{width:min(100% - 24px,1180px)}.lists-hero{padding:42px 12px}.lists-hero h1{font-size:34px}.lists-selectors,.lists-columns{grid-template-columns:1fr}.lists-intro{display:grid}.lists-plans{overflow-x:auto}.lists-plans button{min-width:190px}.lists-column{margin-bottom:4px}}
      `}</style>
    </main>
  );
}
