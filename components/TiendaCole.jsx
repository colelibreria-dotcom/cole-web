"use client";

import React, { useEffect, useMemo, useState } from "react";

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

function precioComercial(value) {
  return Math.round(Number(value || 0));
}

function formatPrice(value) {
  return currency.format(precioComercial(value));
}

function clampQuantity(value, min = 1, max = 999) {
  const number = Number.parseInt(value, 10);
  if (Number.isNaN(number)) return min;
  return Math.min(max, Math.max(min, number));
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getProductId(product) {
  const base = String(product.id ?? product.producto_id ?? product.codigo_barras ?? product.codigo_interno ?? product.code ?? product.name);
  return product.variante_id ? `${base}::${product.variante_id}` : base;
}

function getBaseProductId(product) {
  return String(product.id ?? product.producto_id ?? product.codigo_barras ?? product.codigo_interno ?? product.code ?? product.name);
}
function getProductCode(product) {
  return String(product.codigo_barras || product.codigo_interno || product.code || product.codigo || product.id || "");
}
function getProductName(product) {
  return String(product.nombre || product.name || product.descripcion || "Producto sin nombre");
}
function getProductCategory(product) {
  return String(product.categoria || product.rubro || product.category || "General");
}
function getProductPrice(product) {
  return precioComercial(product.precio_venta ?? product.price ?? product.precio ?? 0);
}
function getProductStock(product) {
  return Number(product.stock_actual ?? product.stock ?? product.existencia ?? 0);
}
function getProductImage(product) {
  const image = product.imagen_url || product.imagen || product.imageUrl || product.image || "";
  const clean = String(image || "").trim();

  // Evita intentar cargar emojis o textos como si fueran URLs.
  if (!clean || clean === "📦") return "";

  return clean;
}

function getProductImageVersion(product) {
  return String(
    product.updated_at ||
      product.updatedAt ||
      product.imagen_version ||
      product.imageVersion ||
      product.id ||
      ""
  ).replace(/[^0-9A-Za-z_-]/g, "");
}

function withImageVersion(src, product) {
  const version = getProductImageVersion(product);
  if (!src || !version) return src;
  const separator = src.includes("?") ? "&" : "?";
  return `${src}${separator}v=${version}`;
}

function addProductToCart(currentCart, product, quantityToAdd) {
  const id = getProductId(product);
  const found = currentCart.find((item) => getProductId(item) === id);
  if (found) {
    return currentCart.map((item) =>
      getProductId(item) === id
        ? { ...item, quantity: Number(item.quantity || 0) + quantityToAdd }
        : item
    );
  }
  return [...currentCart, { ...product, quantity: quantityToAdd }];
}

function calculateSubtotal(cart) {
  return cart.reduce((sum, item) => sum + getProductPrice(item) * Number(item.quantity || 0), 0);
}
function calculateTotalItems(cart) {
  return cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
}

function Icon({ children, className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {children}
    </svg>
  );
}

const Icons = {
  Search: ({ className = "" }) => <Icon className={className}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></Icon>,
  Cart: ({ className = "" }) => <Icon className={className}><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h8.7a2 2 0 0 0 2-1.6L23 6H6" /></Icon>,
  Plus: ({ className = "" }) => <Icon className={className}><path d="M12 5v14" /><path d="M5 12h14" /></Icon>,
  Minus: ({ className = "" }) => <Icon className={className}><path d="M5 12h14" /></Icon>,
  Trash: ({ className = "" }) => <Icon className={className}><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /></Icon>,
  X: ({ className = "" }) => <Icon className={className}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></Icon>,
  Check: ({ className = "" }) => <Icon className={className}><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-5" /></Icon>,
};

export default function TiendaCole() {
  const [products, setProducts] = useState([]);
  const [heroSlides, setHeroSlides] = useState([]);
  const [heroSlideIndex, setHeroSlideIndex] = useState(0);
  const [variantsByProductId, setVariantsByProductId] = useState({});
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productsError, setProductsError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todos");
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [sort, setSort] = useState("name-asc");
  const [cart, setCart] = useState([]);
  const [productQuantities, setProductQuantities] = useState({});
  const [selectedVariants, setSelectedVariants] = useState({});
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState("cart");
  const [checkout, setCheckout] = useState({ name: "", phone: "", email: "", notes: "", paymentMethod: "pagar_al_retirar" });
  const [sendingOrder, setSendingOrder] = useState(false);
  const [orderCreated, setOrderCreated] = useState(null);
  const [orderError, setOrderError] = useState("");

  useEffect(() => {
    loadProducts();
    loadHeroSlides();
  }, []);

  useEffect(() => {
    if (heroSlides.length <= 1) return;

    const timer = setInterval(() => {
      setHeroSlideIndex((current) => (current + 1) % heroSlides.length);
    }, 4500);

    return () => clearInterval(timer);
  }, [heroSlides.length]);

  async function loadHeroSlides() {
    try {
      const response = await fetch("/api/tienda/banners", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok || !data.ok || !Array.isArray(data.banners)) {
        setHeroSlides([]);
        return;
      }

      setHeroSlides(data.banners);
      setHeroSlideIndex(0);
    } catch {
      setHeroSlides([]);
    }
  }

  function seleccionarHeroSlide(index) {
    setHeroSlideIndex(index);
  }

  async function loadProducts() {
    try {
      setLoadingProducts(true);
      setProductsError("");
      const response = await fetch("/api/tienda/productos", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "No se pudieron cargar los productos.");
      const productos = Array.isArray(data.productos) ? data.productos : [];
      setProducts(productos);
      await loadVariants(productos);
    } catch (error) {
      console.error(error);
      setProductsError(error.message || "Error al cargar productos.");
    } finally {
      setLoadingProducts(false);
    }
  }

  async function loadVariants(productos) {
    try {
      const ids = productos
        .map((product) => product.id)
        .filter((id) =>
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id || ""))
        );
      if (ids.length === 0) {
        setVariantsByProductId({});
        return;
      }

      const response = await fetch(`/api/tienda/variantes?producto_ids=${encodeURIComponent(ids.join(","))}`, {
        cache: "no-store",
      });

      const responseText = await response.text();
      let data = {};

      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        setVariantsByProductId({});
        return;
      }

      if (!response.ok || !data.ok) {
        setVariantsByProductId({});
        return;
      }

      const grouped = {};
      for (const variante of data.variantes || []) {
        const key = String(variante.producto_id);
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(variante);
      }

      setVariantsByProductId(grouped);
    } catch {
      setVariantsByProductId({});
    }
  }

  function variantesDeProducto(product) {
    return variantsByProductId[getBaseProductId(product)] || [];
  }

  function varianteSeleccionada(product) {
    const variantes = variantesDeProducto(product);
    const baseId = getBaseProductId(product);
    const selectedId = selectedVariants[baseId];
    return variantes.find((v) => v.id === selectedId) || variantes[0] || null;
  }

  const categoryCounts = useMemo(() => {
    const counts = {};
    for (const product of products) {
      const cat = getProductCategory(product);
      if (!cat) continue;
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return counts;
  }, [products]);

  const categories = useMemo(() => {
    const list = products.map((product) => getProductCategory(product)).filter(Boolean);
    return ["Todos", ...Array.from(new Set(list)).sort((a, b) => a.localeCompare(b, "es"))];
  }, [products]);

  const featuredProducts = useMemo(() => products.slice(0, 4), [products]);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = normalizeText(query);
    const filtered = products.filter((product) => {
      const productText = normalizeText([getProductName(product), getProductCode(product), getProductCategory(product), product.marca, product.descripcion].join(" "));
      const matchesSearch = !normalizedQuery || productText.includes(normalizedQuery);
      const matchesCategory = category === "Todos" || getProductCategory(product) === category;
      return matchesSearch && matchesCategory;
    });

    return filtered.sort((a, b) => {
      if (sort === "name-asc") return getProductName(a).localeCompare(getProductName(b), "es");
      if (sort === "name-desc") return getProductName(b).localeCompare(getProductName(a), "es");
      if (sort === "price-asc") return getProductPrice(a) - getProductPrice(b);
      if (sort === "price-desc") return getProductPrice(b) - getProductPrice(a);
      return 0;
    });
  }, [products, query, category, sort]);

  const subtotal = calculateSubtotal(cart);
  const totalItems = calculateTotalItems(cart);

  function getProductQuantity(productId) { return productQuantities[productId] || 1; }
  function setProductQuantity(productId, value) { setProductQuantities((current) => ({ ...current, [productId]: clampQuantity(value) })); }
  function changeProductQuantity(productId, delta) { setProductQuantities((current) => ({ ...current, [productId]: clampQuantity((current[productId] || 1) + delta) })); }

  function addToCart(product) {
    const id = getBaseProductId(product);
    const quantityToAdd = getProductQuantity(id);
    const variante = varianteSeleccionada(product);
    const productoConVariante = variante
      ? {
          ...product,
          variante_id: variante.id,
          variante_nombre: variante.nombre,
          variante_descripcion: variante.descripcion || "",
        }
      : product;

    setCart((current) => addProductToCart(current, productoConVariante, quantityToAdd));
    setCheckoutStep("cart");
    setOrderCreated(null);
    setOrderError("");
  }

  function changeCartQuantity(productId, delta) {
    setCart((current) => current.map((item) => getProductId(item) === productId ? { ...item, quantity: Math.max(0, Number(item.quantity || 0) + delta) } : item).filter((item) => Number(item.quantity || 0) > 0));
  }
  function removeFromCart(productId) { setCart((current) => current.filter((item) => getProductId(item) !== productId)); }
  function openCart() { setCartOpen(true); setCheckoutStep("cart"); setOrderError(""); }

  async function createOrder() {
    if (cart.length === 0 || !checkout.name.trim() || !checkout.phone.trim()) return;
    try {
      setSendingOrder(true);
      setOrderError("");
      const payload = {
        cliente_nombre: checkout.name.trim(),
        cliente_telefono: checkout.phone.trim(),
        cliente_email: checkout.email.trim(),
        observaciones: checkout.notes.trim(),
        metodo_pago: checkout.paymentMethod,
        total: subtotal,
        items: cart.map((item) => ({
          producto_id: item.producto_id || item.id,
          id: item.id,
          codigo_barras: item.codigo_barras || item.code || "",
          codigo_interno: item.codigo_interno || "",
          nombre_producto: getProductName(item),
          variante_id: item.variante_id || null,
          variante_nombre: item.variante_nombre || null,
          cantidad: Number(item.quantity || 1),
          precio_unitario: getProductPrice(item),
          subtotal: getProductPrice(item) * Number(item.quantity || 1),
          stock_actual: getProductStock(item),
        })),
      };
      const response = await fetch("/api/tienda/pedidos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "No se pudo crear el pedido.");
      if (data.mercado_pago?.checkout_url) {
        window.location.href = data.mercado_pago.checkout_url;
        return;
      }
      setOrderCreated(data.pedido || true);
    } catch (error) {
      console.error(error);
      setOrderError(error.message || "Error al crear el pedido.");
    } finally {
      setSendingOrder(false);
    }
  }

  function resetOrder() {
    setCart([]);
    setProductQuantities({});
    setCheckout({ name: "", phone: "", email: "", notes: "", paymentMethod: "pagar_al_retirar" });
    setCheckoutStep("cart");
    setOrderCreated(null);
    setOrderError("");
    setCartOpen(false);
  }

  function renderProductImage(product, large = false) {
    const image = getProductImage(product);

    if (!image) {
      return (
        <span className={large ? "cole-product-emoji large" : "cole-product-emoji"}>
          📦
        </span>
      );
    }

    const rawSrc = /^https?:\/\//i.test(image)
      ? image
      : String(image).startsWith("/")
      ? image
      : `/${image}`;

    const src = withImageVersion(rawSrc, product);

    return (
      <div className="cole-img-frame">
        <img
          src={src}
          alt={getProductName(product)}
          className="cole-img-safe"
          loading="lazy"
          decoding="async"
          style={{
            display: "block",
            maxWidth: "100%",
            maxHeight: "100%",
            width: "auto",
            height: "auto",
            objectFit: "contain",
            objectPosition: "center",
          }}
        />
      </div>
    );
  }

  return (
    <div className="cole-store">
      <header className="cole-header"><div className="cole-shell cole-header-inner"><a href="/" className="cole-brand" aria-label="COLE Librería y Papelería"><img src="/logo-web.png" alt="COLE" className="cole-logo-img cole-logo-web" /><div><p className="cole-brand-title">COLE Librería y Papelería</p><p className="cole-brand-subtitle">Escolar · Oficina · Arte · Regalería</p></div></a><nav className="cole-nav" aria-label="Secciones de tienda">
  <div className="cole-catalog-dropdown">
    <button
      type="button"
      className="cole-nav-dropdown-button"
      onClick={() => setCategoryMenuOpen((open) => !open)}
    >
      Catálogo
    </button>
    {categoryMenuOpen && (
      <div className="cole-catalog-dropdown-panel">
        <button
          type="button"
          onClick={() => {
            setCategory("Todos");
            setCategoryMenuOpen(false);
            document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" });
          }}
          className={category === "Todos" ? "active" : ""}
        >
          Todos ({products.length})
        </button>
        {categories.filter((cat) => cat !== "Todos").map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => {
              setCategory(cat);
              setCategoryMenuOpen(false);
              document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" });
            }}
            className={category === cat ? "active" : ""}
          >
            {cat} ({categoryCounts[cat] || 0})
          </button>
        ))}
      </div>
    )}
  </div>
