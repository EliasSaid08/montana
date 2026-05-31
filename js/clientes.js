const Clientes = (() => {
    const { supabase, mostrarNotificacion, formatearMoneda, formatearFecha, ahora } = window.appConfig;

    let lista = [];

    async function cargar() {
        if (!supabase) return;
        try {
            const { data, error } = await supabase.from('clientes').select('*').eq('activo', true).order('nombre');
            if (error) throw error;
            lista = data || [];
        } catch { lista = []; }
    }

    async function cargarSeccion() {
        await cargar();
        const tbody = document.querySelector('#customersTable tbody');
        tbody.innerHTML = '';

        if (lista.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No hay clientes</td></tr>';
            return;
        }

        lista.forEach(c => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${c.nombre}</td>
                <td>${c.telefono || '-'}</td>
                <td>
                    <span class="status-badge ${c.deuda_total > 0 ? 'status-warning' : 'status-active'}">
                        ${formatearMoneda(c.deuda_total || 0)}
                    </span>
                </td>
                <td><span class="status-badge status-active">Activo</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-action btn-view" title="Ver ficha" onclick="Clientes.verFichaCliente(${c.id})">
                            <i class="fas fa-user-circle"></i>
                        </button>
                        <button class="btn-action btn-edit" title="Editar" onclick="Clientes.mostrarModal(${c.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-action btn-delete" title="Eliminar" onclick="Clientes.eliminar(${c.id},'${c.nombre.replace(/'/g, "\\'")}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });

        document.getElementById('searchCustomers').oninput = (e) => {
            const q = e.target.value.toLowerCase();
            tbody.querySelectorAll('tr').forEach(row => {
                row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
            });
        };
        document.getElementById('addCustomerBtn').onclick = () => mostrarModal();
    }

    function mostrarModal(id = null) {
        const modal = document.getElementById('customerModal');
        const form  = document.getElementById('customerForm');

        form.reset();
        document.getElementById('customerId').value = '';
        document.getElementById('customerModalTitle').textContent = 'Agregar Cliente';

        if (id) {
            const cliente = lista.find(c => c.id === id);
            if (cliente) {
                document.getElementById('customerModalTitle').textContent = 'Editar Cliente';
                document.getElementById('customerId').value    = cliente.id;
                document.getElementById('customerName').value  = cliente.nombre;
                document.getElementById('customerPhone').value = cliente.telefono || '';
                document.getElementById('customerEmail').value = cliente.email || '';
                document.getElementById('customerAddress').value = cliente.direccion || '';
            }
        }

        modal.classList.remove('hidden');
        modal.querySelectorAll('.close-modal').forEach(btn => btn.onclick = () => modal.classList.add('hidden'));
        form.onsubmit = async (e) => { e.preventDefault(); await guardar(); };
    }

    async function guardar() {
        if (!supabase) return;
        const id = document.getElementById('customerId').value;
        const datos = {
            nombre:    document.getElementById('customerName').value,
            telefono:  document.getElementById('customerPhone').value || null,
            email:     document.getElementById('customerEmail').value || null,
            direccion: document.getElementById('customerAddress').value || null,
            activo:    true
        };

        try {
            const result = id
                ? await supabase.from('clientes').update(datos).eq('id', id)
                : await supabase.from('clientes').insert([datos]);
            if (result.error) throw result.error;
            document.getElementById('customerModal').classList.add('hidden');
            mostrarNotificacion('Cliente guardado', 'success');
            await cargarSeccion();
        } catch { mostrarNotificacion('Error al guardar cliente', 'error'); }
    }

    async function eliminar(id, nombre) {
        if (!supabase || !confirm(`¿Eliminar el cliente "${nombre}"?`)) return;
        try {
            const { error } = await supabase.from('clientes').update({ activo: false }).eq('id', id);
            if (error) throw error;
            mostrarNotificacion('Cliente eliminado', 'success');
            await cargarSeccion();
        } catch { mostrarNotificacion('Error al eliminar cliente', 'error'); }
    }

    async function cargarDeudas() {
        if (!supabase) return;
        try {
            const { data: deudores, error } = await supabase
                .from('clientes')
                .select('*, ventas!ventas_cliente_id_fkey (fecha, total)')
                .gt('deuda_total', 0).eq('activo', true)
                .order('deuda_total', { ascending: false });
            if (error) throw error;

            document.getElementById('totalDebt').textContent    = formatearMoneda(deudores?.reduce((s, d) => s + parseFloat(d.deuda_total || 0), 0) || 0);
            document.getElementById('debtorsCount').textContent = deudores?.length || 0;

            const tbody = document.querySelector('#debtsTable tbody');
            tbody.innerHTML = '';

            if (!deudores || deudores.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No hay clientes con deuda</td></tr>';
                return;
            }

            deudores.forEach(d => {
                const ultimaVenta = d.ventas?.sort((a, b) => new Date(b.fecha) - new Date(a.fecha))[0] || null;
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${d.nombre}</td>
                    <td>${d.telefono || '-'}</td>
                    <td><span class="status-badge status-warning" style="font-weight:700;font-size:16px;">${formatearMoneda(d.deuda_total)}</span></td>
                    <td>${ultimaVenta ? formatearFecha(ultimaVenta.fecha) : 'N/A'}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn-action btn-pay" title="Registrar pago" onclick="Clientes.mostrarModalPago(${d.id},'${d.nombre.replace(/'/g, "\\'")}',${d.deuda_total})">
                                <i class="fas fa-dollar-sign"></i>
                            </button>
                            <button class="btn-action btn-view" title="Ver historial" onclick="Clientes.verHistorialDeuda(${d.id})">
                                <i class="fas fa-history"></i>
                            </button>
                        </div>
                    </td>
                `;
                tbody.appendChild(row);
            });

            document.getElementById('searchDebts').oninput = (e) => {
                const q = e.target.value.toLowerCase();
                tbody.querySelectorAll('tr').forEach(row => {
                    row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
                });
            };
        } catch (err) { console.error('Error al cargar deudas:', err); }
    }

    function mostrarModalPago(idCliente, nombre, deudaActual) {
        const modal = document.getElementById('paymentModal');
        const form  = document.getElementById('paymentForm');

        form.reset();
        document.getElementById('paymentCustomerId').value      = idCliente;
        document.getElementById('paymentCustomerName').value    = nombre;
        document.getElementById('paymentCurrentDebt').value     = formatearMoneda(deudaActual);
        document.getElementById('paymentAmount').max            = deudaActual;

        modal.classList.remove('hidden');
        modal.querySelectorAll('.close-modal').forEach(btn => btn.onclick = () => modal.classList.add('hidden'));
        form.onsubmit = async (e) => { e.preventDefault(); await registrarPago(); };
    }

    async function registrarPago() {
        if (!supabase) return;
        const idCliente = document.getElementById('paymentCustomerId').value;
        const monto     = parseFloat(document.getElementById('paymentAmount').value);
        const metodo    = document.getElementById('paymentMethodType').value;
        const referencia = document.getElementById('paymentReference').value;
        const notas      = document.getElementById('paymentNotes').value;

        if (monto <= 0) { mostrarNotificacion('El monto debe ser mayor a 0', 'error'); return; }

        try {
            const { error: errPago } = await supabase.from('pagos').insert([{
                cliente_id: idCliente, monto, fecha: ahora(),
                metodo_pago: metodo,
                referencia: referencia || null,
                notas: notas || null
            }]);
            if (errPago) throw errPago;

            const { data: cliente } = await supabase.from('clientes').select('deuda_total').eq('id', idCliente).single();
            const nuevaDeuda = Math.max(0, (cliente.deuda_total || 0) - monto);
            const { error: errUpdate } = await supabase.from('clientes').update({ deuda_total: nuevaDeuda }).eq('id', idCliente);
            if (errUpdate) throw errUpdate;

            document.getElementById('paymentModal').classList.add('hidden');
            mostrarNotificacion('Pago registrado exitosamente', 'success');
            await cargar();
            await cargarDeudas();
        } catch { mostrarNotificacion('Error al registrar el pago', 'error'); }
    }

    async function verHistorialDeuda(idCliente) {
        if (!supabase) return;
        try {
            const cliente = lista.find(c => c.id === idCliente);
            const { data: pagos } = await supabase.from('pagos').select('*').eq('cliente_id', idCliente).order('fecha', { ascending: false }).limit(20);

            document.getElementById('historialPagosModal')?.remove();
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.id = 'historialPagosModal';

            const totalPagado = (pagos || []).reduce((s, p) => s + parseFloat(p.monto || 0), 0);

            const filas = pagos && pagos.length > 0
                ? pagos.map(p => `
                    <tr>
                        <td>${formatearFecha(p.fecha)}</td>
                        <td><strong style="color:var(--primary-light);">${formatearMoneda(p.monto)}</strong></td>
                        <td><span class="status-badge status-info">${p.metodo_pago || '-'}</span></td>
                        <td style="color:var(--text-muted);font-size:12px;">${p.referencia || '-'}</td>
                        <td style="color:var(--text-muted);font-size:12px;">${p.notas || '-'}</td>
                    </tr>`).join('')
                : '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted);">No hay pagos registrados</td></tr>';

            modal.innerHTML = `
                <div class="modal-content" style="max-width:700px;">
                    <div class="modal-header">
                        <h3><i class="fas fa-history" style="color:var(--primary-light);margin-right:8px;"></i>Historial de Pagos — ${cliente?.nombre || ''}</h3>
                        <button class="close-modal" onclick="document.getElementById('historialPagosModal').remove()"><i class="fas fa-times"></i></button>
                    </div>
                    <div class="card-body">
                        <div style="display:flex;gap:16px;margin-bottom:18px;flex-wrap:wrap;">
                            <div style="background:var(--bg-raised);border-radius:10px;padding:12px 20px;flex:1;min-width:140px;">
                                <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Total pagado</div>
                                <div style="font-size:20px;font-weight:700;color:#22c55e;">${formatearMoneda(totalPagado)}</div>
                            </div>
                            <div style="background:var(--bg-raised);border-radius:10px;padding:12px 20px;flex:1;min-width:140px;">
                                <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Deuda actual</div>
                                <div style="font-size:20px;font-weight:700;color:#f43f5e;">${formatearMoneda(cliente?.deuda_total || 0)}</div>
                            </div>
                            <div style="background:var(--bg-raised);border-radius:10px;padding:12px 20px;flex:1;min-width:140px;">
                                <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Pagos registrados</div>
                                <div style="font-size:20px;font-weight:700;color:var(--primary-light);">${pagos?.length || 0}</div>
                            </div>
                        </div>
                        <div class="table-responsive">
                            <table>
                                <thead>
                                    <tr><th>Fecha</th><th>Monto</th><th>Método</th><th>Referencia</th><th>Notas</th></tr>
                                </thead>
                                <tbody>${filas}</tbody>
                            </table>
                        </div>
                    </div>
                    <div class="modal-actions">
                        <button class="btn-primary" onclick="document.getElementById('historialPagosModal').remove()">Cerrar</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
        } catch { mostrarNotificacion('Error al cargar historial', 'error'); }
    }

    async function verFichaCliente(idCliente) {
        if (!supabase) return;

        const cliente = lista.find(c => c.id === idCliente);
        if (!cliente) return;

        // Crear modal con loader
        document.getElementById('fichaClienteModal')?.remove();
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'fichaClienteModal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:900px;max-height:90vh;overflow-y:auto;">
                <div class="modal-header" style="position:sticky;top:0;z-index:10;background:var(--bg-card);">
                    <div style="display:flex;align-items:center;gap:14px;flex:1;min-width:0;">
                        <div style="width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--primary-light));display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                            <i class="fas fa-user" style="color:#fff;font-size:18px;"></i>
                        </div>
                        <div style="min-width:0;">
                            <h3 style="margin:0;font-size:17px;">${cliente.nombre}</h3>
                            <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">
                                ${cliente.telefono ? `<i class="fas fa-phone" style="margin-right:4px;"></i>${cliente.telefono}` : ''}
                                ${cliente.email ? `&nbsp;·&nbsp;<i class="fas fa-envelope" style="margin-right:4px;"></i>${cliente.email}` : ''}
                            </div>
                        </div>
                    </div>
                    <button class="close-modal" onclick="document.getElementById('fichaClienteModal').remove()"><i class="fas fa-times"></i></button>
                </div>

                <div id="fichaClienteBody" class="card-body" style="padding:20px;">
                    <div style="text-align:center;padding:40px;color:var(--text-muted);">
                        <i class="fas fa-circle-notch fa-spin" style="font-size:28px;margin-bottom:10px;"></i>
                        <div>Cargando datos del cliente…</div>
                    </div>
                </div>

                <div class="modal-actions" style="position:sticky;bottom:0;background:var(--bg-card);">
                    <button class="btn-secondary" onclick="document.getElementById('fichaClienteModal').remove()">Cerrar</button>
                    ${cliente.deuda_total > 0 ? `<button class="btn-primary" onclick="document.getElementById('fichaClienteModal').remove();Clientes.mostrarModalPago(${cliente.id},'${cliente.nombre.replace(/'/g, "\\'")}',${cliente.deuda_total})"><i class="fas fa-dollar-sign"></i> Registrar Pago</button>` : ''}
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

        // Cargar datos en paralelo
        try {
            const [
                { data: ventas },
                { data: pagos }
            ] = await Promise.all([
                supabase.from('ventas')
                    .select('id, codigo, fecha, total, subtotal, descuento, metodo_pago, estado, notas, usuarios(nombre)')
                    .eq('cliente_id', idCliente)
                    .order('fecha', { ascending: false })
                    .limit(50),
                supabase.from('pagos')
                    .select('*')
                    .eq('cliente_id', idCliente)
                    .order('fecha', { ascending: false })
                    .limit(50)
            ]);

            const totalCompras   = (ventas || []).reduce((s, v) => s + parseFloat(v.total || 0), 0);
            const totalPagado    = (pagos  || []).reduce((s, p) => s + parseFloat(p.monto || 0), 0);
            const deudaActual    = parseFloat(cliente.deuda_total || 0);
            const cantVentas     = ventas?.length || 0;
            const cantPagos      = pagos?.length  || 0;

            // Tabs HTML
            const body = document.getElementById('fichaClienteBody');
            body.innerHTML = `
                <!-- KPIs -->
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:24px;">
                    <div style="background:var(--bg-raised);border-radius:10px;padding:14px 18px;border-left:3px solid var(--primary);">
                        <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:4px;">Total comprado</div>
                        <div style="font-size:20px;font-weight:700;color:var(--primary-light);">${formatearMoneda(totalCompras)}</div>
                    </div>
                    <div style="background:var(--bg-raised);border-radius:10px;padding:14px 18px;border-left:3px solid #22c55e;">
                        <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:4px;">Total pagado</div>
                        <div style="font-size:20px;font-weight:700;color:#22c55e;">${formatearMoneda(totalPagado)}</div>
                    </div>
                    <div style="background:var(--bg-raised);border-radius:10px;padding:14px 18px;border-left:3px solid ${deudaActual > 0 ? '#f43f5e' : '#22c55e'};">
                        <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:4px;">Deuda actual</div>
                        <div style="font-size:20px;font-weight:700;color:${deudaActual > 0 ? '#f43f5e' : '#22c55e'};">${formatearMoneda(deudaActual)}</div>
                    </div>
                    <div style="background:var(--bg-raised);border-radius:10px;padding:14px 18px;border-left:3px solid var(--text-muted);">
                        <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:4px;">N.º de compras</div>
                        <div style="font-size:20px;font-weight:700;color:var(--text-primary);">${cantVentas}</div>
                    </div>
                </div>

                <!-- Tabs -->
                <div style="display:flex;gap:0;border-bottom:2px solid var(--border-color);margin-bottom:18px;">
                    <button id="fichaTabCompras" onclick="fichaTabSwitch('compras')" style="background:none;border:none;padding:9px 20px;cursor:pointer;font-size:13px;font-weight:600;color:var(--primary-light);border-bottom:2px solid var(--primary);margin-bottom:-2px;">
                        <i class="fas fa-shopping-cart" style="margin-right:6px;"></i>Compras (${cantVentas})
                    </button>
                    <button id="fichaTabPagos" onclick="fichaTabSwitch('pagos')" style="background:none;border:none;padding:9px 20px;cursor:pointer;font-size:13px;font-weight:600;color:var(--text-muted);border-bottom:2px solid transparent;margin-bottom:-2px;">
                        <i class="fas fa-money-bill" style="margin-right:6px;"></i>Pagos (${cantPagos})
                    </button>
                </div>

                <!-- Tab Compras -->
                <div id="fichaTabComprasContent">
                    ${cantVentas === 0
                        ? `<div style="text-align:center;padding:32px;color:var(--text-muted);"><i class="fas fa-receipt" style="font-size:32px;margin-bottom:10px;display:block;opacity:.3;"></i>Sin compras registradas</div>`
                        : `<div class="table-responsive">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Código</th>
                                        <th>Fecha</th>
                                        <th>Vendedor</th>
                                        <th>Método</th>
                                        <th style="text-align:right;">Total</th>
                                        <th style="text-align:center;">Estado</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${ventas.map(v => `
                                        <tr>
                                            <td style="font-family:monospace;font-size:12px;color:var(--primary-light);">${v.codigo}</td>
                                            <td style="font-size:12px;">${formatearFecha(v.fecha)}</td>
                                            <td style="font-size:12px;">${v.usuarios?.nombre || '-'}</td>
                                            <td><span class="status-badge status-info" style="font-size:11px;">${v.metodo_pago || '-'}</span></td>
                                            <td style="text-align:right;font-weight:700;">${formatearMoneda(v.total)}</td>
                                            <td style="text-align:center;"><span class="status-badge ${v.estado === 'completada' ? 'status-active' : 'status-warning'}" style="font-size:11px;">${v.estado}</span></td>
                                            <td style="text-align:center;">
                                                <button class="btn-secondary" style="padding:4px 10px;font-size:11px;" onclick="document.getElementById('fichaClienteModal').remove();Ventas.verDetalle('${v.id}')">
                                                    <i class="fas fa-eye"></i>
                                                </button>
                                            </td>
                                        </tr>
                                        ${v.notas ? `<tr style="background:rgba(0,0,0,.04);"><td colspan="7" style="font-size:11px;color:var(--text-muted);padding:4px 12px 8px;font-style:italic;"><i class="fas fa-comment-alt" style="margin-right:5px;"></i>${v.notas}</td></tr>` : ''}
                                    `).join('')}
                                </tbody>
                            </table>
                           </div>`
                    }
                </div>

                <!-- Tab Pagos -->
                <div id="fichaTabPagosContent" style="display:none;">
                    ${cantPagos === 0
                        ? `<div style="text-align:center;padding:32px;color:var(--text-muted);"><i class="fas fa-money-bill-wave" style="font-size:32px;margin-bottom:10px;display:block;opacity:.3;"></i>Sin pagos registrados</div>`
                        : `<div class="table-responsive">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Fecha</th>
                                        <th style="text-align:right;">Monto</th>
                                        <th>Método</th>
                                        <th>Referencia</th>
                                        <th>Notas</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${pagos.map(p => `
                                        <tr>
                                            <td style="font-size:12px;">${formatearFecha(p.fecha)}</td>
                                            <td style="text-align:right;font-weight:700;color:#22c55e;">${formatearMoneda(p.monto)}</td>
                                            <td><span class="status-badge status-info" style="font-size:11px;">${p.metodo_pago || '-'}</span></td>
                                            <td style="font-size:12px;color:var(--text-muted);">${p.referencia || '-'}</td>
                                            <td style="font-size:12px;color:var(--text-muted);">${p.notas || '-'}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                           </div>`
                    }
                </div>
            `;

            // Helper de tabs en scope global temporal
            window.fichaTabSwitch = (tab) => {
                const esCompras = tab === 'compras';
                document.getElementById('fichaTabComprasContent').style.display = esCompras ? '' : 'none';
                document.getElementById('fichaTabPagosContent').style.display  = esCompras ? 'none' : '';

                const btnC = document.getElementById('fichaTabCompras');
                const btnP = document.getElementById('fichaTabPagos');
                btnC.style.color = esCompras ? 'var(--primary-light)' : 'var(--text-muted)';
                btnC.style.borderBottomColor = esCompras ? 'var(--primary)' : 'transparent';
                btnP.style.color = esCompras ? 'var(--text-muted)' : 'var(--primary-light)';
                btnP.style.borderBottomColor = esCompras ? 'transparent' : 'var(--primary)';
            };

        } catch (err) {
            console.error('Error al cargar ficha del cliente:', err);
            document.getElementById('fichaClienteBody').innerHTML =
                `<div style="text-align:center;padding:40px;color:var(--danger);">
                    <i class="fas fa-exclamation-circle" style="font-size:28px;margin-bottom:10px;"></i>
                    <div>Error al cargar los datos del cliente</div>
                </div>`;
        }
    }

    return { cargar, cargarSeccion, mostrarModal, eliminar, cargarDeudas, mostrarModalPago, verHistorialDeuda, verFichaCliente, getLista: () => lista };
})();

window.Clientes = Clientes;