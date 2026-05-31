document.addEventListener('DOMContentLoaded', () => {
    const { supabase, mostrarNotificacion, formatearMoneda, formatearFecha, formatearFechaCorta, ahora } = window.appConfig;

    let usuarioActual = null;
    let _ultimoStockBajo = [];

    const loginScreen  = document.getElementById('loginScreen');
    const app          = document.getElementById('app');
    const loginForm    = document.getElementById('loginForm');
    const logoutBtn    = document.getElementById('logoutBtn');
    const menuToggle   = document.getElementById('menuToggle');
    const sidebar      = document.getElementById('sidebar');
    const menuItems    = document.querySelectorAll('.menu-item');

    _inicializar();

    function _inicializar() {
        if (!supabase) mostrarNotificacion('Error de conexión a la base de datos', 'error');

        loginForm.addEventListener('submit', _manejarLogin);
        logoutBtn.addEventListener('click', _manejarLogout);
        menuToggle.addEventListener('click', () => sidebar.classList.toggle('active'));

        menuItems.forEach(item => item.addEventListener('click', _navegarSeccion));

        document.addEventListener('click', (e) => {
            if (window.innerWidth < 1024 && sidebar.classList.contains('active') &&
                !sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
                sidebar.classList.remove('active');
            }
        });

        Autenticacion.configurarRecuperacion();
        Autenticacion.verificarTokenURL();
        window.appConfig.inicializarEmailJS();
    }

    async function _manejarLogin(e) {
        e.preventDefault();
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        const usuario = await Autenticacion.iniciarSesion(username, password);
        if (!usuario) return;

        usuarioActual = usuario;
        Ventas.setUsuario(usuario);
        Empleados.setUsuario(usuario);

        document.getElementById('currentUser').textContent = usuario.nombre;
        document.getElementById('currentRole').textContent = usuario.role === 'admin' ? 'Administrador' : 'Empleado';

        _mostrarBienvenida(usuario.nombre);

        const itemsAdmin = document.querySelectorAll('.menu-item.admin-only');
        if (usuario.role === 'admin') {
            itemsAdmin.forEach(el => el.classList.remove('hidden'));
        } else {
            itemsAdmin.forEach(el => el.classList.add('hidden'));
        }

        document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
        loginScreen.classList.add('hidden');
        app.classList.remove('hidden');

        await _cargarDatosIniciales();

        if (usuario.role === 'admin') {
            _mostrarSeccion('dashboard');
            cargarDashboard();
        } else {
            _mostrarSeccion('pos');
            Ventas.cargarPOS();
        }

        mostrarNotificacion('Bienvenido ' + usuario.nombre, 'success');
    }

    function _mostrarBienvenida(nombre) {
        const screen = document.getElementById('welcomeScreen');
        document.getElementById('welcomeUserName').textContent = nombre;

        screen.classList.remove('hidden', 'fade-out');

        setTimeout(() => {
            screen.classList.add('fade-out');
            setTimeout(() => screen.classList.add('hidden'), 650);
        }, 2600);
    }

    function _manejarLogout() {
        if (confirm('¿Cerrar sesión?')) {
            usuarioActual = null;
            app.classList.add('hidden');
            loginScreen.classList.remove('hidden');
            loginForm.reset();
            mostrarNotificacion('Sesión cerrada', 'info');
        }
    }

    function _mostrarSeccion(nombre) {
        menuItems.forEach(i => i.classList.remove('active'));
        document.querySelector(`[data-section="${nombre}"]`)?.classList.add('active');
        document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
        document.getElementById(nombre + 'Section')?.classList.remove('hidden');
    }

    function _navegarSeccion(e) {
        const seccion = e.currentTarget.getAttribute('data-section');
        menuItems.forEach(i => i.classList.remove('active'));
        e.currentTarget.classList.add('active');
        document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
        document.getElementById(seccion + 'Section')?.classList.remove('hidden');
        _cargarDatosSeccion(seccion);
        if (window.innerWidth < 1024) sidebar.classList.remove('active');
    }

    async function _cargarDatosIniciales() {
        await Promise.all([Categorias.cargar(), Productos.cargar(), Clientes.cargar()]);
    }

    function _cargarDatosSeccion(seccion) {
        const acciones = {
            dashboard: () => cargarDashboard(),
            pos:        () => Ventas.cargarPOS(),
            products:   () => Productos.cargarSeccion(Categorias.getLista()),
            categories: () => Categorias.cargarSeccion(),
            customers:  () => Clientes.cargarSeccion(),
            debts:      () => Clientes.cargarDeudas(),
            sales:      () => Ventas.cargarHistorial(),
            employees:  () => Empleados.cargarSeccion(),
            profile:    () => Empleados.cargarPerfil(),
            config:     () => _cargarConfiguracion()
        };
        acciones[seccion]?.();
    }

    async function cargarDashboard() {
        if (!supabase) return;

        // Inicializar tabs del dashboard
        _inicializarTabsDashboard();

        try {
            const hoy = ahora().split('T')[0];
            const { data: ventasHoy } = await supabase.from('ventas').select('total').gte('fecha', hoy).eq('estado', 'completada');
            const totalHoy = ventasHoy?.reduce((s, v) => s + parseFloat(v.total), 0) || 0;
            document.getElementById('todaySales').textContent = formatearMoneda(totalHoy);

            const productos = Productos.getLista();
            document.getElementById('totalProducts').textContent  = productos.length;
            document.getElementById('totalCustomers').textContent = Clientes.getLista().length;

            const stockBajo = productos.filter(p => p.stock <= (p.stock_minimo || 5));
            _ultimoStockBajo = stockBajo;
            document.getElementById('lowStockCount').textContent = stockBajo.length;
            const badge = document.getElementById('lowStockBadge');
            if (badge) badge.textContent = stockBajo.length > 0 ? stockBajo.length + ' productos' : '';

            const { data: detalles } = await supabase.from('venta_detalles').select('cantidad, productos!inner(nombre)');
            let topNombre = 'Sin datos', topCantidad = 0;
            if (detalles?.length) {
                const totales = {};
                detalles.forEach(i => { const n = i.productos?.nombre; if (n) totales[n] = (totales[n] || 0) + i.cantidad; });
                const ordenado = Object.entries(totales).sort((a, b) => b[1] - a[1]);
                if (ordenado.length) { [topNombre, topCantidad] = ordenado[0]; }
            }
            document.getElementById('topProductName').textContent = topNombre;
            document.getElementById('topProductQty').textContent  = topCantidad > 0 ? `Más vendido · ${topCantidad} uds` : 'Producto más vendido';

            _vincularTarjetasDashboard(stockBajo);

            const { data: ventasRecientes } = await supabase.from('ventas')
                .select('codigo, total, fecha, clientes (nombre)').order('fecha', { ascending: false }).limit(5);

            const tbodyRecientes = document.querySelector('#recentSalesTable tbody');
            tbodyRecientes.innerHTML = ventasRecientes?.length
                ? ventasRecientes.map(v => `<tr><td>${v.codigo}</td><td>${v.clientes?.nombre || 'Venta General'}</td><td>${formatearMoneda(v.total)}</td><td>${formatearFecha(v.fecha)}</td></tr>`).join('')
                : '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:16px;">No hay ventas recientes</td></tr>';

            const tbodyStock = document.querySelector('#lowStockTable tbody');
            tbodyStock.innerHTML = stockBajo.length
                ? stockBajo.map(p => {
                    const critico = p.stock <= 3;
                    return `<tr><td>${p.nombre}</td><td><span class="status-badge status-warning">${p.stock}</span></td><td>${p.stock_minimo || 5}</td><td><span class="status-badge ${critico ? 'status-inactive' : 'status-warning'}">${critico ? 'CRÍTICO' : 'BAJO'}</span></td></tr>`;
                }).join('')
                : '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:16px;">Sin productos con stock bajo ✓</td></tr>';

        } catch (err) { console.error('Error al cargar dashboard:', err); }
    }

    function _inicializarTabsDashboard() {
        const tabs = document.querySelectorAll('.dash-tab');
        if (!tabs.length || tabs[0].dataset.bound) return;
        tabs.forEach(tab => {
            tab.dataset.bound = '1';
            tab.addEventListener('click', () => {
                const nombre = tab.dataset.tab;
                tabs.forEach(t => {
                    t.style.color = 'var(--text-muted)';
                    t.style.borderBottomColor = 'transparent';
                });
                tab.style.color = 'var(--text-primary)';
                tab.style.borderBottomColor = 'var(--primary)';

                document.getElementById('dash-tab-overview').style.display  = nombre === 'overview'  ? '' : 'none';
                document.getElementById('dash-tab-reports').style.display   = nombre === 'reports'   ? '' : 'none';

                if (nombre === 'reports') Reportes.cargar();
            });
        });
    }

    function _vincularTarjetasDashboard(stockBajo) {
        const ir = (seccion) => document.querySelector(`[data-section="${seccion}"]`)?.click();

        [
            ['statCardSales',     () => ir('sales')],
            ['statCardProducts',  () => ir('products')],
            ['statCardCustomers', () => ir('customers')],
            ['topProductCard',    () => ir('reports')]
        ].forEach(([id, fn]) => {
            const card = document.getElementById(id);
            if (card && !card.dataset.clickBound) { card.dataset.clickBound = '1'; card.addEventListener('click', fn); }
        });

        const cardStock = document.getElementById('statCardLowStock');
        if (cardStock) cardStock.onclick = () => _mostrarModalStockBajo(_ultimoStockBajo);
    }

    function _mostrarModalStockBajo(stockBajo) {
        document.getElementById('lowStockDetailModal')?.remove();
        const modal = document.createElement('div');
        modal.className = 'modal'; modal.id = 'lowStockDetailModal';

        const filas = stockBajo.length
            ? stockBajo.map(p => {
                const crit = p.stock <= 3;
                return `<tr><td>${p.codigo || '-'}</td><td>${p.nombre}</td><td>${p.categorias?.nombre || '-'}</td>
                    <td><span class="status-badge status-warning">${p.stock}</span></td><td>${p.stock_minimo || 5}</td>
                    <td><span class="status-badge ${crit ? 'status-inactive' : 'status-warning'}">${crit ? 'CRÍTICO' : 'BAJO'}</span></td></tr>`;
            }).join('')
            : '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-muted);">Sin productos con stock bajo</td></tr>';

        modal.innerHTML = `
            <div class="modal-content" style="max-width:800px;">
                <div class="modal-header">
                    <h3><i class="fas fa-exclamation-triangle" style="color:var(--warning);margin-right:8px;"></i>Stock Bajo (${stockBajo.length})</h3>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table><thead><tr><th>Código</th><th>Producto</th><th>Categoría</th><th>Stock Actual</th><th>Stock Mínimo</th><th>Estado</th></tr></thead>
                        <tbody>${filas}</tbody></table>
                    </div>
                </div>
                <div class="modal-actions"><button class="btn-primary" id="btnCerrarStock">Cerrar</button></div>
            </div>
        `;
        document.body.appendChild(modal);
        document.getElementById('btnCerrarStock').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    }

    async function _cargarConfiguracion() {
        if (!supabase) return;
        try {
            const { data: config } = await supabase.from('configuracion').select('*');
            const mapa = {};
            config?.forEach(i => { mapa[i.clave] = i.valor; });
            document.getElementById('companyName').value    = mapa.empresa_nombre    || 'Montana Importados';
            document.getElementById('companyPhone').value   = mapa.empresa_telefono  || '';
            document.getElementById('companyAddress').value = mapa.empresa_direccion || '';

            const { data: usuarios } = await supabase.from('usuarios').select('*').order('nombre');
            const tbody = document.querySelector('#usersTable tbody');
            tbody.innerHTML = '';
            usuarios?.forEach(u => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${u.username}</td><td>${u.nombre}</td>
                    <td><span class="status-badge ${u.role === 'admin' ? 'status-active' : 'status-info'}">${u.role}</span></td>
                    <td><span class="status-badge ${u.activo ? 'status-active' : 'status-inactive'}">${u.activo ? 'Activo' : 'Inactivo'}</span></td>
                `;
                tbody.appendChild(row);
            });

            document.getElementById('companyForm').onsubmit = async (e) => {
                e.preventDefault();
                const cambios = [
                    { clave: 'empresa_nombre',     valor: document.getElementById('companyName').value },
                    { clave: 'empresa_telefono',   valor: document.getElementById('companyPhone').value },
                    { clave: 'empresa_direccion',  valor: document.getElementById('companyAddress').value }
                ];
                for (const c of cambios) {
                    await supabase.from('configuracion').update({ valor: c.valor }).eq('clave', c.clave);
                }
                mostrarNotificacion('Configuración guardada', 'success');
            };
        } catch (err) { console.error('Error al cargar configuración:', err); }
    }
});