</nav><button type="button" onClick={openCart} className="cole-cart-button"><span>Carrito</span><Icons.Cart className="cole-icon" />{totalItems > 0 && <strong>{totalItems}</strong>}</button></div></header>
<main>
        <section className="cole-hero">
          <div className="cole-shell">
            <div className="cole-hero-slider">
              {heroSlides.length > 0 ? (
                <>
                  {heroSlides.map((slide, index) => (
                    <img
                      key={slide.src}
                      src={slide.src}
                      alt={slide.alt || "Promoción COLE"}
                      className={index === heroSlideIndex ? "active" : ""}
                    />
                  ))}

                  {heroSlides.length > 1 && (
                    <div className="cole-hero-dots">
                      {heroSlides.map((slide, index) => (
                        <button
                          key={slide.src}
                          type="button"
                          aria-label={`Ver imagen ${index + 1}`}
                          onClick={() => seleccionarHeroSlide(index)}
                          className={index === heroSlideIndex ? "active" : ""}
                        />
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="cole-hero-slide-empty">
                  <strong>COLE Librería y Papelería</strong>
                  <span>Agregá imágenes en public/banners para mostrarlas acá.</span>
                </div>
              )}
            </div>
          </div>
        </section>
        <section id="catalogo" className="cole-shell cole-catalog"><div className="cole-catalog-header"><div><span className="cole-section-kicker">Catálogo</span><h2>Productos destacados</h2><p>Los artículos se cargan desde la tabla de productos de COLE Gestión.</p></div><div className="cole-filters"><label className="cole-search"><span className="cole-search-icon-wrap"><Icons.Search className="cole-search-icon" /></span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar producto, código, rubro..." /></label><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="name-asc">Nombre A-Z</option><option value="name-desc">Nombre Z-A</option><option value="price-asc">Menor precio</option><option value="price-desc">Mayor precio</option></select></div></div>{productsError && <div className="cole-alert error">{productsError}<button type="button" onClick={loadProducts}>Reintentar</button></div>}{loadingProducts ? <div className="cole-empty">Cargando productos...</div> : filteredProducts.length === 0 ? <div className="cole-empty">No encontramos productos con esos filtros.</div> : <div className="cole-products-grid">{filteredProducts.map((product) => { const id = getProductId(product); const stock = getProductStock(product); return <article key={id} className="cole-product-card"><div className="cole-product-media">{renderProductImage(product, false)}{stock <= 0 ? <span className="cole-badge danger">Sin stock</span> : stock <= 5 ? <span className="cole-badge">Últimas unidades</span> : null}</div><div className="cole-product-info"><p className="cole-product-category">{getProductCategory(product)}</p><h3>{getProductName(product)}</h3><p className="cole-product-meta">Código: {getProductCode(product) || "-"} · Stock: {stock}</p>{variantesDeProducto(product).length > 0 && <label className="cole-variant-select">Variante<select value={selectedVariants[getBaseProductId(product)] || variantesDeProducto(product)[0]?.id || ""} onChange={(event) => setSelectedVariants((current) => ({ ...current, [getBaseProductId(product)]: event.target.value }))}>{variantesDeProducto(product).map((variante) => <option key={variante.id} value={variante.id}>{variante.nombre}</option>)}</select></label>}<div className="cole-product-bottom"><strong className="cole-price">{formatPrice(getProductPrice(product))}</strong><div className="cole-product-controls"><div className="cole-quantity"><button type="button" onClick={() => changeProductQuantity(id, -1)} aria-label="Bajar cantidad"><Icons.Minus className="cole-icon small" /></button><input value={getProductQuantity(id)} onChange={(event) => setProductQuantity(id, event.target.value)} inputMode="numeric" aria-label={`Cantidad de ${getProductName(product)}`} /><button type="button" onClick={() => changeProductQuantity(id, 1)} aria-label="Subir cantidad"><Icons.Plus className="cole-icon small" /></button></div><button type="button" onClick={() => addToCart(product)} className="cole-add-button" disabled={getProductPrice(product) <= 0}>Agregar</button></div></div></div></article>; })}</div>}</section>
      </main>
      {cartOpen && <div className="cole-modal-backdrop"><div className="cole-cart-modal"><div className="cole-cart-header"><div><h2>Carrito</h2><p>Retiro en local / pago online opcional</p></div><button type="button" onClick={() => setCartOpen(false)} className="cole-close" aria-label="Cerrar carrito"><Icons.X className="cole-icon" /></button></div>{orderCreated ? <div className="cole-order-ok"><Icons.Check className="cole-check-icon" /><h3>Pedido recibido</h3><p>Tu pedido fue cargado correctamente en COLE Gestión.</p>{orderCreated?.numero_pedido && <strong>Pedido #{orderCreated.numero_pedido}</strong>}<button type="button" onClick={resetOrder} className="cole-primary-full">Finalizar</button></div> : <>{cart.length === 0 ? <div className="cole-empty-cart"><Icons.Cart className="cole-empty-icon" /><p>Tu carrito está vacío.</p></div> : <div className="cole-cart-items">{cart.map((item) => { const id = getProductId(item); return <div key={id} className="cole-cart-item"><div className="cole-cart-item-img">{renderProductImage(item)}</div><div className="cole-cart-item-body"><p>{getProductName(item)}{item.variante_nombre ? ` - ${item.variante_nombre}` : ""}</p><strong>{formatPrice(getProductPrice(item))}</strong><div className="cole-cart-quantity"><button type="button" onClick={() => changeCartQuantity(id, -1)} aria-label="Bajar cantidad del carrito"><Icons.Minus className="cole-icon small" /></button><span>{item.quantity}</span><button type="button" onClick={() => changeCartQuantity(id, 1)} aria-label="Subir cantidad del carrito"><Icons.Plus className="cole-icon small" /></button></div></div><button type="button" onClick={() => removeFromCart(id)} className="cole-trash" aria-label="Eliminar producto"><Icons.Trash className="cole-icon small" /></button></div>; })}</div>}{cart.length > 0 && checkoutStep === "checkout" && <div className="cole-checkout"><button type="button" onClick={() => setCheckoutStep("cart")} className="cole-back">← Volver al carrito</button><h3>Datos para retirar</h3><div className="cole-payment-methods"><label><input type="radio" name="paymentMethod" value="pagar_al_retirar" checked={checkout.paymentMethod === "pagar_al_retirar"} onChange={(event) => setCheckout({ ...checkout, paymentMethod: event.target.value })} /> Pagar al retirar</label><label><input type="radio" name="paymentMethod" value="mercado_pago" checked={checkout.paymentMethod === "mercado_pago"} onChange={(event) => setCheckout({ ...checkout, paymentMethod: event.target.value })} /> Pagar online con Mercado Pago</label></div><input placeholder="Nombre y apellido *" value={checkout.name} onChange={(event) => setCheckout({ ...checkout, name: event.target.value })} /><input placeholder="Teléfono *" value={checkout.phone} onChange={(event) => setCheckout({ ...checkout, phone: event.target.value })} /><input placeholder="Email" value={checkout.email} onChange={(event) => setCheckout({ ...checkout, email: event.target.value })} /><textarea placeholder="Observaciones" value={checkout.notes} onChange={(event) => setCheckout({ ...checkout, notes: event.target.value })} /></div>}{orderError && <div className="cole-alert error">{orderError}</div>}<div className="cole-cart-footer"><div className="cole-subtotal"><span>Subtotal</span><strong>{formatPrice(subtotal)}</strong></div>{checkoutStep === "cart" ? <button type="button" disabled={cart.length === 0} onClick={() => setCheckoutStep("checkout")} className="cole-primary-full">Confirmar compra</button> : <button type="button" disabled={cart.length === 0 || !checkout.name.trim() || !checkout.phone.trim() || (checkout.paymentMethod === "mercado_pago" && !checkout.email.trim()) || sendingOrder} onClick={createOrder} className="cole-primary-full">{sendingOrder ? "Enviando..." : checkout.paymentMethod === "mercado_pago" ? "Pagar con Mercado Pago" : "Enviar pedido"}</button>}<p>{checkout.paymentMethod === "mercado_pago" ? "Vas a ser redirigido a Mercado Pago para completar el pago." : "El pago se realiza al retirar en el local."}</p></div></>}</div></div>}
      <style jsx>{`
        :global(html){scroll-behavior:smooth}
        .cole-store{min-height:100vh;background:#f6f7f9;color:#1f2937;font-family:Inter,Arial,Helvetica,sans-serif}
        .cole-shell{width:min(1240px,calc(100% - 36px));margin:0 auto}
        .cole-header{position:sticky;top:0;z-index:40;background:rgba(255,255,255,.97);border-bottom:1px solid #e5e7eb;backdrop-filter:blur(14px)}
        .cole-header-inner{min-height:78px;display:flex;align-items:center;justify-content:space-between;gap:22px}
        .cole-brand{display:flex;align-items:center;gap:13px;text-decoration:none;color:inherit;min-width:0}
        .cole-logo-img{width:54px;height:54px;border-radius:50%;object-fit:contain;background:#fff;border:1px solid #e5e7eb;box-shadow:0 8px 22px rgba(17,24,39,.08)}
        .cole-brand-title{margin:0;font-size:20px;font-weight:850;color:#111827;letter-spacing:-.02em;white-space:nowrap}.cole-brand-subtitle{margin:2px 0 0;font-size:12px;font-weight:700;color:#6b7280}.cole-nav{display:flex;gap:20px;margin-left:auto}.cole-nav a{color:#4b5563;text-decoration:none;font-size:14px;font-weight:800}.cole-nav a:hover{color:#111827}.cole-cart-button{border:1px solid #111827;border-radius:999px;padding:11px 16px;background:#111827;color:#fff;font-weight:850;cursor:pointer;display:flex;align-items:center;gap:9px;transition:transform .18s ease,background .18s ease,box-shadow .18s ease;box-shadow:0 10px 22px rgba(17,24,39,.14)}.cole-cart-button:hover{background:#000;transform:translateY(-1px)}.cole-cart-button strong{min-width:23px;height:23px;border-radius:999px;display:grid;place-items:center;padding:0 7px;color:#111827;background:#f5c400}.cole-icon{width:20px;height:20px}
        .cole-search .cole-icon{
  width:18px !important;
  height:18px !important;
  min-width:18px !important;
  max-width:18px !important;
}
        .cole-icon.small{width:16px;height:16px}.cole-icon.muted{color:#9ca3af}
        
        .cole-hero{background:linear-gradient(180deg,#fff 0%,#f7f7f7 100%);border-bottom:1px solid #e5e7eb;padding:22px 0}
        .cole-hero-slider{
          position:relative;
          width:100%;
          aspect-ratio:16 / 5;
          min-height:220px;
          max-height:430px;
          overflow:hidden;
          border-radius:24px;
          background:#fff;
          border:1px solid #e5e7eb;
          box-shadow:0 22px 55px rgba(17,24,39,.08);
        }
        .cole-hero-slider img{
          position:absolute;
          inset:0;
          width:100%;
          height:100%;
          object-fit:cover;
          opacity:0;
          transition:opacity .7s ease;
        }
        .cole-hero-slider img.active{opacity:1}
        .cole-hero-dots{
          position:absolute;
          left:50%;
          bottom:14px;
          transform:translateX(-50%);
          display:flex;
          gap:8px;
          padding:7px 10px;
          border-radius:999px;
          background:rgba(255,255,255,.78);
          backdrop-filter:blur(8px);
        }
        .cole-hero-dots button{
          width:10px;
          height:10px;
          border-radius:999px;
          border:0;
          background:#9ca3af;
          cursor:pointer;
        }
        .cole-hero-dots button.active{background:#f5c400;width:22px}
        .cole-hero-slide-empty{
          height:100%;
          display:grid;
          place-items:center;
          text-align:center;
          color:#6b7280;
          font-weight:800;
          gap:6px;
        }
        .cole-hero-slide-empty strong{color:#111827;font-size:26px}

        .cole-loading-card,.cole-empty{border-radius:22px;padding:34px;text-align:center;background:#fff;color:#6b7280;font-weight:750;border:1px solid #e5e7eb}
        .cole-catalog{padding:46px 0 64px}.cole-catalog-header{display:grid;grid-template-columns:1fr auto;gap:24px;align-items:end;margin-bottom:22px}.cole-section-kicker{color:#8a6d00;font-size:12px;text-transform:uppercase;letter-spacing:.14em;font-weight:900}.cole-catalog-header h2{margin:6px 0 0;color:#111827;font-size:clamp(28px,3vw,40px);font-weight:900;letter-spacing:-.04em}.cole-catalog-header p{margin:8px 0 0;color:#6b7280;font-weight:600}.cole-filters{display:grid;grid-template-columns:minmax(280px,370px) 190px;gap:12px}.cole-search-icon-wrap{width:18px;height:18px;min-width:18px;max-width:18px;display:flex;align-items:center;justify-content:center;overflow:hidden;flex:0 0 18px}
.cole-search-icon{width:18px !important;height:18px !important;min-width:18px !important;max-width:18px !important;color:#9ca3af;display:block}
.cole-search svg{width:18px !important;height:18px !important;min-width:18px !important;max-width:18px !important;flex:0 0 18px !important}
.cole-search{height:48px;display:flex;align-items:center;gap:10px;background:#fff;border:1px solid #d1d5db;border-radius:12px;padding:0 14px;box-shadow:0 8px 20px rgba(17,24,39,.04)}.cole-search input,.cole-filters select{width:100%;border:0;outline:none;background:transparent;color:#111827;font-weight:650}.cole-filters select{height:48px;background:#fff;border:1px solid #d1d5db;border-radius:12px;padding:0 14px;box-shadow:0 8px 20px rgba(17,24,39,.04)}.cole-categories{display:flex;gap:10px;overflow-x:auto;padding:4px 0 20px}.cole-categories button{border:1px solid #e5e7eb;border-radius:999px;padding:10px 15px;white-space:nowrap;background:#fff;color:#4b5563;font-weight:800;cursor:pointer}.cole-categories button.active{color:#111827;background:#f5c400;border-color:#e5b800}.cole-products-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px}.cole-product-card{border-radius:20px;background:#fff;overflow:hidden;border:1px solid #e5e7eb;box-shadow:0 10px 26px rgba(17,24,39,.055);transition:transform .2s ease,box-shadow .2s ease;min-width:0}.cole-product-card:hover{transform:translateY(-3px);box-shadow:0 20px 42px rgba(17,24,39,.095)}.cole-product-media{
  position:relative;
  aspect-ratio:1 / 1;
  height:auto;
  margin:12px;
  border-radius:16px;
  background:#fff;
  display:flex;
  align-items:center;
  justify-content:center;
  overflow:hidden;
  border:1px solid #eeeeee;
  padding:12px;
}

.cole-img-frame{
  width:100%;
  height:100%;
  display:flex;
  align-items:center;
  justify-content:center;
  overflow:hidden;
  background:#fff;
}

.cole-img-safe{
  display:block !important;
  max-width:100% !important;
  max-height:100% !important;
  width:auto !important;
  height:auto !important;
  object-fit:contain !important;
  object-position:center !important;
}
  .cole-product-emoji{font-size:42px}.cole-product-emoji.large{font-size:66px}.cole-badge{position:absolute;top:10px;left:10px;border-radius:999px;background:#f5c400;color:#111827;padding:7px 10px;font-size:11px;font-weight:900}.cole-badge.danger{background:#f3f4f6;color:#6b7280}.cole-product-info{padding:0 15px 16px}.cole-product-category{margin:0 0 7px;color:#6b7280;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.08em}.cole-product-info h3{margin:0;min-height:46px;color:#111827;font-size:16px;line-height:1.18;font-weight:850}.cole-product-meta{margin:8px 0 0;color:#9ca3af;font-size:12px;font-weight:650}.cole-product-bottom{display:grid;gap:12px;margin-top:14px}.cole-price{color:#111827;font-size:24px;font-weight:950;letter-spacing:-.03em}.cole-product-controls{display:flex;align-items:center;justify-content:space-between;gap:10px}.cole-quantity{display:flex;align-items:center;gap:4px;border-radius:12px;background:#f9fafb;border:1px solid #e5e7eb;padding:4px}.cole-quantity button,.cole-cart-quantity button{border:1px solid #e5e7eb;width:31px;height:31px;border-radius:9px;display:grid;place-items:center;color:#111827;background:#fff;cursor:pointer}.cole-quantity input{width:40px;border:0;outline:0;background:transparent;text-align:center;font-weight:850;color:#111827}.cole-add-button{border:0;border-radius:12px;background:#111827;color:#fff;padding:11px 14px;font-weight:850;cursor:pointer}.cole-add-button:hover{background:#000}.cole-add-button:disabled{opacity:.45;cursor:not-allowed}.cole-alert{border-radius:14px;padding:12px 14px;margin:12px 0;font-weight:750}.cole-alert.error{background:#fee2e2;color:#991b1b}.cole-alert button{margin-left:10px}
        .cole-modal-backdrop{position:fixed;inset:0;z-index:80;display:grid;place-items:center;padding:20px;background:rgba(17,24,39,.58);backdrop-filter:blur(4px)}.cole-cart-modal{width:min(540px,100%);max-height:min(92vh,860px);overflow-y:auto;border-radius:24px;background:#fff;padding:22px;box-shadow:0 30px 90px rgba(0,0,0,.25)}.cole-cart-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:16px}.cole-cart-header h2{margin:0;color:#111827;font-size:30px;font-weight:900;letter-spacing:-.04em}.cole-cart-header p{margin:2px 0 0;color:#6b7280;font-weight:650}.cole-close{border:1px solid #e5e7eb;width:40px;height:40px;border-radius:999px;display:grid;place-items:center;background:#fff;color:#374151;cursor:pointer}.cole-empty-cart{border-radius:20px;padding:34px 18px;background:#f9fafb;text-align:center;font-weight:800}.cole-empty-icon{width:48px;height:48px;color:#6b7280}.cole-cart-items{display:grid;gap:12px}.cole-cart-item{display:grid;grid-template-columns:70px 1fr auto;gap:12px;border:1px solid #e5e7eb;border-radius:18px;padding:12px}.cole-cart-item-img{width:70px;height:70px;border-radius:14px;display:grid;place-items:center;background:#fff;overflow:hidden;border:1px solid #eeeeee}.cole-cart-item-body p{margin:0;color:#111827;font-weight:850;line-height:1.2}.cole-cart-item-body strong{display:block;margin-top:4px;color:#111827}.cole-cart-quantity{display:flex;align-items:center;gap:8px;margin-top:8px}.cole-cart-quantity span{min-width:22px;text-align:center;font-weight:850}.cole-trash{border:0;width:36px;height:36px;border-radius:999px;display:grid;place-items:center;background:#f3f4f6;color:#6b7280;cursor:pointer}.cole-checkout{margin-top:16px;border-radius:18px;padding:16px;background:#f9fafb;display:grid;gap:10px}.cole-checkout h3{margin:0;color:#111827;font-size:20px;font-weight:850}.cole-payment-methods{display:grid;gap:8px;border:1px solid #e5e7eb;background:#fff;border-radius:14px;padding:12px}.cole-payment-methods label{display:flex;gap:8px;align-items:center;color:#111827;font-weight:750}.cole-payment-methods input{width:auto}.cole-back{justify-self:start;border:0;background:transparent;color:#111827;font-weight:850;cursor:pointer}.cole-checkout input,.cole-checkout textarea{width:100%;border:1px solid #d1d5db;border-radius:12px;padding:12px 13px;background:#fff;outline:0;font-weight:650;color:#111827}.cole-checkout textarea{min-height:90px;resize:vertical}.cole-cart-footer{border-top:1px solid #e5e7eb;margin-top:18px;padding-top:16px}.cole-subtotal{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}.cole-subtotal span{color:#6b7280;font-weight:850}.cole-subtotal strong{color:#111827;font-size:28px;font-weight:950}.cole-primary-full{width:100%;border:0;border-radius:14px;padding:14px 18px;background:#111827;color:#fff;font-size:16px;font-weight:850;cursor:pointer}.cole-primary-full:disabled{opacity:.45;cursor:not-allowed}.cole-cart-footer p{margin:10px 0 0;color:#9ca3af;font-size:13px;font-weight:650;text-align:center}.cole-order-ok{text-align:center;padding:28px 4px 8px}.cole-check-icon{width:76px;height:76px;color:#16a34a}.cole-order-ok h3{margin:12px 0 0;color:#111827;font-size:28px;font-weight:900}.cole-order-ok p{color:#6b7280;font-weight:650}.cole-order-ok strong{display:block;margin:10px 0 18px;color:#111827;font-size:18px}

        .cole-catalog-dropdown{position:relative}
        .cole-nav-dropdown-button{border:0;background:transparent;color:#4b5563;font-size:14px;font-weight:800;cursor:pointer;padding:8px 0}
        .cole-nav-dropdown-button:hover{color:#111827}
        .cole-catalog-dropdown-panel{
          position:absolute;
          top:32px;
          left:0;
          width:280px;
          max-height:420px;
          overflow-y:auto;
          background:#fff;
          border:1px solid #e5e7eb;
          border-radius:14px;
          box-shadow:0 18px 45px rgba(17,24,39,.16);
          padding:8px;
          z-index:90;
        }
        .cole-catalog-dropdown-panel button{
          width:100%;
          border:0;
          border-radius:10px;
          background:#fff;
          color:#374151;
          text-align:left;
          padding:10px 12px;
          font-weight:800;
          cursor:pointer;
        }
        .cole-catalog-dropdown-panel button:hover,
        .cole-catalog-dropdown-panel button.active{
          background:#f5c400;
          color:#111827;
        }

        .cole-logo-web{width:74px;height:54px;border-radius:0;border:0;box-shadow:none;background:transparent;object-fit:contain}
        .cole-category-menu{position:sticky;top:78px;z-index:35;background:#fff;border-bottom:1px solid #e5e7eb;box-shadow:0 6px 18px rgba(17,24,39,.04)}
        .cole-category-menu-inner{display:flex;gap:8px;overflow-x:auto;padding:10px 0}
        .cole-category-menu button{border:1px solid #e5e7eb;border-radius:999px;background:#fff;color:#374151;font-weight:850;font-size:13px;white-space:nowrap;padding:8px 12px;cursor:pointer}
        .cole-category-menu button.active{background:#f5c400;border-color:#e5b800;color:#111827}
        .cole-variant-select{display:grid;gap:4px;margin-top:9px;color:#6b7280;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.06em}
        .cole-variant-select select{height:36px;border:1px solid #d1d5db;border-radius:10px;background:#fff;color:#111827;font-size:13px;font-weight:750;padding:0 10px;text-transform:none;letter-spacing:0}
        @media(max-width:1000px){.cole-hero-grid,.cole-catalog-header{grid-template-columns:1fr}.cole-filters{grid-template-columns:1fr}.cole-products-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.cole-nav{display:none}}
        @media(max-width:640px){.cole-hero-slider{aspect-ratio:1.35 / 1;min-height:230px;border-radius:18px}.cole-shell{width:min(100% - 20px,1240px)}.cole-header-inner{min-height:68px}.cole-brand-title{font-size:17px}.cole-brand-subtitle{display:none}.cole-logo-img{width:46px;height:46px}.cole-cart-button span{display:none}.cole-hero-grid{padding:38px 0;gap:24px}.cole-hero h1{font-size:34px}.cole-featured-grid,.cole-products-grid{grid-template-columns:1fr}.cole-product-controls{align-items:stretch;flex-direction:column}.cole-quantity{justify-content:space-between}.cole-add-button{width:100%}.cole-cart-item{grid-template-columns:58px 1fr auto}.cole-cart-item-img{width:58px;height:58px}}
      `}</style>
    </div>
  );
}
