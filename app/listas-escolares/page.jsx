export const metadata = {
  title: "Listas escolares | COLE Librería y Papelería",
  description: "Elegí y personalizá tu lista escolar en COLE Librería y Papelería.",
};

export default function ListasEscolaresPage() {
  return <main className="listas-esperando">
    <header><a href="/" aria-label="Volver a COLE"><img src="/logo-web.png" alt="COLE" /></a><a href="/">Volver al catálogo</a></header>
    <section className="listas-hero"><span>Listas escolares</span><h1>Armá tu lista a tu manera.</h1><p>Podés enviarnos la lista de tu escuela y la preparamos para que elijas los artículos que necesites.</p></section>
    <section className="listas-message"><h2>Estamos preparando las listas 2027</h2><p>Mandanos una foto o el archivo de la lista por WhatsApp y te ayudamos a armarla.</p><a href="https://wa.me/5492246441486?text=Hola%20COLE%2C%20quiero%20enviar%20una%20lista%20escolar." target="_blank" rel="noopener noreferrer">Enviar lista por WhatsApp</a></section>
    <style>{`.listas-esperando{min-height:100vh;background:#f4f8fb;color:#10233d;font-family:Inter,Arial,sans-serif}.listas-esperando header{height:76px;width:min(1180px,calc(100% - 40px));margin:auto;display:flex;align-items:center;justify-content:space-between}.listas-esperando header img{width:86px;height:54px;object-fit:contain}.listas-esperando header a{color:#1f2937;text-decoration:none;font-size:14px;font-weight:800}.listas-hero{background:#dff1fb;padding:62px max(20px,calc((100% - 1180px)/2));border-top:1px solid #d1e7f3}.listas-hero span{color:#09699a;font-size:13px;font-weight:900;text-transform:uppercase}.listas-hero h1{margin:8px 0;font-size:44px}.listas-hero p{max-width:620px;margin:0;color:#40536b;font-size:18px;line-height:1.5}.listas-message{width:min(760px,calc(100% - 40px));margin:44px auto;padding:38px;text-align:center;background:#fff;border:1px solid #dbe5eb;border-radius:8px}.listas-message h2{margin:0}.listas-message p{color:#52616e}.listas-message a{display:inline-block;margin-top:8px;padding:11px 15px;border-radius:7px;background:#0b6fa4;color:#fff;text-decoration:none;font-weight:850}@media(max-width:760px){.listas-esperando header,.listas-message{width:calc(100% - 24px)}.listas-hero{padding:42px 12px}.listas-hero h1{font-size:34px}}`}</style>
  </main>;
}
