const Ventas = (() => {
    const { supabase, mostrarNotificacion, formatearMoneda, formatearFecha, formatearFechaCorta, ahora } = window.appConfig;

    let carrito = [];
    let usuarioActual = null;
    let masVendidosIds = [];    // ids de producto a mostrar por defecto (más vendidos + relleno)
    let masVendidosRealCount = 0; // cuántos de esos son realmente "más vendidos" (con ventas registradas)
    let verCatalogoCompleto = false; // toggle para saltear el filtro por defecto

    const CANTIDAD_DESTACADOS = 6;

    function setUsuario(usuario) { usuarioActual = usuario; }

    async function cargarPOS() {
        _construirFiltrosCategorias();

        const idsActivos = new Set(Productos.getLista().map(p => p.id));
        const rankingCompleto = await _obtenerRankingVentas(); // todos, ordenados de más a menos vendidos
        const topVendidos = rankingCompleto.filter(id => idsActivos.has(id)).slice(0, CANTIDAD_DESTACADOS);

        masVendidosRealCount = topVendidos.length;
        masVendidosIds = _completarConOtrosProductos(topVendidos, CANTIDAD_DESTACADOS);
        verCatalogoCompleto = false;
        _renderizarGrilla();
        _actualizarCarrito();

        document.getElementById('productSearch').oninput = (e) => {
            _renderizarGrilla(e.target.value, _categoriaActiva());
        };
        document.getElementById('clearCartBtn').onclick = () => {
            if (carrito.length > 0 && confirm('¿Vaciar el carrito?')) {
                carrito = [];
                _actualizarCarrito();
            }
        };
        document.getElementById('discountInput').oninput = _actualizarCarrito;
        document.getElementById('checkoutBtn').onclick = mostrarModalCheckout;
    }

    // Si hay menos de "total" productos con ventas registradas, completa el
    // resto con otros productos (alfabéticamente) para siempre mostrar "total".
    function _completarConOtrosProductos(ids, total) {
        if (ids.length >= total) return ids;
        const yaIncluidos = new Set(ids);
        const relleno = Productos.getLista()
            .filter(p => !yaIncluidos.has(p.id))
            .sort((a, b) => a.nombre.localeCompare(b.nombre))
            .slice(0, total - ids.length)
            .map(p => p.id);
        return [...ids, ...relleno];
    }

    // Suma las cantidades vendidas por producto (venta_detalles) y devuelve
    // TODOS los ids de producto, ordenados de más a menos vendido. Se filtra
    // y se recorta recién en cargarPOS, así un producto deshabilitado dentro
    // del top no deja un hueco: se lo salta y sube el siguiente activo.
    async function _obtenerRankingVentas() {
        if (!supabase) return [];
        try {
            const { data, error } = await supabase
                .from('venta_detalles')
                .select('producto_id, cantidad');
            if (error) throw error;

            const totales = {};
            (data || []).forEach(d => {
                totales[d.producto_id] = (totales[d.producto_id] || 0) + (d.cantidad || 0);
            });

            return Object.entries(totales)
                .sort((a, b) => b[1] - a[1])
                .map(([id]) => Number(id));
        } catch {
            return [];
        }
    }

    function _categoriaActiva() {
        return document.querySelector('.cat-filter-btn.active')?.getAttribute('data-cat') || '';
    }

    function _construirFiltrosCategorias() {
        const barra = document.getElementById('categoryFilterBar');
        if (!barra) return;

        const productos = Productos.getLista();
        const catMap = {};
        productos.forEach(p => {
            if (p.categorias?.nombre && p.categoria_id && !catMap[p.categoria_id]) {
                catMap[p.categoria_id] = p.categorias.nombre;
            }
        });

        barra.innerHTML = '<button class="cat-filter-btn active" data-cat=""><i class="fas fa-th"></i> Todos</button>';
        Object.entries(catMap).sort((a, b) => a[1].localeCompare(b[1])).forEach(([id, nombre]) => {
            const btn = document.createElement('button');
            btn.className = 'cat-filter-btn';
            btn.setAttribute('data-cat', id);
            btn.innerHTML = `<i class="fas fa-tag"></i> ${nombre}`;
            barra.appendChild(btn);
        });

        barra.addEventListener('click', (e) => {
            const btn = e.target.closest('.cat-filter-btn');
            if (!btn) return;
            barra.querySelectorAll('.cat-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            verCatalogoCompleto = false;
            _renderizarGrilla(document.getElementById('productSearch').value, btn.getAttribute('data-cat'));
        });
    }

    function _renderizarGrilla(busqueda = '', categoriaId = '') {
        const grilla = document.getElementById('productGrid');
        const info = document.getElementById('posGridInfo');
        grilla.innerHTML = '';

        let filtrados = Productos.getLista().filter(p => {
            const matchBusqueda = p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
                (p.codigo && p.codigo.toLowerCase().includes(busqueda.toLowerCase()));
            const matchCat = !categoriaId || String(p.categoria_id) === String(categoriaId);
            return matchBusqueda && matchCat;
        });

        // Vista por defecto ("Todos", sin búsqueda): solo los más vendidos,
        // salvo que el usuario haya pedido ver el catálogo completo.
        const esVistaPorDefecto = !busqueda && !categoriaId;
        const aplicarTop = esVistaPorDefecto && !verCatalogoCompleto && masVendidosIds.length > 0;

        if (aplicarTop) {
            const porId = new Map(filtrados.map(p => [p.id, p]));
            filtrados = masVendidosIds.map(id => porId.get(id)).filter(Boolean);
        }

        if (info) {
            if (aplicarTop) {
                const textoDestacados = masVendidosRealCount >= filtrados.length
                    ? `Mostrando los <strong>${filtrados.length} más vendidos</strong>`
                    : `Mostrando los <strong>${masVendidosRealCount} más vendidos</strong>${filtrados.length > masVendidosRealCount ? ` + ${filtrados.length - masVendidosRealCount} destacados` : ''}`;
                info.innerHTML = `<span><i class="fas fa-fire"></i> ${textoDestacados}</span>
                    <button type="button" id="verCatalogoCompletoBtn" class="btn-text">Ver catálogo completo</button>`;
                const btn = document.getElementById('verCatalogoCompletoBtn');
                if (btn) btn.onclick = () => { verCatalogoCompleto = true; _renderizarGrilla(busqueda, categoriaId); };
            } else if (esVistaPorDefecto && verCatalogoCompleto) {
                info.innerHTML = `<span>Mostrando el catálogo completo</span>
                    <button type="button" id="verTopVendidosBtn" class="btn-text">Ver más vendidos</button>`;
                const btn = document.getElementById('verTopVendidosBtn');
                if (btn) btn.onclick = () => { verCatalogoCompleto = false; _renderizarGrilla(busqueda, categoriaId); };
            } else {
                info.innerHTML = '';
            }
        }

        if (filtrados.length === 0) {
            grilla.innerHTML = '<p style="text-align:center;padding:20px;color:var(--text-muted);">No se encontraron productos</p>';
            return;
        }

        filtrados.forEach(p => {
            const item = document.createElement('div');
            item.className = 'product-item';
            const imgHtml = p.imagen_url
                ? `<img class="product-item-img" src="${p.imagen_url}" alt="${p.nombre}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                   <div class="product-item-img-placeholder" style="display:none;"><i class="fas fa-microchip"></i></div>`
                : `<div class="product-item-img-placeholder"><i class="fas fa-microchip"></i></div>`;
            item.innerHTML = `${imgHtml}<h4>${p.nombre}</h4><div class="price">${formatearMoneda(p.precio)}</div><div class="stock">Stock: ${p.stock}</div>`;
            item.onclick = () => _agregarAlCarrito(p);
            grilla.appendChild(item);
        });
    }

    function _agregarAlCarrito(producto) {
        if (producto.stock <= 0) { mostrarNotificacion('Producto sin stock', 'warning'); return; }
        const existente = carrito.find(i => i.id === producto.id);
        if (existente) {
            if (existente.cantidad < producto.stock) existente.cantidad++;
            else { mostrarNotificacion('Stock insuficiente', 'warning'); return; }
        } else {
            carrito.push({ id: producto.id, nombre: producto.nombre, precio: producto.precio, stock: producto.stock, cantidad: 1 });
        }
        _actualizarCarrito();
    }

    function _actualizarCarrito() {
        const contenedor = document.getElementById('cartItems');
        const subtotalEl  = document.getElementById('cartSubtotal');
        const totalEl     = document.getElementById('cartTotal');
        const btnFinalizar = document.getElementById('checkoutBtn');

        contenedor.innerHTML = '';

        if (carrito.length === 0) {
            contenedor.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px;">Carrito vacío</p>';
            subtotalEl.textContent = '$0.00'; totalEl.textContent = '$0.00';
            btnFinalizar.disabled = true;
            return;
        }

        let subtotal = 0;
        carrito.forEach(item => {
            const itemTotal = item.precio * item.cantidad;
            subtotal += itemTotal;
            const div = document.createElement('div');
            div.className = 'cart-item';
            div.innerHTML = `
                <div class="cart-item-info">
                    <h4>${item.nombre}</h4>
                    <p>${formatearMoneda(item.precio)} x ${item.cantidad} = ${formatearMoneda(itemTotal)}</p>
                </div>
                <div class="cart-item-controls">
                    <button class="qty-btn" onclick="Ventas.cambiarCantidad(${item.id},-1)">-</button>
                    <span>${item.cantidad}</span>
                    <button class="qty-btn" onclick="Ventas.cambiarCantidad(${item.id},1)">+</button>
                    <button class="remove-btn" onclick="Ventas.quitarDelCarrito(${item.id})"><i class="fas fa-trash"></i></button>
                </div>
            `;
            contenedor.appendChild(div);
        });

        const descuento = parseFloat(document.getElementById('discountInput').value) || 0;
        subtotalEl.textContent = formatearMoneda(subtotal);
        totalEl.textContent = formatearMoneda(Math.max(0, subtotal - descuento));
        btnFinalizar.disabled = false;
    }

    function cambiarCantidad(idProducto, delta) {
        const item = carrito.find(i => i.id === idProducto);
        if (!item) return;
        const nueva = item.cantidad + delta;
        if (nueva <= 0) quitarDelCarrito(idProducto);
        else if (nueva <= item.stock) { item.cantidad = nueva; _actualizarCarrito(); }
        else mostrarNotificacion('Stock insuficiente', 'warning');
    }

    function quitarDelCarrito(idProducto) {
        carrito = carrito.filter(i => i.id !== idProducto);
        _actualizarCarrito();
    }

    function mostrarModalCheckout() {
        const modal = document.getElementById('checkoutModal');
        const form  = document.getElementById('checkoutForm');

        form.reset();
        document.getElementById('paymentMode').value = 'simple';
        document.getElementById('paySimpleGroup').style.display = '';
        document.getElementById('payMixtoGroup').style.display = 'none';
        document.getElementById('payParcialGroup').style.display = 'none';

        const subtotal  = carrito.reduce((s, i) => s + i.precio * i.cantidad, 0);
        const descuento = parseFloat(document.getElementById('discountInput').value) || 0;
        const total     = Math.max(0, subtotal - descuento);

        document.getElementById('checkoutSubtotal').textContent = formatearMoneda(subtotal);
        document.getElementById('checkoutDiscount').textContent = formatearMoneda(descuento);
        document.getElementById('checkoutTotal').textContent    = formatearMoneda(total);

        const selectCliente = document.getElementById('saleCustomer');
        selectCliente.innerHTML = '<option value="">VENTA GENERAL (Sin Cliente)</option>';
        Clientes.getLista().forEach(c => {
            selectCliente.innerHTML += `<option value="${c.id}">${c.nombre}</option>`;
        });

        // Lógica dinámica del modo de pago
        const modeSelect = document.getElementById('paymentMode');
        const actualizarModo = () => {
            const modo = modeSelect.value;
            document.getElementById('paySimpleGroup').style.display  = modo === 'simple'  ? '' : 'none';
            document.getElementById('payMixtoGroup').style.display   = modo === 'mixto'   ? '' : 'none';
            document.getElementById('payParcialGroup').style.display = modo === 'parcial' ? '' : 'none';
        };
        modeSelect.onchange = actualizarModo;

        // Actualizar suma mixta en tiempo real
        ['mixEfectivo','mixTarjeta','mixTransferencia','mixCredito'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.oninput = () => _actualizarMixto(total);
        });
        ['mixEfectivo','mixTarjeta','mixTransferencia','mixCredito'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = 0;
        });

        // Actualizar deuda parcial
        const parcialInput = document.getElementById('parcialMonto');
        if (parcialInput) parcialInput.oninput = () => {
            const pagado = parseFloat(parcialInput.value) || 0;
            const deuda  = Math.max(0, total - pagado);
            document.getElementById('parcialDeudaLabel').textContent = formatearMoneda(deuda);
        };

        modal.classList.remove('hidden');
        modal.querySelectorAll('.close-modal').forEach(btn => btn.onclick = () => modal.classList.add('hidden'));
        form.onsubmit = async (e) => { e.preventDefault(); await procesarVenta(); };
    }

    function _actualizarMixto(total) {
        const suma = ['mixEfectivo','mixTarjeta','mixTransferencia','mixCredito']
            .reduce((s, id) => s + (parseFloat(document.getElementById(id)?.value) || 0), 0);
        document.getElementById('mixSumaLabel').textContent = formatearMoneda(suma);
        const diff = total - suma;
        const diffEl = document.getElementById('mixDiffLabel');
        diffEl.textContent = formatearMoneda(Math.abs(diff));
        diffEl.style.color = diff > 0.01 ? '#f43f5e' : diff < -0.01 ? '#f59e0b' : '#22c55e';
    }

    async function procesarVenta() {
        if (!supabase || !usuarioActual) return;

        const subtotal    = carrito.reduce((s, i) => s + i.precio * i.cantidad, 0);
        const descuento   = parseFloat(document.getElementById('discountInput').value) || 0;
        const total       = Math.max(0, subtotal - descuento);
        const modo        = document.getElementById('paymentMode').value;
        const idCliente   = document.getElementById('saleCustomer').value;
        const clienteId   = idCliente ? parseInt(idCliente) : null;

        let metodoPago = 'efectivo';
        let montoPagado = total;
        let deudaGenerada = 0;
        let notasMixto = '';

        if (modo === 'simple') {
            metodoPago  = document.getElementById('paymentType').value;
            montoPagado = total;
        } else if (modo === 'mixto') {
            const ef  = parseFloat(document.getElementById('mixEfectivo').value)      || 0;
            const ta  = parseFloat(document.getElementById('mixTarjeta').value)       || 0;
            const tr  = parseFloat(document.getElementById('mixTransferencia').value) || 0;
            const cr  = parseFloat(document.getElementById('mixCredito').value)       || 0;
            const suma = ef + ta + tr + cr;
            if (Math.abs(suma - total) > 0.05) {
                mostrarNotificacion(`La suma (${formatearMoneda(suma)}) no coincide con el total (${formatearMoneda(total)})`, 'error');
                return;
            }
            metodoPago    = 'mixto';
            montoPagado   = suma - cr;
            deudaGenerada = cr;
            if (!clienteId && cr > 0) { mostrarNotificacion('Seleccioná un cliente para registrar el crédito', 'error'); return; }
            const partes = [];
            if (ef > 0) partes.push(`Efectivo: ${formatearMoneda(ef)}`);
            if (ta > 0) partes.push(`Tarjeta: ${formatearMoneda(ta)}`);
            if (tr > 0) partes.push(`Transf: ${formatearMoneda(tr)}`);
            if (cr > 0) partes.push(`Crédito: ${formatearMoneda(cr)}`);
            notasMixto = partes.join(' | ');
        } else if (modo === 'parcial') {
            const pagadoAhora = parseFloat(document.getElementById('parcialMonto').value) || 0;
            if (pagadoAhora < 0 || pagadoAhora > total) { mostrarNotificacion('El monto no puede superar el total', 'error'); return; }
            if (!clienteId && pagadoAhora < total) { mostrarNotificacion('Seleccioná un cliente para registrar la deuda', 'error'); return; }
            metodoPago    = document.getElementById('parcialMetodo').value;
            montoPagado   = pagadoAhora;
            deudaGenerada = total - pagadoAhora;
        }

        const datosVenta = {
            codigo:      'V-' + Date.now(),
            fecha:       ahora(),
            cliente_id:  clienteId,
            vendedor_id: usuarioActual.id,
            subtotal, descuento, total,
            estado:      'completada',
            metodo_pago: metodoPago,
            notas:       [document.getElementById('saleNotes').value, notasMixto].filter(Boolean).join(' — ') || null
        };

        try {
            const { data: venta, error: errVenta } = await supabase.from('ventas').insert([datosVenta]).select().single();
            if (errVenta) throw errVenta;

            const detalles = carrito.map(i => ({
                venta_id: venta.id, producto_id: i.id, cantidad: i.cantidad,
                precio_unitario: i.precio, subtotal: i.precio * i.cantidad
            }));
            const { error: errDetalles } = await supabase.from('venta_detalles').insert(detalles);
            if (errDetalles) throw errDetalles;

            for (const item of carrito) {
                await supabase.from('productos').update({ stock: item.stock - item.cantidad }).eq('id', item.id);
            }

            // Actualizar deuda del cliente si corresponde
            if (deudaGenerada > 0 && clienteId) {
                const { data: cli } = await supabase.from('clientes').select('deuda_total').eq('id', clienteId).single();
                const nuevaDeuda = (parseFloat(cli?.deuda_total) || 0) + deudaGenerada;
                await supabase.from('clientes').update({ deuda_total: nuevaDeuda }).eq('id', clienteId);
            }

            document.getElementById('checkoutModal').classList.add('hidden');
            const msgExtra = deudaGenerada > 0 ? ` · Deuda registrada: ${formatearMoneda(deudaGenerada)}` : '';
            mostrarNotificacion(`Venta completada: ${datosVenta.codigo}${msgExtra}`, 'success');

            carrito = [];
            document.getElementById('discountInput').value = 0;
            _actualizarCarrito();
            document.getElementById('checkoutForm').reset();

            await Productos.cargar();
            await Clientes.cargar();
        } catch (err) {
            console.error(err);
            mostrarNotificacion('Error al procesar la venta', 'error');
        }
    }

    let periodoActual = 'dia';
    let mesSeleccionado = null; // 1-12, para la pestaña "Mes"
    let anioSeleccionado = null; // año correspondiente al mes elegido
    let anioTabSeleccionado = null; // año elegido para la pestaña "Año" (independiente del anterior)

    const pad2 = n => String(n).padStart(2, '0');

    // Fecha de hoy en horario Argentina como {y,m,d}
    function _hoyBA() {
        const hoyStr = ahora().split('T')[0];
        const [y, m, d] = hoyStr.split('-').map(Number);
        return { y, m, d };
    }

    // Devuelve la fecha/hora local (America/Argentina/Buenos_Aires) como objeto {y,m,d}
    function _fechaLocal(fechaStr) {
        const partes = new Date(fechaStr).toLocaleString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' });
        const [fecha] = partes.split(' ');
        const [y, m, d] = fecha.split('-').map(Number);
        return { y, m, d, key: fecha };
    }

    // Calcula el rango { desde, hasta } (formato YYYY-MM-DD) según el período elegido.
    // "hasta" es exclusivo; null significa "sin límite superior" (hasta ahora).
    function _rangoPorPeriodo(periodo) {
        const { y, m, d } = _hoyBA();

        if (periodo === 'dia') {
            return { desde: `${y}-${pad2(m)}-${pad2(d)}`, hasta: null };
        }
        if (periodo === 'semana') {
            const hoy = new Date(Date.UTC(y, m - 1, d));
            const diaSemana = hoy.getUTCDay(); // 0=domingo
            const offset = diaSemana === 0 ? 6 : diaSemana - 1;
            const lunes = new Date(hoy);
            lunes.setUTCDate(hoy.getUTCDate() - offset);
            return { desde: lunes.toISOString().split('T')[0], hasta: null };
        }
        if (periodo === 'mes') {
            if (mesSeleccionado === null) { mesSeleccionado = m; anioSeleccionado = y; }
            const desde = `${anioSeleccionado}-${pad2(mesSeleccionado)}-01`;
            const esMesActual = anioSeleccionado === y && mesSeleccionado === m;
            let hasta = null;
            if (!esMesActual) {
                const sigMes  = mesSeleccionado === 12 ? 1 : mesSeleccionado + 1;
                const sigAnio = mesSeleccionado === 12 ? anioSeleccionado + 1 : anioSeleccionado;
                hasta = `${sigAnio}-${pad2(sigMes)}-01`;
            }
            return { desde, hasta };
        }
        if (periodo === 'anio') {
            if (anioTabSeleccionado === null) anioTabSeleccionado = y;
            const desde = `${anioTabSeleccionado}-01-01`;
            const esAnioActual = anioTabSeleccionado === y;
            const hasta = esAnioActual ? null : `${anioTabSeleccionado + 1}-01-01`;
            return { desde, hasta };
        }
        return { desde: null, hasta: null }; // histórico: sin límites
    }

    function _cambiarMes(delta) {
        if (mesSeleccionado === null) { const h = _hoyBA(); mesSeleccionado = h.m; anioSeleccionado = h.y; }
        mesSeleccionado += delta;
        if (mesSeleccionado > 12) { mesSeleccionado = 1; anioSeleccionado++; }
        if (mesSeleccionado < 1)  { mesSeleccionado = 12; anioSeleccionado--; }
        cargarHistorial('mes');
    }

    function _cambiarAnio(delta) {
        if (anioTabSeleccionado === null) anioTabSeleccionado = _hoyBA().y;
        anioTabSeleccionado += delta;
        cargarHistorial('anio');
    }

    const NOMBRES_DIA = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
    const NOMBRES_MES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

    function _tituloGrupoDia({ y, m, d }) {
        const fechaObj = new Date(Date.UTC(y, m - 1, d));
        const diaSemana = NOMBRES_DIA[fechaObj.getUTCDay()];
        return `${diaSemana} ${d} de ${NOMBRES_MES[m - 1]} de ${y}`;
    }

    // Muestra/oculta y actualiza el navegador de mes (◀ Agosto 2026 ▶)
    function _actualizarNavegadorMes() {
        const nav = document.getElementById('salesMonthNav');
        if (!nav) return;

        if (periodoActual !== 'mes') {
            nav.classList.add('hidden');
            return;
        }

        if (mesSeleccionado === null) { const h = _hoyBA(); mesSeleccionado = h.m; anioSeleccionado = h.y; }
        nav.classList.remove('hidden');

        const nombreMes = NOMBRES_MES[mesSeleccionado - 1];
        document.getElementById('salesMonthLabel').textContent =
            `${nombreMes.charAt(0).toUpperCase()}${nombreMes.slice(1)} ${anioSeleccionado}`;

        const h = _hoyBA();
        const esMesActual = anioSeleccionado === h.y && mesSeleccionado === h.m;
        document.getElementById('nextMonthBtn').disabled = esMesActual;
    }

    // Muestra/oculta y actualiza el navegador de año (◀ 2026 ▶)
    function _actualizarNavegadorAnio() {
        const nav = document.getElementById('salesYearNav');
        if (!nav) return;

        if (periodoActual !== 'anio') {
            nav.classList.add('hidden');
            return;
        }

        if (anioTabSeleccionado === null) anioTabSeleccionado = _hoyBA().y;
        nav.classList.remove('hidden');

        document.getElementById('salesYearLabel').textContent = String(anioTabSeleccionado);
        document.getElementById('nextYearBtn').disabled = anioTabSeleccionado === _hoyBA().y;
    }

    async function cargarHistorial(periodo) {
        if (!supabase) return;
        _inicializarTabsHistorial();
        periodoActual = periodo || periodoActual || 'dia';

        // Sincronizar estado visual de las tabs
        document.querySelectorAll('#salesPeriodTabs .period-tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-period') === periodoActual);
        });
        _actualizarNavegadorMes();
        _actualizarNavegadorAnio();

        const contenedor = document.getElementById('salesHistoryGroups');
        const resumen = document.getElementById('salesHistorySummary');
        contenedor.innerHTML = '<p style="text-align:center;padding:20px;color:var(--text-muted);">Cargando...</p>';

        try {
            const { desde, hasta } = _rangoPorPeriodo(periodoActual);
            let query = supabase
                .from('ventas')
                .select('*, clientes (nombre), usuarios (nombre)')
                .order('fecha', { ascending: false });

            if (desde) query = query.gte('fecha', desde);
            if (hasta) query = query.lt('fecha', hasta);
            query = query.limit(periodoActual === 'historico' ? 1000 : 500);

            const { data: ventas, error } = await query;
            if (error) throw error;

            contenedor.innerHTML = '';

            if (!ventas || ventas.length === 0) {
                resumen.innerHTML = '';
                contenedor.innerHTML = '<p style="text-align:center;padding:20px;color:var(--text-muted);">No hay ventas en este período</p>';
                return;
            }

            // Resumen del período
            const totalPeriodo = ventas.reduce((s, v) => s + (parseFloat(v.total) || 0), 0);
            resumen.innerHTML = `
                <span>${ventas.length} venta${ventas.length !== 1 ? 's' : ''} en este período — <strong>${formatearMoneda(totalPeriodo)}</strong></span>
                <span class="sales-history-toggle-all">
                    <button type="button" id="expandAllDaysBtn" class="btn-text"><i class="fas fa-angles-down"></i> Expandir todos</button>
                    <button type="button" id="collapseAllDaysBtn" class="btn-text"><i class="fas fa-angles-up"></i> Colapsar todos</button>
                </span>
            `;

            // Agrupar por día (clave YYYY-MM-DD en horario Argentina)
            const grupos = new Map();
            ventas.forEach(v => {
                const f = _fechaLocal(v.fecha);
                if (!grupos.has(f.key)) grupos.set(f.key, { info: f, ventas: [] });
                grupos.get(f.key).ventas.push(v);
            });

            let index = 0;
            grupos.forEach(({ info, ventas: ventasDia }, key) => {
                const esElPrimero = index === 0;
                index++;
                const totalDia = ventasDia.reduce((s, v) => s + (parseFloat(v.total) || 0), 0);
                const filas = ventasDia.map(v => `
                    <tr>
                        <td>${v.codigo}</td>
                        <td>${v.clientes?.nombre || 'Venta General'}</td>
                        <td>${v.usuarios?.nombre || '-'}</td>
                        <td>${formatearMoneda(v.total)}</td>
                        <td><span class="status-badge status-info">${v.metodo_pago}</span></td>
                        <td>${formatearFecha(v.fecha)}</td>
                        <td>
                            <div class="action-buttons">
                                <button class="btn-action btn-view" title="Ver detalle" onclick="Ventas.verDetalle('${v.id}')">
                                    <i class="fas fa-eye"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `).join('');

                const grupoEl = document.createElement('div');
                // Solo el día más reciente arranca expandido; el resto colapsado
                // para que listas largas (semana/mes/año/histórico) sean navegables.
                grupoEl.className = esElPrimero ? 'sales-day-group' : 'sales-day-group collapsed';
                grupoEl.dataset.dayKey = key;
                grupoEl.innerHTML = `
                    <div class="sales-day-group-header">
                        <div class="sales-day-group-title"><i class="fas fa-chevron-down"></i> ${_tituloGrupoDia(info)}</div>
                        <div class="sales-day-group-meta">
                            <span>${ventasDia.length} venta${ventasDia.length !== 1 ? 's' : ''}</span>
                            <span>Total: <strong>${formatearMoneda(totalDia)}</strong></span>
                        </div>
                    </div>
                    <div class="sales-day-group-body">
                        <div class="table-responsive">
                            <table>
                                <thead><tr><th>Código</th><th>Cliente</th><th>Vendedor</th><th>Total</th><th>Método Pago</th><th>Fecha</th><th>Acciones</th></tr></thead>
                                <tbody>${filas}</tbody>
                            </table>
                        </div>
                    </div>
                `;
                grupoEl.querySelector('.sales-day-group-header').onclick = () => {
                    grupoEl.classList.toggle('collapsed');
                };
                contenedor.appendChild(grupoEl);
            });

            document.getElementById('expandAllDaysBtn').onclick = () => {
                contenedor.querySelectorAll('.sales-day-group').forEach(g => g.classList.remove('collapsed'));
            };
            document.getElementById('collapseAllDaysBtn').onclick = () => {
                contenedor.querySelectorAll('.sales-day-group').forEach(g => g.classList.add('collapsed'));
            };

            document.getElementById('searchSales').oninput = (e) => {
                const q = e.target.value.toLowerCase();
                contenedor.querySelectorAll('.sales-day-group').forEach(grupoEl => {
                    let algunaVisible = false;
                    grupoEl.querySelectorAll('tbody tr').forEach(row => {
                        const coincide = row.textContent.toLowerCase().includes(q);
                        row.style.display = coincide ? '' : 'none';
                        if (coincide) algunaVisible = true;
                    });
                    grupoEl.style.display = algunaVisible ? '' : 'none';
                    // Si hay búsqueda activa, expandir los grupos con coincidencias
                    // para que las filas encontradas sean visibles.
                    if (q) grupoEl.classList.toggle('collapsed', !algunaVisible);
                });
            };
        } catch (err) {
            console.error(err);
            contenedor.innerHTML = '<p style="text-align:center;padding:20px;color:var(--text-muted);">Error al cargar ventas</p>';
        }
    }

    function _inicializarTabsHistorial() {
        const barra = document.getElementById('salesPeriodTabs');
        if (barra && !barra.dataset.init) {
            barra.dataset.init = '1';
            barra.addEventListener('click', (e) => {
                const btn = e.target.closest('.period-tab-btn');
                if (!btn) return;
                cargarHistorial(btn.getAttribute('data-period'));
            });
        }

        const prevBtn = document.getElementById('prevMonthBtn');
        const nextBtn = document.getElementById('nextMonthBtn');
        if (prevBtn && !prevBtn.dataset.init) {
            prevBtn.dataset.init = '1';
            prevBtn.onclick = () => _cambiarMes(-1);
        }
        if (nextBtn && !nextBtn.dataset.init) {
            nextBtn.dataset.init = '1';
            nextBtn.onclick = () => { if (!nextBtn.disabled) _cambiarMes(1); };
        }

        const prevYearBtn = document.getElementById('prevYearBtn');
        const nextYearBtn = document.getElementById('nextYearBtn');
        if (prevYearBtn && !prevYearBtn.dataset.init) {
            prevYearBtn.dataset.init = '1';
            prevYearBtn.onclick = () => _cambiarAnio(-1);
        }
        if (nextYearBtn && !nextYearBtn.dataset.init) {
            nextYearBtn.dataset.init = '1';
            nextYearBtn.onclick = () => { if (!nextYearBtn.disabled) _cambiarAnio(1); };
        }
    }

    async function verDetalle(idVenta) {
        if (!supabase) return;
        try {
            const [{ data: detalles }, { data: venta }] = await Promise.all([
                supabase.from('venta_detalles').select('*, productos (nombre, codigo)').eq('venta_id', idVenta),
                supabase.from('ventas').select('*, clientes (nombre), usuarios (nombre)').eq('id', idVenta).single()
            ]);

            const filas = detalles?.map(d => `
                <tr>
                    <td>${d.productos?.codigo || '-'}</td>
                    <td>${d.productos?.nombre || '-'}</td>
                    <td style="text-align:center;">${d.cantidad}</td>
                    <td>${formatearMoneda(d.precio_unitario)}</td>
                    <td style="font-weight:600;">${formatearMoneda(d.subtotal)}</td>
                </tr>
            `).join('') || '<tr><td colspan="5" style="text-align:center;">Sin productos</td></tr>';

            document.getElementById('saleDetailModal')?.remove();
            const modal = document.createElement('div');
            modal.className = 'modal'; modal.id = 'saleDetailModal';
            modal.innerHTML = `
                <div class="modal-content" style="max-width:650px;">
                    <div class="modal-header">
                        <h3><i class="fas fa-receipt" style="color:var(--primary-light);margin-right:8px;"></i>Detalle de Venta — ${venta?.codigo || ''}</h3>
                        <button class="close-modal" onclick="document.getElementById('saleDetailModal').remove()"><i class="fas fa-times"></i></button>
                    </div>
                    <div class="card-body">
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px;font-size:13px;">
                            <div><span style="color:var(--text-muted);">Cliente:</span> <strong>${venta?.clientes?.nombre || 'Venta General'}</strong></div>
                            <div><span style="color:var(--text-muted);">Vendedor:</span> <strong>${venta?.usuarios?.nombre || '-'}</strong></div>
                            <div><span style="color:var(--text-muted);">Método de pago:</span> <strong>${venta?.metodo_pago || '-'}</strong></div>
                            <div><span style="color:var(--text-muted);">Fecha:</span> <strong>${formatearFecha(venta?.fecha)}</strong></div>
                        </div>
                        <div class="table-responsive">
                            <table>
                                <thead>
                                    <tr><th>Código</th><th>Producto</th><th style="text-align:center;">Cant.</th><th>Precio Unit.</th><th>Subtotal</th></tr>
                                </thead>
                                <tbody>${filas}</tbody>
                            </table>
                        </div>
                        <div style="margin-top:16px;text-align:right;font-size:15px;">
                            ${venta?.descuento > 0 ? `<div style="color:var(--text-muted);margin-bottom:4px;">Descuento: -${formatearMoneda(venta.descuento)}</div>` : ''}
                            <strong style="font-size:18px;color:var(--primary-light);">Total: ${formatearMoneda(venta?.total)}</strong>
                        </div>
                    </div>
                    <div class="modal-actions">
                        <button class="btn-primary" onclick="document.getElementById('saleDetailModal').remove()">Cerrar</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
        } catch { mostrarNotificacion('Error al cargar detalle de la venta', 'error'); }
    }

    return { setUsuario, cargarPOS, cambiarCantidad, quitarDelCarrito, mostrarModalCheckout, cargarHistorial, verDetalle };
})();

window.Ventas = Ventas;