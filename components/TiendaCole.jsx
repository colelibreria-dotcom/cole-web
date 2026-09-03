"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const COLE_WHATSAPP_NUMBER = "5492246441486";

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

function buildWhatsAppUrl(message) {
  return `https://wa.me/${COLE_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
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
function getAvailableStock(product) {
  return Math.max(0, Math.floor(Number(product.variante_stock_actual ?? product.stock_actual ?? product.stock ?? 0)));
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
  const stock = getAvailableStock(product);
  const found = currentCart.find((item) => getProductId(item) === id);
  if (found) {
    return currentCart.map((item) =>
      getProductId(item) === id
        ? { ...item, quantity: Math.min(stock, Number(item.quantity || 0) + quantityToAdd) }
        : item
    );
  }
  return [...currentCart, { ...product, quantity: Math.min(stock, quantityToAdd) }];
}

function calculateSubtotal(cart) {
  return cart.reduce((sum, item) => sum + getProductPrice(item) * Number(item.quantity || 0), 0);
}
function calculateTotalItems(cart) {
  return cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
}

function Icon({ children, className = "" }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
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
  ArrowUp: ({ className = "" }) => <Icon className={className}><path d="m18 15-6-6-6 6" /><path d="M12 9v12" /></Icon>,
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
  const categoryMenuRef = useRef(null);
  const [sort, setSort] = useState("name-asc");
  const [gridSize, setGridSize] = useState("normal");
  const [cart, setCart] = useState([]);
  const [productQuantities, setProductQuantities] = useState({});
  const [quantityErrors, setQuantityErrors] = useState({});
  const [selectedVariants, setSelectedVariants] = useState({});
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState("cart");
  const [checkout, setCheckout] = useState({ name: "", phone: "", email: "", notes: "", paymentMethod: "pagar_al_retirar", deliveryMethod: "retiro", localidad: "", direccion: "", referencia: "", franja: "", verifyPickup: false });
  const [deliveryConfig, setDeliveryConfig] = useState({ habilitado: false, zonas: [], franjas: [], pedido_minimo: 0, hora_corte: "" });
  const [sendingOrder, setSendingOrder] = useState(false);
  const [orderCreated, setOrderCreated] = useState(null);
  const [orderError, setOrderError] = useState("");
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    loadProducts();
    loadHeroSlides();
    loadDeliveryConfig();
  }, []);

  useEffect(() => {
    if (heroSlides.length <= 1) return;

    const timer = setInterval(() => {
      setHeroSlideIndex((current) => (current + 1) % heroSlides.length);
    }, 4500);

    return () => clearInterval(timer);
  }, [heroSlides.length]);

  useEffect(() => {
    if (!categoryMenuOpen) return;
    window.requestAnimationFrame(() => categoryMenuRef.current?.scrollTo({ top: 0 }));
  }, [categoryMenuOpen]);

  useEffect(() => {
    const updateBackToTop = () => setShowBackToTop(window.scrollY > 520);
    updateBackToTop();
    window.addEventListener("scroll", updateBackToTop, { passive: true });
    return () => window.removeEventListener("scroll", updateBackToTop);
  }, []);

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

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

  async function loadDeliveryConfig() {
    try {
      const response = await fetch("/api/tienda/envios", { cache: "no-store" });
      const data = await response.json();
      if (response.ok && data.ok && data.envios) {
        setDeliveryConfig({ habilitado: false, zonas: [], franjas: [], pedido_minimo: 0, hora_corte: "", ...data.envios });
      }
    } catch {
      setDeliveryConfig({ habilitado: false, zonas: [], franjas: [], pedido_minimo: 0, hora_corte: "" });
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

  useEffect(() => {
    if (products.length === 0) return;

    const rawSelection = window.localStorage.getItem("cole_lista_escolar_carrito");
    if (!rawSelection) return;

    try {
      const selection = JSON.parse(rawSelection);
      const requestedItems = Array.isArray(selection?.items) ? selection.items : [];
      const productsById = new Map(products.map((product) => [String(product.id), product]));
      const availableItems = requestedItems
        .map((item) => ({ product: productsById.get(String(item.producto_id)), quantity: Number(item.cantidad || 1) }))
        .filter(({ product, quantity }) => product && quantity > 0 && getAvailableStock(product) > 0);

      if (availableItems.length > 0) {
        setCart((current) => availableItems.reduce(
          (nextCart, { product, quantity }) => addProductToCart(nextCart, product, quantity),
          current
        ));
        setCartOpen(true);
        setCheckoutStep("cart");
      }
    } catch {
      // La selección temporal puede quedar incompleta si se cerró la página durante el paso al carrito.
    } finally {
      window.localStorage.removeItem("cole_lista_escolar_carrito");
    }
  }, [products]);

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
  const esEnvioDomicilio = checkout.deliveryMethod === "envio_domicilio";
  const zonaEntrega = (deliveryConfig.zonas || []).find((zona) => zona.localidad === checkout.localidad);
  const costoEnvio = esEnvioDomicilio ? Math.max(0, Number(zonaEntrega?.costo || 0)) : 0;
  const totalConEnvio = subtotal + costoEnvio;

  function getProductQuantity(productId) { return productQuantities[productId] || 1; }
  function setProductQuantity(productId, value, stock) {
    const requested = Number.parseInt(value, 10);
    const max = Math.max(1, Math.floor(Number(stock || 0)));
    const exceedsStock = Number.isFinite(requested) && requested > max;
    setProductQuantities((current) => ({ ...current, [productId]: clampQuantity(value, 1, max) }));
    setQuantityErrors((current) => ({ ...current, [productId]: exceedsStock ? `Hay ${max} unidad${max === 1 ? "" : "es"} disponible${max === 1 ? "" : "s"}.` : "" }));
  }
  function changeProductQuantity(productId, delta, stock) {
    const max = Math.max(1, Math.floor(Number(stock || 0)));
    setProductQuantities((current) => ({ ...current, [productId]: clampQuantity((current[productId] || 1) + delta, 1, max) }));
    setQuantityErrors((current) => ({ ...current, [productId]: "" }));
  }

  function addToCart(product) {
    const id = getBaseProductId(product);
    const variante = varianteSeleccionada(product);
    const productoConVariante = variante
      ? {
          ...product,
          variante_id: variante.id,
          variante_nombre: variante.nombre,
          variante_descripcion: variante.descripcion || "",
          variante_stock_actual: variante.stock_actual,
        }
      : product;
    const stock = getAvailableStock(productoConVariante);
    const quantityToAdd = Math.min(getProductQuantity(id), stock);
    if (stock <= 0) {
      openProductConsultation(productoConVariante);
      return;
    }

    setCart((current) => addProductToCart(current, productoConVariante, quantityToAdd));
    setCheckoutStep("cart");
    setOrderCreated(null);
    setOrderError("");
  }

  function changeCartQuantity(productId, delta) {
    setCart((current) => current.map((item) => getProductId(item) === productId ? { ...item, quantity: Math.min(getAvailableStock(item), Math.max(0, Number(item.quantity || 0) + delta)) } : item).filter((item) => Number(item.quantity || 0) > 0));
  }
  function removeFromCart(productId) { setCart((current) => current.filter((item) => getProductId(item) !== productId)); }
  function openCart() { setCartOpen(true); setCheckoutStep("cart"); setOrderError(""); }

  function openProductConsultation(product) {
    const message = [
      "Hola COLE, quisiera consultar disponibilidad de este producto:",
      `Producto: ${getProductName(product)}`,
      `Código: ${getProductCode(product) || "-"}`,
      `Precio web: ${formatPrice(getProductPrice(product))}`,
    ].join("\n");

    window.open(buildWhatsAppUrl(message), "_blank", "noopener,noreferrer");
  }

  function buildOrderConfirmationUrl(pedido) {
    const numero = pedido?.numero_pedido || "sin número";
    const itemsText = cart
      .map((item) => `- ${Number(item.quantity || 1)} x ${getProductName(item)}${item.variante_nombre ? ` - ${item.variante_nombre}` : ""}`)
      .join("\n");

    const message = [
      "Hola COLE, confirmo mi pedido web para pagar al retirar.",
      `Pedido: ${numero}`,
      `Nombre: ${checkout.name.trim()}`,
      `Teléfono: ${checkout.phone.trim()}`,
      checkout.email.trim() ? `Email: ${checkout.email.trim()}` : "",
      "",
      "Productos:",
      itemsText,
      "",
      `Total: ${formatPrice(totalConEnvio)}`,
    ]
      .filter(Boolean)
      .join("\n");

    return buildWhatsAppUrl(message);
  }

  async function createOrder() {
    if (cart.length === 0 || !checkout.name.trim() || !checkout.phone.trim()) return;
    if (esEnvioDomicilio && (!checkout.localidad || !checkout.direccion.trim() || !checkout.franja)) return;
    if (checkout.paymentMethod === "pagar_al_retirar" && !checkout.verifyPickup) return;
    try {
      setSendingOrder(true);
      setOrderError("");
      const verificationNote = checkout.paymentMethod === "pagar_al_retirar"
        ? "Cliente aceptó verificación por WhatsApp/teléfono antes de preparar el pedido."
        : "";
      const observacionesFinales = [checkout.notes.trim(), verificationNote].filter(Boolean).join("\n");

      const payload = {
        cliente_nombre: checkout.name.trim(),
        cliente_telefono: checkout.phone.trim(),
        cliente_email: checkout.email.trim(),
        observaciones: observacionesFinales,
        metodo_pago: checkout.paymentMethod,
        tipo_entrega: checkout.deliveryMethod,
        localidad_entrega: checkout.localidad,
        direccion_entrega: checkout.direccion.trim(),
        referencia_entrega: checkout.referencia.trim(),
        franja_entrega: checkout.franja,
        total: totalConEnvio,
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
      const pedidoCreado = data.pedido || true;
      setOrderCreated(
        checkout.paymentMethod === "pagar_al_retirar"
          ? { ...pedidoCreado, confirmacion_whatsapp_url: buildOrderConfirmationUrl(pedidoCreado) }
          : pedidoCreado
      );
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
    setCheckout({ name: "", phone: "", email: "", notes: "", paymentMethod: "pagar_al_retirar", deliveryMethod: "retiro", localidad: "", direccion: "", referencia: "", franja: "", verifyPickup: false });
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
      <div className="cole-img-frame" role="img" aria-label={getProductName(product)}>
        <img
          src={src}
          alt=""
          aria-hidden="true"
          className="cole-img-safe"
          loading="lazy"
          decoding="async"
          onLoad={(event) => {
            const imageElement = event.currentTarget;
            const frame = imageElement.parentElement;
            if (!frame) return;

            frame.style.backgroundImage = `url("${imageElement.currentSrc || src}")`;
            const media = frame.closest(".cole-product-media");
            if (media && imageElement.naturalWidth && imageElement.naturalHeight) {
              const originalRatio = imageElement.naturalWidth / imageElement.naturalHeight;
              const boundedRatio = Math.min(1.4, Math.max(0.65, originalRatio));
              media.style.setProperty("--cole-media-ratio", String(boundedRatio));
            }
            imageElement.classList.add("cole-img-loaded");
          }}
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
      <header className="cole-header"><div className="cole-shell cole-header-inner"><a href="/" className="cole-brand" aria-label="COLE Librería y Papelería"><img src="/logo-web.png" alt="COLE" className="cole-logo-img cole-logo-web" /><div><p className="cole-brand-title">Papelería escolar</p><p className="cole-brand-subtitle">Papelería Escolar · Comercial · Oficina · Técnica</p></div></a><nav className="cole-nav" aria-label="Secciones de tienda">
  <div className="cole-catalog-dropdown">
    <button
      type="button"
      className="cole-nav-dropdown-button"
      onClick={() => setCategoryMenuOpen((open) => !open)}
      aria-expanded={categoryMenuOpen}
      aria-haspopup="menu"
    >
      Catálogo
    </button>
    {categoryMenuOpen && (
      <div ref={categoryMenuRef} className="cole-catalog-dropdown-panel">
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
</nav><div className="cole-nav-links"><a href="/listas-escolares" className="cole-nav-link">Listas escolares</a><a href="/combos" className="cole-nav-link">Combos</a></div><button type="button" onClick={openCart} className="cole-cart-button">
  <span className="cole-cart-label">Carrito</span>
  <Icons.Cart className="cole-cart-icon" />
  {totalItems > 0 && <strong>{totalItems}</strong>}
</button></div></header>
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

                </>
              ) : (
                <div className="cole-hero-slide-empty">
                  <strong>COLE Librería y Papelería</strong>
                  <span>Todo para aprender, crear y resolver.</span>
                </div>
              )}
            </div>
          </div>
        </section>
        <section id="catalogo" className="cole-shell cole-catalog">
          <div className="cole-catalog-header">
            <div>
              <span className="cole-section-kicker">Catálogo</span>
              <h2>Todos los productos</h2>
              <p>Buscá por nombre, código o categoría. Agregá al carrito o consultá disponibilidad.</p>
            </div>
            <div className="cole-filters">
              <label className="cole-search">
                <span className="cole-search-icon-wrap"><Icons.Search className="cole-search-icon" /></span>
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar producto, código, rubro..." />
              </label>
              <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Ordenar productos">
                <option value="name-asc">Nombre A-Z</option>
                <option value="name-desc">Nombre Z-A</option>
                <option value="price-asc">Menor precio</option>
                <option value="price-desc">Mayor precio</option>
              </select>
              <select
                value={gridSize}
                onChange={(event) => setGridSize(event.target.value)}
                className="cole-view-select"
                aria-label="Tamaño de grilla"
              >
                <option value="normal">Grilla normal</option>
                <option value="compact">Grilla chica</option>
              </select>
            </div>
          </div>

          {productsError && <div className="cole-alert error">{productsError}<button type="button" onClick={loadProducts}>Reintentar</button></div>}
          {loadingProducts ? (
            <div className="cole-empty">Cargando productos...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="cole-empty">No encontramos productos con esos filtros.</div>
          ) : (
            <div className={`cole-products-grid ${gridSize === "compact" ? "compact" : ""}`}>
              {filteredProducts.map((product) => {
                const id = getProductId(product);
                const variante = varianteSeleccionada(product);
                const stock = getAvailableStock(variante ? { ...product, variante_stock_actual: variante.stock_actual } : product);
                const price = getProductPrice(product);
                const requiereConsulta = stock <= 0 || price <= 0;

                return (
                  <article key={id} className="cole-product-card">
                    <div className="cole-product-media">
                      {renderProductImage(product, false)}
                      <span className={`cole-stock-indicator ${stock <= 0 ? "out" : stock <= 5 ? "low" : "available"}`} title={stock <= 0 ? "Agotado" : stock <= 5 ? "Últimas unidades" : "Disponible"}><i />{stock <= 0 ? "Agotado" : stock <= 5 ? "Últimas unidades" : "Disponible"}</span>
                    </div>
                    <div className="cole-product-info">
                      <p className="cole-product-category">{getProductCategory(product)}</p>
                      <h3>{getProductName(product)}</h3>
                      <p className="cole-product-meta">Código: {getProductCode(product) || "-"}</p>
                      {variantesDeProducto(product).length > 0 && (
                        <label className="cole-variant-select">
                          Variante
                          <select value={selectedVariants[getBaseProductId(product)] || variantesDeProducto(product)[0]?.id || ""} onChange={(event) => setSelectedVariants((current) => ({ ...current, [getBaseProductId(product)]: event.target.value }))}>
                            {variantesDeProducto(product).map((variante) => <option key={variante.id} value={variante.id}>{variante.nombre}</option>)}
                          </select>
                        </label>
                      )}
                      <div className="cole-product-bottom">
                        <strong className="cole-price">{price > 0 ? formatPrice(price) : "Consultar"}</strong>
                        <div className="cole-product-controls">
                          {!requiereConsulta && (
                            <div className="cole-quantity">
                              <button type="button" onClick={() => changeProductQuantity(id, -1, stock)} disabled={getProductQuantity(id) <= 1} aria-label="Bajar cantidad"><Icons.Minus className="cole-icon small" /></button>
                              <input value={getProductQuantity(id)} onChange={(event) => setProductQuantity(id, event.target.value, stock)} inputMode="numeric" min="1" max={stock} aria-label={`Cantidad de ${getProductName(product)}`} />
                              <button type="button" onClick={() => changeProductQuantity(id, 1, stock)} disabled={getProductQuantity(id) >= stock} aria-label="Subir cantidad"><Icons.Plus className="cole-icon small" /></button>
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => requiereConsulta ? openProductConsultation(product) : addToCart(product)}
                            className={requiereConsulta ? "cole-add-button consult" : "cole-add-button"}
                          >
                            {requiereConsulta ? "Consultar" : "Agregar"}
                          </button>
                        </div>
                        {quantityErrors[id] && <p className="cole-quantity-warning" role="alert">{quantityErrors[id]}</p>}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <footer className="cole-footer">
          <div className="cole-shell cole-footer-grid">
            <div className="cole-footer-brand">
              <img src="/logo-web.png" alt="COLE" />
              <strong>COLE Librería y Papelería</strong>
              <p>Compra online con retiro en local. Papelería escolar, comercial, oficina y técnica.</p>
            </div>

            <div className="cole-footer-card">
              <strong>Contacto</strong>
              <a href="https://wa.me/5492246441486" target="_blank" rel="noopener noreferrer">WhatsApp: 2246 44 1486</a>
              <a href="mailto:colelibreria@gmail.com">colelibreria@gmail.com</a>
              <p>Avenida 32 Nº1096 esquina 11 · Santa Teresita</p>
              <p>Lunes a sábado de 8 a 21</p>
            </div>

            <div className="cole-footer-card">
              <strong>Compra segura</strong>
              <p>Podés pagar online con Mercado Pago o elegir pago al retirar. Los pedidos con pago al retirar se confirman por WhatsApp o teléfono antes de prepararse.</p>
            </div>

            <div className="cole-footer-card cole-footer-legal">
              <strong>Legales</strong>
              <p>CUIT: 20-26992089-1</p>
              <a className="cole-regret-link" href="mailto:colelibreria@gmail.com?subject=Arrepentimiento%20de%20compra&body=Solicito%20cancelar%20/%20revocar%20mi%20compra.%0A%0ANombre:%0ATel%C3%A9fono:%0AN%C2%BA%20de%20pedido:%0AEmail:">Botón de arrepentimiento</a>
              <a className="cole-datafiscal" href="https://qr.afip.gob.ar/?qr=hckw5RXVKfqMdo5iDBeFJA,," target="_blank" rel="noopener noreferrer">
                <img src="/datafiscal.jpg" alt="Data Fiscal AFIP" />
              </a>
            </div>
          </div>
        </footer>
      </main>

      {showBackToTop && (
        <button type="button" className="cole-back-to-top" onClick={scrollToTop} title="Volver arriba">
          <Icons.ArrowUp />
          <span>Volver arriba</span>
        </button>
      )}

      {cartOpen && (
        <div className="cole-modal-backdrop">
          <div className="cole-cart-modal">
            <div className="cole-cart-header">
              <div>
                <h2>Carrito</h2>
                <p>Retiro en local / pago online opcional</p>
              </div>
              <button type="button" onClick={() => setCartOpen(false)} className="cole-close" aria-label="Cerrar carrito"><Icons.X className="cole-icon" /></button>
            </div>

            {orderCreated ? (
              <div className="cole-order-ok">
                <Icons.Check className="cole-check-icon" />
                <h3>Pedido recibido</h3>
                <p>Tu pedido fue cargado correctamente en COLE Gestión.</p>
                {orderCreated?.numero_pedido && <strong>Pedido #{orderCreated.numero_pedido}</strong>}
                {orderCreated?.confirmacion_whatsapp_url && (
                  <>
                    <p className="cole-order-note">Para pago al retirar, confirmá el pedido por WhatsApp. Así evitamos preparar pedidos sin retirar.</p>
                    <a className="cole-whatsapp-confirm" href={orderCreated.confirmacion_whatsapp_url} target="_blank" rel="noopener noreferrer">Confirmar por WhatsApp</a>
                  </>
                )}
                <button type="button" onClick={resetOrder} className="cole-primary-full">Finalizar</button>
              </div>
            ) : (
              <>
                {cart.length === 0 ? (
                  <div className="cole-empty-cart"><div className="cole-empty-cart-symbol">🛒</div><p>Tu carrito está vacío.</p></div>
                ) : (
                  <div className="cole-cart-items">
                    {cart.map((item) => {
                      const id = getProductId(item);
                      return (
                        <div key={id} className="cole-cart-item">
                          <div className="cole-cart-item-img">{renderProductImage(item)}</div>
                          <div className="cole-cart-item-body">
                            <p>{getProductName(item)}{item.variante_nombre ? ` - ${item.variante_nombre}` : ""}</p>
                            <strong>{formatPrice(getProductPrice(item))}</strong>
                            <div className="cole-cart-quantity">
                              <button type="button" onClick={() => changeCartQuantity(id, -1)} aria-label="Bajar cantidad del carrito"><Icons.Minus className="cole-icon small" /></button>
                              <span>{item.quantity}</span>
                              <button type="button" onClick={() => changeCartQuantity(id, 1)} disabled={Number(item.quantity || 0) >= getAvailableStock(item)} aria-label="Subir cantidad del carrito"><Icons.Plus className="cole-icon small" /></button>
                            </div>
                          </div>
                          <button type="button" onClick={() => removeFromCart(id)} className="cole-trash" aria-label="Eliminar producto"><Icons.Trash className="cole-icon small" /></button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {cart.length > 0 && checkoutStep === "checkout" && (
                  <div className="cole-checkout">
                    <button type="button" onClick={() => setCheckoutStep("cart")} className="cole-back">← Volver al carrito</button>
                    <h3>Entrega y datos de contacto</h3>
                    <div className="cole-choice-list" aria-label="Forma de entrega">
                      <label className={`cole-choice-card ${checkout.deliveryMethod === "retiro" ? "selected" : ""}`}>
                        <input type="radio" name="deliveryMethod" value="retiro" checked={checkout.deliveryMethod === "retiro"} onChange={() => setCheckout({ ...checkout, deliveryMethod: "retiro", paymentMethod: "pagar_al_retirar", localidad: "", direccion: "", referencia: "", franja: "" })} />
                        <span><strong>Retiro en tienda</strong><small>Retirá tu pedido en el local.</small></span>
                      </label>
                      {deliveryConfig.habilitado && (
                        <label className={`cole-choice-card ${checkout.deliveryMethod === "envio_domicilio" ? "selected" : ""}`}>
                          <input type="radio" name="deliveryMethod" value="envio_domicilio" checked={checkout.deliveryMethod === "envio_domicilio"} onChange={() => setCheckout({ ...checkout, deliveryMethod: "envio_domicilio", paymentMethod: "mercado_pago", verifyPickup: false })} />
                          <span><strong>Envío a domicilio</strong><small>Coordinamos la entrega en tu localidad.</small></span>
                        </label>
                      )}
                    </div>
                    {esEnvioDomicilio ? (
                      <>
                        <div className="cole-delivery-note">
                          <strong>Entrega coordinada por COLE</strong>
                          <p>El envío se paga junto con el pedido. Coordinaremos la entrega por WhatsApp cuando esté preparado.</p>
                          {deliveryConfig.hora_corte && <p>Pedidos posteriores a las {deliveryConfig.hora_corte} pueden coordinarse para el día siguiente.</p>}
                        </div>
                        <select value={checkout.localidad} onChange={(event) => setCheckout({ ...checkout, localidad: event.target.value })}>
                          <option value="">Seleccioná tu localidad *</option>
                          {(deliveryConfig.zonas || []).map((zona) => <option key={zona.localidad} value={zona.localidad}>{zona.localidad} - {formatPrice(zona.costo)}</option>)}
                        </select>
                        <input placeholder="Dirección completa: calle, número, piso/departamento *" value={checkout.direccion} onChange={(event) => setCheckout({ ...checkout, direccion: event.target.value })} />
                        <input placeholder="Referencia para llegar (opcional)" value={checkout.referencia} onChange={(event) => setCheckout({ ...checkout, referencia: event.target.value })} />
                        <select value={checkout.franja} onChange={(event) => setCheckout({ ...checkout, franja: event.target.value })}>
                          <option value="">Franja horaria preferida *</option>
                          {(deliveryConfig.franjas || []).map((franja) => <option key={franja} value={franja}>{franja}</option>)}
                        </select>
                      </>
                    ) : (
                      <div className="cole-choice-list" aria-label="Forma de pago">
                        <label className={`cole-choice-card ${checkout.paymentMethod === "pagar_al_retirar" ? "selected" : ""}`}>
                          <input type="radio" name="paymentMethod" value="pagar_al_retirar" checked={checkout.paymentMethod === "pagar_al_retirar"} onChange={(event) => setCheckout({ ...checkout, paymentMethod: event.target.value })} />
                          <span><strong>Pagar al retirar</strong><small>Pagás cuando retirás el pedido en el local.</small></span>
                        </label>
                        <label className={`cole-choice-card ${checkout.paymentMethod === "mercado_pago" ? "selected" : ""}`}>
                          <input type="radio" name="paymentMethod" value="mercado_pago" checked={checkout.paymentMethod === "mercado_pago"} onChange={(event) => setCheckout({ ...checkout, paymentMethod: event.target.value, verifyPickup: false })} />
                          <span><strong>Pagar online</strong><small>Tarjeta, débito o Mercado Pago.</small></span>
                        </label>
                      </div>
                    )}
                    {checkout.paymentMethod === "pagar_al_retirar" && !esEnvioDomicilio && (
                      <div className="cole-verification-box">
                        <strong>Verificación para pago al retirar</strong>
                        <p>Antes de preparar el pedido, COLE podrá confirmar por WhatsApp o teléfono. Al finalizar, vas a poder enviar un WhatsApp de confirmación con el número de pedido.</p>
                        <label>
                          <input type="checkbox" checked={checkout.verifyPickup} onChange={(event) => setCheckout({ ...checkout, verifyPickup: event.target.checked })} />
                          Confirmo que el teléfono ingresado es correcto y que retiraré el pedido en el local.
                        </label>
                      </div>
                    )}
                    <input placeholder="Nombre y apellido *" value={checkout.name} onChange={(event) => setCheckout({ ...checkout, name: event.target.value })} />
                    <input placeholder="Teléfono / WhatsApp *" value={checkout.phone} onChange={(event) => setCheckout({ ...checkout, phone: event.target.value })} />
                    <input placeholder={checkout.paymentMethod === "mercado_pago" ? "Email *" : "Email opcional"} value={checkout.email} onChange={(event) => setCheckout({ ...checkout, email: event.target.value })} />
                    <textarea placeholder="Observaciones" value={checkout.notes} onChange={(event) => setCheckout({ ...checkout, notes: event.target.value })} />
                  </div>
                )}

                {orderError && <div className="cole-alert error">{orderError}</div>}
                <div className="cole-cart-footer">
                  <div className="cole-subtotal"><span>Productos</span><strong>{formatPrice(subtotal)}</strong></div>
                  {esEnvioDomicilio && <div className="cole-subtotal compact"><span>Envío{checkout.localidad ? ` - ${checkout.localidad}` : ""}</span><strong>{zonaEntrega ? formatPrice(costoEnvio) : "Seleccioná localidad"}</strong></div>}
                  {esEnvioDomicilio && <div className="cole-subtotal total"><span>Total</span><strong>{formatPrice(totalConEnvio)}</strong></div>}
                  {checkoutStep === "cart" ? (
                    <button type="button" disabled={cart.length === 0} onClick={() => setCheckoutStep("checkout")} className="cole-primary-full">Confirmar compra</button>
                  ) : (
                    <button
                      type="button"
                      disabled={cart.length === 0 || !checkout.name.trim() || !checkout.phone.trim() || (checkout.paymentMethod === "mercado_pago" && !checkout.email.trim()) || (esEnvioDomicilio && (!zonaEntrega || !checkout.direccion.trim() || !checkout.franja)) || (checkout.paymentMethod === "pagar_al_retirar" && !checkout.verifyPickup) || sendingOrder}
                      onClick={createOrder}
                      className="cole-primary-full"
                    >
                      {sendingOrder ? "Enviando..." : checkout.paymentMethod === "mercado_pago" ? "Pagar con tarjeta, débito o Mercado Pago" : "Enviar pedido"}
                    </button>
                  )}
                  <p>{checkout.paymentMethod === "mercado_pago" ? "Podés pagar con tarjeta, débito o tu cuenta de Mercado Pago. No necesitás tener la app." : "El pedido queda sujeto a confirmación por WhatsApp/teléfono antes de prepararse."}</p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      <style jsx>{`
        :global(html){scroll-behavior:smooth}
        .cole-store{min-height:100vh;background:#f6f7f9;color:#1f2937;font-family:Inter,Arial,Helvetica,sans-serif}
        .cole-shell{width:min(1240px,calc(100% - 36px));margin:0 auto}
        .cole-header{position:sticky;top:0;z-index:40;background:rgba(255,255,255,.97);border-bottom:1px solid #e5e7eb;backdrop-filter:blur(14px)}
        .cole-header-inner{min-height:78px;display:flex;align-items:center;justify-content:space-between;gap:22px}
        .cole-brand{display:flex;align-items:center;gap:13px;text-decoration:none;color:inherit;min-width:0}
        .cole-logo-img{width:54px;height:54px;border-radius:50%;object-fit:contain;background:#fff;border:1px solid #e5e7eb;box-shadow:0 8px 22px rgba(17,24,39,.08)}
        .cole-brand-title{margin:0;font-size:20px;font-weight:850;color:#111827;letter-spacing:-.02em;white-space:nowrap}.cole-brand-subtitle{margin:2px 0 0;font-size:12px;font-weight:700;color:#6b7280}.cole-nav{display:flex;align-items:center;margin-left:auto}.cole-nav-links{display:flex;align-items:center;gap:20px;margin-left:20px}.cole-nav a,.cole-nav-links a{color:#4b5563;text-decoration:none;font-size:14px;font-weight:800}.cole-nav a:hover,.cole-nav-links a:hover{color:#111827}.cole-nav-link{white-space:nowrap}.cole-cart-button,.cole-nav-dropdown-button{border:1px solid #111827;border-radius:999px;padding:11px 16px;background:#111827;color:#fff;font-size:14px;font-weight:850;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:9px;transition:transform .18s ease,background .18s ease,box-shadow .18s ease}.cole-cart-button:hover,.cole-nav-dropdown-button:hover,.cole-nav-dropdown-button[aria-expanded="true"]{background:#000;transform:translateY(-1px);color:#fff}.cole-cart-button strong{min-width:23px;height:23px;border-radius:999px;display:grid;place-items:center;padding:0 7px;color:#111827;background:#f5c400}.cole-icon{width:20px;height:20px}:global(.cole-cart-icon){width:20px!important;height:20px!important;min-width:20px!important;max-width:20px!important;flex:0 0 20px!important;display:block!important}
        .cole-search .cole-icon{
  width:18px !important;
  height:18px !important;
  min-width:18px !important;
  max-width:18px !important;
}
        .cole-icon.small{width:16px;height:16px}.cole-icon.muted{color:#9ca3af}
        
        .cole-hero{background:linear-gradient(180deg,#fff 0%,#f7f7f7 100%);border-bottom:1px solid #e5e7eb;padding:22px 0}
        .cole-back-to-top{position:fixed;right:24px;bottom:24px;z-index:45;display:flex;align-items:center;gap:8px;border:0;border-radius:999px;background:#111827;color:#fff;padding:12px 16px;box-shadow:0 14px 30px rgba(17,24,39,.24);font-size:14px;font-weight:850;cursor:pointer}.cole-back-to-top:hover{background:#000;transform:translateY(-1px)}.cole-back-to-top svg{width:18px;height:18px;flex:0 0 18px}
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
        .cole-catalog{padding:46px 0 64px}.cole-catalog-header{display:grid;grid-template-columns:1fr auto;gap:24px;align-items:end;margin-bottom:22px}.cole-section-kicker{color:#8a6d00;font-size:12px;text-transform:uppercase;letter-spacing:.14em;font-weight:900}.cole-catalog-header h2{margin:6px 0 0;color:#111827;font-size:clamp(28px,3vw,40px);font-weight:900;letter-spacing:-.04em}.cole-catalog-header p{margin:8px 0 0;color:#6b7280;font-weight:600}.cole-filters{display:grid;grid-template-columns:minmax(260px,370px) 190px 155px;gap:12px}.cole-search-icon-wrap{width:18px;height:18px;min-width:18px;max-width:18px;display:flex;align-items:center;justify-content:center;overflow:hidden;flex:0 0 18px}
.cole-search-icon{width:18px !important;height:18px !important;min-width:18px !important;max-width:18px !important;color:#9ca3af;display:block}
.cole-search svg{width:18px !important;height:18px !important;min-width:18px !important;max-width:18px !important;flex:0 0 18px !important}
.cole-search{height:48px;display:flex;align-items:center;gap:10px;background:#fff;border:1px solid #d1d5db;border-radius:12px;padding:0 14px;box-shadow:0 8px 20px rgba(17,24,39,.04)}.cole-search input,.cole-filters select{width:100%;border:0;outline:none;background:transparent;color:#111827;font-weight:650;min-width:0}.cole-filters select{height:48px;background:#fff;border:1px solid #d1d5db;border-radius:12px;padding:0 14px;box-shadow:0 8px 20px rgba(17,24,39,.04)}.cole-view-select{white-space:nowrap}.cole-categories{display:flex;gap:10px;overflow-x:auto;padding:4px 0 20px}.cole-categories button{border:1px solid #e5e7eb;border-radius:999px;padding:10px 15px;white-space:nowrap;background:#fff;color:#4b5563;font-weight:800;cursor:pointer}.cole-categories button.active{color:#111827;background:#f5c400;border-color:#e5b800}.cole-products-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px}.cole-products-grid.compact{grid-template-columns:repeat(6,minmax(0,1fr));gap:12px}.cole-products-grid.compact .cole-product-media{--cole-image-inset:8px;margin:8px;border-radius:12px;padding:0}.cole-products-grid.compact .cole-product-info{padding:0 10px 12px}.cole-products-grid.compact .cole-product-category{font-size:10px;margin-bottom:5px}.cole-products-grid.compact .cole-product-info h3{font-size:13px;min-height:48px}.cole-products-grid.compact .cole-product-meta{font-size:11px}.cole-products-grid.compact .cole-price{font-size:18px}.cole-products-grid.compact .cole-product-controls{flex-direction:column;align-items:stretch}.cole-products-grid.compact .cole-add-button{width:100%;padding:9px 10px}.cole-products-grid.compact .cole-quantity{justify-content:space-between}.cole-products-grid.compact .cole-quantity input{width:32px}.cole-product-card{border-radius:20px;background:#fff;overflow:hidden;border:1px solid #e5e7eb;box-shadow:0 10px 26px rgba(17,24,39,.055);transition:transform .2s ease,box-shadow .2s ease;min-width:0}.cole-product-card:hover{transform:translateY(-3px);box-shadow:0 20px 42px rgba(17,24,39,.095)}.cole-product-media{
  position:relative;
  --cole-image-inset:12px;
  --cole-media-ratio:1;
  aspect-ratio:var(--cole-media-ratio);
  margin:12px;
  border-radius:16px;
  background:#fff;
  display:flex;
  align-items:center;
  justify-content:center;
  overflow:hidden;
  border:1px solid #eeeeee;
  padding:0;
}

.cole-img-frame{
  position:absolute;
  inset:var(--cole-image-inset);
  display:grid;
  place-items:center;
  min-width:0;
  min-height:0;
  overflow:hidden;
  background:#fff;
  background-position:center;
  background-repeat:no-repeat;
  background-size:contain;
}

.cole-img-safe{
  position:absolute !important;
  inset:0 !important;
  display:block !important;
  width:100% !important;
  height:100% !important;
  max-width:100% !important;
  max-height:100% !important;
  object-fit:contain !important;
  object-position:center !important;
}
.cole-img-safe.cole-img-loaded{
  opacity:0;
}
  .cole-product-emoji{font-size:42px}.cole-product-emoji.large{font-size:66px}.cole-stock-indicator{position:absolute;top:10px;left:10px;display:inline-flex;align-items:center;gap:6px;border-radius:999px;background:rgba(255,255,255,.94);color:#334155;padding:6px 9px;font-size:11px;font-weight:900;box-shadow:0 2px 8px rgba(15,23,42,.11)}.cole-stock-indicator i{width:9px;height:9px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 2px rgba(255,255,255,.8)}.cole-stock-indicator.low i{background:#eab308}.cole-stock-indicator.out i{background:#ef4444}.cole-product-info{padding:0 15px 16px}.cole-product-category{margin:0 0 7px;color:#6b7280;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.08em}.cole-product-info h3{margin:0;min-height:46px;color:#111827;font-size:16px;line-height:1.18;font-weight:850}.cole-product-meta{margin:8px 0 0;color:#9ca3af;font-size:12px;font-weight:650}.cole-product-bottom{display:grid;gap:12px;margin-top:14px}.cole-price{color:#111827;font-size:24px;font-weight:950;letter-spacing:-.03em}.cole-product-controls{display:flex;align-items:center;justify-content:space-between;gap:10px}.cole-quantity{display:flex;align-items:center;gap:4px;border-radius:12px;background:#f9fafb;border:1px solid #e5e7eb;padding:4px}.cole-quantity button,.cole-cart-quantity button{border:1px solid #e5e7eb;width:31px;height:31px;border-radius:9px;display:grid;place-items:center;color:#111827;background:#fff;cursor:pointer}.cole-quantity button:disabled,.cole-cart-quantity button:disabled{opacity:.38;cursor:not-allowed}.cole-quantity input{width:40px;border:0;outline:0;background:transparent;text-align:center;font-weight:850;color:#111827}.cole-quantity-warning{margin:7px 0 0;color:#b45309;font-size:12px;font-weight:750}.cole-add-button{border:0;border-radius:12px;background:#111827;color:#fff;padding:11px 14px;font-weight:850;cursor:pointer}.cole-add-button:hover{background:#000}.cole-add-button.consult{background:#f5c400;color:#111827}.cole-add-button.consult:hover{background:#e5b800}.cole-add-button:disabled{opacity:.45;cursor:not-allowed}.cole-alert{border-radius:14px;padding:12px 14px;margin:12px 0;font-weight:750}.cole-alert.error{background:#fee2e2;color:#991b1b}.cole-alert button{margin-left:10px}
        .cole-modal-backdrop{position:fixed;inset:0;z-index:80;display:grid;place-items:center;padding:20px;background:rgba(17,24,39,.58);backdrop-filter:blur(4px)}.cole-cart-modal{width:min(540px,100%);max-height:min(92vh,860px);overflow-y:auto;border-radius:24px;background:#fff;padding:22px;box-shadow:0 30px 90px rgba(0,0,0,.25)}.cole-cart-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:16px}.cole-cart-header h2{margin:0;color:#111827;font-size:30px;font-weight:900;letter-spacing:-.04em}.cole-cart-header p{margin:2px 0 0;color:#6b7280;font-weight:650}.cole-close{border:1px solid #e5e7eb;width:40px;height:40px;border-radius:999px;display:grid;place-items:center;background:#fff;color:#374151;cursor:pointer}.cole-empty-cart{border-radius:20px;padding:34px 18px;background:#f9fafb;text-align:center;font-weight:800}.cole-empty-icon{width:48px;height:48px;color:#6b7280}.cole-empty-cart-symbol{font-size:54px;line-height:1;margin-bottom:10px}.cole-cart-items{display:grid;gap:12px}.cole-cart-item{display:grid;grid-template-columns:70px 1fr auto;gap:12px;border:1px solid #e5e7eb;border-radius:18px;padding:12px}.cole-cart-item-img{width:70px;height:70px;border-radius:14px;display:grid;place-items:center;background:#fff;overflow:hidden;border:1px solid #eeeeee}.cole-cart-item-body p{margin:0;color:#111827;font-weight:850;line-height:1.2}.cole-cart-item-body strong{display:block;margin-top:4px;color:#111827}.cole-cart-quantity{display:flex;align-items:center;gap:8px;margin-top:8px}.cole-cart-quantity span{min-width:22px;text-align:center;font-weight:850}.cole-trash{border:0;width:36px;height:36px;border-radius:999px;display:grid;place-items:center;background:#f3f4f6;color:#6b7280;cursor:pointer}.cole-checkout{margin-top:16px;border-radius:18px;padding:16px;background:#f9fafb;display:grid;gap:10px}.cole-checkout h3{margin:0;color:#111827;font-size:20px;font-weight:850}.cole-payment-methods{display:grid;gap:8px;border:1px solid #e5e7eb;background:#fff;border-radius:14px;padding:12px}.cole-payment-methods label{display:flex;gap:8px;align-items:center;color:#111827;font-weight:750}.cole-payment-methods input{width:auto}.cole-choice-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.cole-choice-card{min-height:86px;display:flex;align-items:flex-start;gap:11px;border:1px solid #d1d5db;border-radius:14px;background:#fff;padding:14px;cursor:pointer;color:#111827;transition:border-color .16s ease,background .16s ease,box-shadow .16s ease}.cole-choice-card:hover{border-color:#93c5fd;background:#f8fbff}.cole-choice-card.selected{border-color:#2563eb;background:#eff6ff;box-shadow:0 0 0 2px rgba(37,99,235,.12)}.cole-choice-card input{width:18px!important;height:18px;margin:2px 0 0;flex:0 0 auto;accent-color:#2563eb}.cole-choice-card span{display:grid;gap:4px;min-width:0}.cole-choice-card strong{font-size:15px;line-height:1.15;color:#111827}.cole-choice-card small{font-size:12px;line-height:1.3;color:#6b7280;font-weight:650}.cole-verification-box{border:1px solid #fde68a;background:#fffbeb;border-radius:14px;padding:12px;display:grid;gap:8px}.cole-verification-box strong{color:#111827}.cole-verification-box p{margin:0;color:#6b7280;font-size:13px;font-weight:650}.cole-verification-box label{display:flex;gap:8px;align-items:flex-start;color:#111827;font-weight:750}.cole-verification-box input{width:auto;margin-top:2px}.cole-back{justify-self:start;border:0;background:transparent;color:#111827;font-weight:850;cursor:pointer}.cole-checkout input,.cole-checkout textarea,.cole-checkout select{width:100%;border:1px solid #d1d5db;border-radius:12px;padding:12px 13px;background:#fff;outline:0;font-weight:650;color:#111827}.cole-checkout textarea{min-height:90px;resize:vertical}.cole-delivery-note{border:1px solid #bae6fd;background:#f0f9ff;border-radius:14px;padding:12px;color:#0c4a6e}.cole-delivery-note strong{color:#075985}.cole-delivery-note p{margin:5px 0 0;font-size:13px;font-weight:650;line-height:1.35}.cole-cart-footer{border-top:1px solid #e5e7eb;margin-top:18px;padding-top:16px}.cole-subtotal{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}.cole-subtotal span{color:#6b7280;font-weight:850}.cole-subtotal strong{color:#111827;font-size:28px;font-weight:950}.cole-subtotal.compact{margin-top:-6px;margin-bottom:10px}.cole-subtotal.compact strong{font-size:18px}.cole-subtotal.total{border-top:1px solid #d1d5db;padding-top:10px}.cole-primary-full{width:100%;border:0;border-radius:14px;padding:14px 18px;background:#111827;color:#fff;font-size:16px;font-weight:850;cursor:pointer}.cole-primary-full:disabled{opacity:.45;cursor:not-allowed}.cole-cart-footer p{margin:10px 0 0;color:#9ca3af;font-size:13px;font-weight:650;text-align:center}.cole-order-ok{text-align:center;padding:28px 4px 8px}.cole-check-icon{width:76px;height:76px;color:#16a34a}.cole-order-ok h3{margin:12px 0 0;color:#111827;font-size:28px;font-weight:900}.cole-order-ok p{color:#6b7280;font-weight:650}.cole-order-ok strong{display:block;margin:10px 0 18px;color:#111827;font-size:18px}.cole-order-note{border-radius:14px;background:#fffbeb;border:1px solid #fde68a;padding:12px}.cole-whatsapp-confirm{display:block;width:100%;border-radius:14px;background:#16a34a;color:#fff;text-decoration:none;font-size:16px;font-weight:900;padding:14px 18px;margin:12px 0}

        .cole-catalog-dropdown{position:relative}
        .cole-catalog-dropdown-panel{
          position:absolute;
          top:32px;
          right:0;
          width:min(820px,calc(100vw - 36px));
          max-height:min(70vh,640px);
          overflow-y:scroll;
          overscroll-behavior:contain;
          scrollbar-color:#94a3b8 #f8fafc;
          scrollbar-width:thin;
          background:#fff;
          border:1px solid #e5e7eb;
          border-radius:14px;
          box-shadow:0 18px 45px rgba(17,24,39,.16);
          padding:8px;
          z-index:90;
          display:grid;
          grid-template-columns:repeat(3,minmax(0,1fr));
          gap:2px;
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
        .cole-catalog-dropdown-panel button:first-child{grid-column:1 / -1}
        .cole-catalog-dropdown-panel::-webkit-scrollbar{width:10px}.cole-catalog-dropdown-panel::-webkit-scrollbar-thumb{background:#94a3b8;border:2px solid #fff;border-radius:999px}.cole-catalog-dropdown-panel::-webkit-scrollbar-track{background:#f8fafc}

        .cole-logo-web{width:74px;height:54px;border-radius:0;border:0;box-shadow:none;background:transparent;object-fit:contain}
        .cole-category-menu{position:sticky;top:78px;z-index:35;background:#fff;border-bottom:1px solid #e5e7eb;box-shadow:0 6px 18px rgba(17,24,39,.04)}
        .cole-category-menu-inner{display:flex;gap:8px;overflow-x:auto;padding:10px 0}
        .cole-category-menu button{border:1px solid #e5e7eb;border-radius:999px;background:#fff;color:#374151;font-weight:850;font-size:13px;white-space:nowrap;padding:8px 12px;cursor:pointer}
        .cole-category-menu button.active{background:#f5c400;border-color:#e5b800;color:#111827}
        .cole-variant-select{display:grid;gap:4px;margin-top:9px;color:#6b7280;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.06em}
        .cole-variant-select select{height:36px;border:1px solid #d1d5db;border-radius:10px;background:#fff;color:#111827;font-size:13px;font-weight:750;padding:0 10px;text-transform:none;letter-spacing:0}
        .cole-footer{border-top:1px solid rgba(255,255,255,.08);background:radial-gradient(circle at top left,rgba(245,196,0,.18),transparent 32%),#111827;color:#fff;padding:38px 0;margin-top:24px}.cole-footer-grid{display:grid;grid-template-columns:1.35fr 1fr 1fr 1fr;gap:18px;align-items:stretch}.cole-footer strong{display:block;margin-bottom:9px;font-size:15px}.cole-footer p,.cole-footer a{margin:4px 0;color:#d1d5db;font-size:13px;font-weight:650;line-height:1.45}.cole-footer a{text-decoration:none}.cole-footer a:hover{color:#fff}.cole-footer-brand,.cole-footer-card{border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);border-radius:18px;padding:18px;box-shadow:0 18px 36px rgba(0,0,0,.12)}.cole-footer-brand img{display:block;width:96px;height:auto;margin-bottom:10px}.cole-footer-card{display:flex;flex-direction:column}.cole-regret-link{display:inline-block;margin-top:8px;border-radius:999px;background:#f5c400 !important;color:#111827 !important;text-decoration:none;font-weight:900;padding:9px 12px;font-size:13px;text-align:center}.cole-datafiscal{display:inline-flex;align-self:flex-start;margin-top:12px;background:#fff;border-radius:10px;padding:6px}.cole-datafiscal img{width:88px;height:auto;display:block;border-radius:6px}.cole-footer-legal{gap:4px}
        @media(max-width:1000px){.cole-header-inner{gap:14px;flex-wrap:wrap}.cole-nav{display:flex;order:3;width:100%;margin-left:0}.cole-nav-links{margin-left:0;gap:16px}.cole-catalog-dropdown{width:100%}.cole-nav-dropdown-button{width:100%;padding:11px 14px;text-align:center}.cole-catalog-dropdown-panel{position:absolute;top:48px;width:min(360px,calc(100vw - 36px))}.cole-hero-grid,.cole-catalog-header{grid-template-columns:1fr}.cole-footer-grid{grid-template-columns:1fr 1fr}.cole-filters{grid-template-columns:1fr 1fr}.cole-search{grid-column:1 / -1}.cole-products-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.cole-products-grid.compact{grid-template-columns:repeat(3,minmax(0,1fr))}}
        @media(max-width:640px){.cole-store{overflow-x:hidden}.cole-footer-grid{grid-template-columns:1fr}.cole-hero{padding:12px 0}.cole-hero-slider{aspect-ratio:16 / 5;min-height:0;border-radius:16px;background:#fff}.cole-hero-slider img{object-fit:contain}.cole-shell{width:min(100% - 20px,1240px)}.cole-header-inner{min-height:0;display:grid;grid-template-columns:1fr 1fr;grid-template-areas:"brand brand" "catalog cart" "links links";gap:8px;padding:10px 0}.cole-brand{grid-area:brand;gap:8px;max-width:none;min-width:0}.cole-brand-title{font-size:16px}.cole-brand-subtitle{display:none}.cole-logo-img{width:44px;height:44px}.cole-logo-web{width:62px;height:44px}.cole-nav{display:block;grid-area:catalog;width:100%;margin:0}.cole-nav-links{grid-area:links;display:flex;justify-content:center;gap:22px;margin:0;padding:2px 0 4px}.cole-nav-links a{font-size:14px}.cole-catalog-dropdown{width:100%}.cole-nav-dropdown-button{width:100%;height:46px;min-height:46px;max-height:46px;padding:0 14px;text-align:center}.cole-catalog-dropdown-panel{top:50px;left:0;right:auto;width:calc(200% + 8px);max-height:calc(100dvh - 180px);grid-template-columns:1fr}.cole-cart-button{grid-area:cart;width:100%;height:46px;min-height:46px;max-height:46px;padding:0 12px;justify-content:center;overflow:hidden}.cole-cart-button span{display:inline}:global(.cole-cart-icon){display:none!important}.cole-catalog{padding:28px 0 42px}.cole-catalog-header{gap:16px;margin-bottom:16px}.cole-catalog-header h2{font-size:28px}.cole-catalog-header p{font-size:13px}.cole-filters{grid-template-columns:1fr 1fr;gap:9px}.cole-search{grid-column:1 / -1;height:44px;padding:0 11px}.cole-filters select{height:44px;padding:0 10px;font-size:12px}.cole-featured-grid,.cole-products-grid{grid-template-columns:1fr;gap:14px}.cole-products-grid.compact{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.cole-products-grid.compact .cole-product-card{border-radius:14px}.cole-products-grid.compact .cole-product-media{margin:7px;border-radius:10px;padding:6px}.cole-products-grid.compact .cole-product-info{padding:0 8px 10px}.cole-products-grid.compact .cole-product-category,.cole-products-grid.compact .cole-product-meta{display:none}.cole-products-grid.compact .cole-product-info h3{font-size:12px;min-height:44px;line-height:1.2}.cole-products-grid.compact .cole-price{font-size:16px}.cole-products-grid.compact .cole-product-bottom{gap:8px;margin-top:10px}.cole-products-grid.compact .cole-quantity button{width:28px;height:28px}.cole-products-grid.compact .cole-add-button{font-size:12px;padding:8px}.cole-product-controls{align-items:stretch;flex-direction:column}.cole-quantity{justify-content:space-between}.cole-add-button{width:100%}.cole-cart-modal{width:calc(100vw - 20px);padding:16px;border-radius:18px}.cole-choice-list{grid-template-columns:1fr}.cole-choice-card{min-height:72px;padding:13px}.cole-choice-card strong{font-size:16px}.cole-choice-card small{font-size:13px}.cole-cart-item{grid-template-columns:58px 1fr auto}.cole-cart-item-img{width:58px;height:58px}}
        @media(max-width:640px){.cole-back-to-top{right:14px;bottom:14px;padding:12px 14px}.cole-back-to-top span{display:none}}
      `}</style>
    </div>
  );
}
